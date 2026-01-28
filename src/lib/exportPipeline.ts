import { promises as fs } from "fs";
import path from "path";
import {
  buildAsepriteJson,
  inferFrameSize,
  loadPngDimensions,
  type AsepriteFrame,
} from "@/lib/aseprite";
import { removeBackgroundWithPython } from "@/lib/backgroundRemoval";
import { frameIndexFromName, sortFrameFiles } from "@/lib/frameUtils";
import { processImageFile } from "@/lib/imageProcessing";
import { logger } from "@/lib/logger";
import { fileExists, readJson, storagePath, writeJson } from "@/lib/storage";
import { getProjectSettings } from "@/lib/projectSettings";
import { normalizeFrameBatch, getEffectiveSettings } from "@/lib/canvasNormalization";
import { composeSpritesheet, extractFrames, getSpritesheetLayout } from "@/lib/spritesheet";
import type {
  Animation as AnimationModel,
  Character,
  AnchorPoint,
  BackgroundRemovalMode,
} from "@/types";

type AsepriteMeta = {
  app: string;
  version: string;
  image: string;
  size: { w: number; h: number };
  scale: string;
  frameTags: Array<Record<string, never>>;
  layers: Array<Record<string, never>>;
  slices: Array<Record<string, never>>;
};

export type AsepriteArrayJson = {
  frames: AsepriteFrame[];
  meta: AsepriteMeta;
};

export type AsepriteHashJson = {
  frames: Record<string, Omit<AsepriteFrame, "filename">>;
  meta: AsepriteMeta;
};

export type ExportOptions = {
  normalize: boolean;
  removeBackground: boolean;
  backgroundRemovalMode: BackgroundRemovalMode;
  alphaThreshold: number | null;
};

export type ExportArtifacts = {
  exportDir: string;
  spritesheetPath: string;
  spritesheetFilename: string;
  hashPath: string;
  arrayPath: string;
  framesDir: string | null;
  pngSequenceUrl?: string;
  normalized: boolean;
  backgroundRemoved: boolean;
  backgroundRemovalMode: BackgroundRemovalMode;
  alphaThreshold: number | null;
};

export type ExportPipelineResult = {
  animation: AnimationModel;
  artifacts: ExportArtifacts;
  aseprite: {
    arrayJson: AsepriteArrayJson;
    hashJson: AsepriteHashJson;
  };
  exportedAt: string;
};

export class ExportPipelineError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function clampAlphaThreshold(value: number | string | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(255, Math.max(0, Math.round(numeric)));
}

export function parseBackgroundRemovalMode(
  value: string | null | undefined
): BackgroundRemovalMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "spritesheet" || normalized === "sheet") return "spritesheet";
  if (normalized === "per-frame" || normalized === "per_frame" || normalized === "frames") {
    return "per-frame";
  }
  return null;
}

export async function loadFrameFiles(framesDir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(framesDir);
    return sortFrameFiles(files);
  } catch {
    return [];
  }
}

export function buildIndexJson(
  files: { filename: string; frameIndex: number }[],
  fps: number
) {
  const duration = Math.round(1000 / Math.max(1, fps));
  return {
    frames: files.map((file) => ({
      filename: file.filename,
      frameIndex: file.frameIndex,
      duration,
    })),
    meta: {
      frameRate: fps,
    },
  };
}

export function buildZipAsepriteJson(
  arrayJson: AsepriteArrayJson,
  hashJson: AsepriteHashJson,
  imageName: string
) {
  const meta = { ...arrayJson.meta, image: imageName };
  const zipArrayJson = JSON.stringify({ ...arrayJson, meta }, null, 2);
  const zipHashJson = JSON.stringify({ ...hashJson, meta }, null, 2);
  return { zipArrayJson, zipHashJson };
}

function throwPipelineError(message: string, status: number): never {
  throw new ExportPipelineError(message, status);
}

export async function runExportPipeline(
  animationId: string,
  options: ExportOptions
): Promise<ExportPipelineResult> {
  const filePath = storagePath("animations", animationId, "animation.json");

  if (!(await fileExists(filePath))) {
    throwPipelineError("Animation not found.", 404);
  }

  const animation = await readJson<AnimationModel>(filePath);
  const spritesheetUrl = animation.generatedSpritesheet;

  if (!spritesheetUrl) {
    throwPipelineError("No generated spritesheet found. Run generation first.", 400);
  }

  const filename = spritesheetUrl.split("/").pop();
  if (!filename) {
    throwPipelineError("Invalid spritesheet path.", 400);
  }

  const spritesheetPath = storagePath("animations", animationId, "generated", filename);
  if (!(await fileExists(spritesheetPath))) {
    throwPipelineError("Spritesheet file missing.", 404);
  }

  if (path.extname(spritesheetPath).toLowerCase() !== ".png") {
    throwPipelineError("Spritesheet must be PNG to generate Aseprite metadata.", 400);
  }

  const exportDir = storagePath("animations", animationId, "exports");
  await fs.mkdir(exportDir, { recursive: true });

  logger.info("Export pipeline: started", {
    animationId,
    normalize: options.normalize,
    removeBackground: options.removeBackground,
    backgroundRemovalMode: options.backgroundRemovalMode,
    alphaThreshold: options.alphaThreshold ?? 0,
  });

  let frameWidth =
    Number(animation.spritesheetLayout?.frameWidth ?? animation.frameWidth ?? 0) ||
    Number(animation.spritesheetLayout?.frameSize ?? animation.spriteSize ?? 0);
  let frameHeight =
    Number(animation.spritesheetLayout?.frameHeight ?? animation.frameHeight ?? 0) ||
    Number(animation.spritesheetLayout?.frameSize ?? animation.spriteSize ?? 0);

  const generatedFrames = animation.generatedFrames ?? [];
  const frameCount = generatedFrames.length || animation.actualFrameCount || 0;

  let finalSpritesheetPath = spritesheetPath;
  let finalFramesDir = storagePath("animations", animationId, "generated", "frames");
  let normalizedExport = false;
  const sanitizedThreshold = clampAlphaThreshold(options.alphaThreshold);
  const applyAlphaThreshold = typeof sanitizedThreshold === "number" && sanitizedThreshold > 0;
  const applyBackgroundRemoval = options.removeBackground;
  const backgroundRemovalMode = options.backgroundRemovalMode;

  if (options.normalize) {
    const projectSettings = await getProjectSettings();
    let characterSettings: { anchor?: AnchorPoint; scale?: number } | undefined;

    if (animation.characterId) {
      const characterPath = storagePath("characters", animation.characterId, "character.json");
      if (await fileExists(characterPath)) {
        const character = await readJson<Character>(characterPath);
        characterSettings = { anchor: character.anchor, scale: character.scale };
      }
    }

    const settings = getEffectiveSettings(projectSettings, characterSettings);
    const framesDir = storagePath("animations", animationId, "generated", "frames");
    const normalizedDir = path.join(exportDir, "normalized");
    await fs.mkdir(normalizedDir, { recursive: true });

    try {
      const frameFiles = await fs.readdir(framesDir);
      const orderedFrames = sortFrameFiles(frameFiles);

      if (orderedFrames.length > 0) {
        const inputPaths = orderedFrames.map((f) => path.join(framesDir, f));
        const outputPaths = orderedFrames.map((f) => path.join(normalizedDir, f));

        await normalizeFrameBatch({
          inputPaths,
          outputPaths,
          canvasWidth: settings.canvasWidth,
          canvasHeight: settings.canvasHeight,
          anchor: settings.anchor,
          scale: settings.scale,
          pixelArt: true,
          consistentBounds: true,
        });

        frameWidth = settings.canvasWidth;
        frameHeight = settings.canvasHeight;
        finalFramesDir = normalizedDir;
        normalizedExport = true;

        const columns = animation.sheetColumns ?? Math.ceil(Math.sqrt(orderedFrames.length));
        const rows = Math.ceil(orderedFrames.length / columns);
        const normalizedSpritesheetPath = path.join(
          exportDir,
          `spritesheet_normalized_${Date.now()}.png`
        );

        await composeSpritesheet({
          framesDir: normalizedDir,
          outputPath: normalizedSpritesheetPath,
          layout: {
            frameWidth: settings.canvasWidth,
            frameHeight: settings.canvasHeight,
            columns,
            rows,
            width: columns * settings.canvasWidth,
            height: rows * settings.canvasHeight,
          },
        });

        finalSpritesheetPath = normalizedSpritesheetPath;
      }
    } catch (err) {
      logger.warn("Normalization failed, falling back to original", {
        animationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const { width, height } = await loadPngDimensions(finalSpritesheetPath);
  const preferredSize = Number(animation.spriteSize ?? 48);
  const frameSize = frameWidth && frameHeight ? undefined : inferFrameSize(width, height, preferredSize);

  const exportFilename = normalizedExport ? "spritesheet_normalized.png" : filename;

  const asepriteJson = buildAsepriteJson({
    imageName: exportFilename,
    imageWidth: width,
    imageHeight: height,
    frameSize,
    frameWidth: frameWidth || frameSize,
    frameHeight: frameHeight || frameSize,
    fps: Number(animation.fps ?? 12),
    frameCount: typeof frameCount === "number" ? frameCount : undefined,
  });
  const arrayJson: AsepriteArrayJson = asepriteJson.arrayJson;
  const hashJson: AsepriteHashJson = asepriteJson.hashJson;

  const exportSpritesheet = path.join(exportDir, exportFilename);
  const resolvedFrameWidth = frameWidth || frameSize || 0;
  const resolvedFrameHeight = frameHeight || frameSize || 0;
  const resolvedFrameCount =
    typeof frameCount === "number" && frameCount > 0 ? frameCount : undefined;
  const fpsValue = Number(animation.fps ?? 12);
  const sourceFrameFiles = await loadFrameFiles(finalFramesDir);
  const shouldExportFrames = sourceFrameFiles.length > 0;
  let exportFramesDir: string | null = null;
  let pngSequenceUrl: string | undefined;

  if (applyBackgroundRemoval) {
    try {
      if (backgroundRemovalMode === "spritesheet") {
        const tempSpritesheet = applyAlphaThreshold
          ? path.join(exportDir, `spritesheet_bg_removed_${Date.now()}.png`)
          : exportSpritesheet;

        await removeBackgroundWithPython({
          inputPath: finalSpritesheetPath,
          outputPath: tempSpritesheet,
        });

        if (applyAlphaThreshold) {
          await processImageFile({
            inputPath: tempSpritesheet,
            outputPath: exportSpritesheet,
            alphaThreshold: sanitizedThreshold ?? undefined,
          });
          await fs.rm(tempSpritesheet, { force: true });
        }

        if (shouldExportFrames) {
          exportFramesDir = path.join(exportDir, "frames");
          await fs.rm(exportFramesDir, { recursive: true, force: true });
          const extracted = await extractFrames({
            spritesheetPath: exportSpritesheet,
            outputDir: exportFramesDir,
            frameWidth: resolvedFrameWidth,
            frameHeight: resolvedFrameHeight,
            frameCount: resolvedFrameCount,
          });

          const indexJson = buildIndexJson(
            extracted.frames.map((frame) => ({
              filename: frame.filename,
              frameIndex: frame.frameIndex,
            })),
            fpsValue
          );

          await fs.writeFile(
            path.join(exportFramesDir, "index.json"),
            JSON.stringify(indexJson, null, 2)
          );
          pngSequenceUrl = `/api/storage/animations/${animationId}/exports/frames/`;
        }
      } else {
        const layout = await getSpritesheetLayout(finalSpritesheetPath, {
          frameWidth: resolvedFrameWidth,
          frameHeight: resolvedFrameHeight,
        });
        let sourceFramesDir = finalFramesDir;
        let orderedFrameFiles = sourceFrameFiles;
        let tempSourceDir: string | null = null;

        if (orderedFrameFiles.length === 0) {
          tempSourceDir = path.join(exportDir, `frames_source_${Date.now()}`);
          const extracted = await extractFrames({
            spritesheetPath: finalSpritesheetPath,
            outputDir: tempSourceDir,
            frameWidth: resolvedFrameWidth,
            frameHeight: resolvedFrameHeight,
            frameCount: resolvedFrameCount,
          });
          sourceFramesDir = tempSourceDir;
          orderedFrameFiles = extracted.frames.map((frame) => frame.filename);
        }

        const cleanedFramesDir = shouldExportFrames
          ? path.join(exportDir, "frames")
          : path.join(exportDir, `frames_cleaned_${Date.now()}`);
        await fs.rm(cleanedFramesDir, { recursive: true, force: true });

        await removeBackgroundWithPython({
          inputPath: sourceFramesDir,
          outputPath: cleanedFramesDir,
        });

        if (applyAlphaThreshold) {
          const cleanedFiles = await loadFrameFiles(cleanedFramesDir);
          for (const frameFile of cleanedFiles) {
            const framePath = path.join(cleanedFramesDir, frameFile);
            await processImageFile({
              inputPath: framePath,
              outputPath: framePath,
              alphaThreshold: sanitizedThreshold ?? undefined,
            });
          }
        }

        await composeSpritesheet({
          framesDir: cleanedFramesDir,
          outputPath: exportSpritesheet,
          layout,
        });

        if (shouldExportFrames) {
          exportFramesDir = cleanedFramesDir;
          const indexJson = buildIndexJson(
            orderedFrameFiles.map((file) => ({
              filename: file,
              frameIndex: frameIndexFromName(file),
            })),
            fpsValue
          );
          await fs.writeFile(
            path.join(exportFramesDir, "index.json"),
            JSON.stringify(indexJson, null, 2)
          );
          pngSequenceUrl = `/api/storage/animations/${animationId}/exports/frames/`;
        } else {
          await fs.rm(cleanedFramesDir, { recursive: true, force: true });
        }

        if (tempSourceDir) {
          await fs.rm(tempSourceDir, { recursive: true, force: true });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Background removal failed.";
      logger.error("Background removal failed during export", {
        animationId,
        error: message,
        mode: backgroundRemovalMode,
      });
      throwPipelineError(message, 500);
    }
  } else if (applyAlphaThreshold) {
    await processImageFile({
      inputPath: finalSpritesheetPath,
      outputPath: exportSpritesheet,
      alphaThreshold: sanitizedThreshold ?? undefined,
    });
  } else {
    await fs.copyFile(finalSpritesheetPath, exportSpritesheet);
  }

  const hashPath = path.join(exportDir, "spritesheet-hash.json");
  const arrayPath = path.join(exportDir, "spritesheet-array.json");
  await fs.writeFile(hashPath, JSON.stringify(hashJson, null, 2));
  await fs.writeFile(arrayPath, JSON.stringify(arrayJson, null, 2));

  if (!applyBackgroundRemoval && shouldExportFrames) {
    exportFramesDir = path.join(exportDir, "frames");
    await fs.rm(exportFramesDir, { recursive: true, force: true });
    await fs.mkdir(exportFramesDir, { recursive: true });

    for (const frameFile of sourceFrameFiles) {
      const inputPath = path.join(finalFramesDir, frameFile);
      const outputPath = path.join(exportFramesDir, frameFile);
      if (applyAlphaThreshold) {
        await processImageFile({
          inputPath,
          outputPath,
          alphaThreshold: sanitizedThreshold ?? undefined,
        });
      } else {
        await fs.copyFile(inputPath, outputPath);
      }
    }

    const indexJson = buildIndexJson(
      sourceFrameFiles.map((file) => ({
        filename: file,
        frameIndex: frameIndexFromName(file),
      })),
      fpsValue
    );
    await fs.writeFile(
      path.join(exportFramesDir, "index.json"),
      JSON.stringify(indexJson, null, 2)
    );
    pngSequenceUrl = `/api/storage/animations/${animationId}/exports/frames/`;
  }

  const exportedAt = new Date().toISOString();
  const updated = {
    ...animation,
    exports: {
      spritesheetUrl: `/api/storage/animations/${animationId}/exports/${exportFilename}`,
      asepriteJsonHashUrl: `/api/storage/animations/${animationId}/exports/spritesheet-hash.json`,
      asepriteJsonArrayUrl: `/api/storage/animations/${animationId}/exports/spritesheet-array.json`,
      pngSequenceUrl,
      pngSequenceIndexUrl: pngSequenceUrl
        ? `/api/storage/animations/${animationId}/exports/frames/index.json`
        : undefined,
      normalized: normalizedExport,
      backgroundRemoved: applyBackgroundRemoval || undefined,
      backgroundRemovalMode: applyBackgroundRemoval ? backgroundRemovalMode : undefined,
      alphaThreshold: applyAlphaThreshold ? sanitizedThreshold ?? undefined : undefined,
      lastExportedAt: exportedAt,
    },
    updatedAt: exportedAt,
  };

  await writeJson(filePath, updated);

  logger.info("Export pipeline: completed", {
    animationId,
    exportFilename,
    normalized: normalizedExport,
    backgroundRemoved: applyBackgroundRemoval,
    frameCount: resolvedFrameCount ?? sourceFrameFiles.length,
  });

  return {
    animation: updated,
    exportedAt,
    artifacts: {
      exportDir,
      spritesheetPath: exportSpritesheet,
      spritesheetFilename: exportFilename,
      hashPath,
      arrayPath,
      framesDir: exportFramesDir,
      pngSequenceUrl,
      normalized: normalizedExport,
      backgroundRemoved: applyBackgroundRemoval,
      backgroundRemovalMode,
      alphaThreshold: applyAlphaThreshold ? sanitizedThreshold ?? null : null,
    },
    aseprite: {
      arrayJson,
      hashJson,
    },
  };
}
