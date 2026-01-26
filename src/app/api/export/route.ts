import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import path from "path";
import archiver from "archiver";
import sharp from "sharp";
import { buildAsepriteJson, inferFrameSize, loadPngDimensions } from "@/lib/aseprite";
import { fileExists, readJson, storagePath, writeJson } from "@/lib/storage";
import { getProjectSettings } from "@/lib/projectSettings";
import {
  normalizeFrameBatch,
  getEffectiveSettings,
} from "@/lib/canvasNormalization";
import { composeSpritesheet } from "@/lib/spritesheet";
import type { Animation as AnimationModel, Character, AnchorPoint } from "@/types";

export const runtime = "nodejs";

const DEFAULT_BG_KEY = "#FF00FF";
const KEY_TOLERANCE = 12;

function parseSize(size: string) {
  const [w, h] = size.split("x").map((value) => Number(value));
  const width = Number.isFinite(w) ? w : 0;
  const height = Number.isFinite(h) ? h : 0;
  return { width, height };
}

function parseHexColor(color: string) {
  const cleaned = color.replace("#", "").trim();
  const target = cleaned.length === 6 ? cleaned : "FF00FF";
  const r = Number.parseInt(target.slice(0, 2), 16);
  const g = Number.parseInt(target.slice(2, 4), 16);
  const b = Number.parseInt(target.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 255,
    g: Number.isFinite(g) ? g : 0,
    b: Number.isFinite(b) ? b : 255,
  };
}

function clampAlphaThreshold(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(255, Math.max(0, Math.round(numeric)));
}

async function resolveBgKeyColor(animation: AnimationModel) {
  let bgKeyColor = DEFAULT_BG_KEY;
  const generationSize = String(animation.generationSize ?? "");
  const { width, height } = parseSize(generationSize);
  const characterId = String(animation.characterId ?? "");
  const referenceImageId = String(animation.referenceImageId ?? "default");
  if (width && height && characterId) {
    const specPath = storagePath(
      "characters",
      characterId,
      "working",
      `reference_${referenceImageId}_${width}x${height}.json`
    );
    if (await fileExists(specPath)) {
      const spec = await readJson<{ bgKeyColor?: string }>(specPath);
      if (spec?.bgKeyColor) {
        bgKeyColor = spec.bgKeyColor;
      }
    }
  }
  return bgKeyColor;
}

async function processImageFile(options: {
  inputPath: string;
  outputPath: string;
  keyColor?: string;
  keyTolerance?: number;
  alphaThreshold?: number;
}) {
  const { inputPath, outputPath, keyColor, keyTolerance, alphaThreshold } = options;
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const target = keyColor ? parseHexColor(keyColor) : null;
  const tolerance = keyTolerance ?? KEY_TOLERANCE;

  for (let i = 0; i < data.length; i += 4) {
    if (target) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const within =
        Math.abs(r - target.r) <= tolerance &&
        Math.abs(g - target.g) <= tolerance &&
        Math.abs(b - target.b) <= tolerance;
      if (within) {
        data[i + 3] = 0;
      }
    }
    if (typeof alphaThreshold === "number") {
      data[i + 3] = data[i + 3] <= alphaThreshold ? 0 : 255;
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath);
}

export async function POST(request: Request) {
  const payload = await request.json();
  const { animationId, normalize, removeBackground, alphaThreshold } = payload ?? {};

  if (!animationId) {
    return Response.json({ error: "Missing animationId." }, { status: 400 });
  }

  const filePath = storagePath("animations", animationId, "animation.json");
  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const animation = await readJson<AnimationModel>(filePath);
  const spritesheetUrl = animation.generatedSpritesheet as string | undefined;

  if (!spritesheetUrl) {
    return Response.json(
      { error: "No generated spritesheet found. Run generation first." },
      { status: 400 }
    );
  }

  const filename = spritesheetUrl.split("/").pop();
  if (!filename) {
    return Response.json({ error: "Invalid spritesheet path." }, { status: 400 });
  }

  const spritesheetPath = storagePath("animations", animationId, "generated", filename);
  if (!(await fileExists(spritesheetPath))) {
    return Response.json({ error: "Spritesheet file missing." }, { status: 404 });
  }

  if (path.extname(spritesheetPath).toLowerCase() !== ".png") {
    return Response.json(
      { error: "Spritesheet must be PNG to generate Aseprite metadata." },
      { status: 400 }
    );
  }

  const exportDir = storagePath("animations", animationId, "exports");
  await fs.mkdir(exportDir, { recursive: true });

  // Get original frame dimensions
  let frameWidth =
    Number(animation.spritesheetLayout?.frameWidth ?? animation.frameWidth ?? 0) ||
    Number(animation.spritesheetLayout?.frameSize ?? animation.spriteSize ?? 0);
  let frameHeight =
    Number(animation.spritesheetLayout?.frameHeight ?? animation.frameHeight ?? 0) ||
    Number(animation.spritesheetLayout?.frameSize ?? animation.spriteSize ?? 0);

  const generatedFrames = animation.generatedFrames ?? [];
  const frameCount = generatedFrames.length || animation.actualFrameCount || 0;

  // Handle normalization if requested
  let finalSpritesheetPath = spritesheetPath;
  let finalFramesDir = storagePath("animations", animationId, "generated", "frames");
  let normalizedExport = false;
  const sanitizedThreshold = clampAlphaThreshold(alphaThreshold);
  const applyAlphaThreshold =
    typeof sanitizedThreshold === "number" && sanitizedThreshold > 0;
  const applyBackgroundRemoval = Boolean(removeBackground);
  const applyExportCleanup = applyAlphaThreshold || applyBackgroundRemoval;
  const bgKeyColor = applyBackgroundRemoval
    ? await resolveBgKeyColor(animation)
    : DEFAULT_BG_KEY;

  if (normalize) {
    // Load project settings and character settings
    const projectSettings = await getProjectSettings();
    let characterSettings: { anchor?: AnchorPoint; scale?: number } | undefined;

    if (animation.characterId) {
      const characterPath = storagePath(
        "characters",
        animation.characterId,
        "character.json"
      );
      if (await fileExists(characterPath)) {
        const character = await readJson<Character>(characterPath);
        characterSettings = {
          anchor: character.anchor,
          scale: character.scale,
        };
      }
    }

    const settings = getEffectiveSettings(projectSettings, characterSettings);

    // Normalize frames
    const framesDir = storagePath("animations", animationId, "generated", "frames");
    const normalizedDir = path.join(exportDir, "normalized");
    await fs.mkdir(normalizedDir, { recursive: true });

    try {
      const frameFiles = await fs.readdir(framesDir);
      const orderedFrames = frameFiles
        .filter((f) => f.endsWith(".png"))
        .sort((a, b) => {
          const matchA = a.match(/frame_(\d+)\.png/);
          const matchB = b.match(/frame_(\d+)\.png/);
          return (matchA ? Number(matchA[1]) : 0) - (matchB ? Number(matchB[1]) : 0);
        });

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

        // Update frame dimensions to normalized canvas size
        frameWidth = settings.canvasWidth;
        frameHeight = settings.canvasHeight;
        finalFramesDir = normalizedDir;
        normalizedExport = true;

        // Compose new spritesheet from normalized frames
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
      console.error("Normalization failed, falling back to original:", err);
    }
  }

  const { width, height } = await loadPngDimensions(finalSpritesheetPath);
  const preferredSize = Number(animation.spriteSize ?? 48);
  const frameSize =
    frameWidth && frameHeight
      ? undefined
      : inferFrameSize(width, height, preferredSize);

  // Determine export filename based on normalization
  const exportFilename = normalizedExport
    ? `spritesheet_normalized.png`
    : filename;

  const { arrayJson, hashJson } = buildAsepriteJson({
    imageName: exportFilename,
    imageWidth: width,
    imageHeight: height,
    frameSize,
    frameWidth: frameWidth || frameSize,
    frameHeight: frameHeight || frameSize,
    fps: Number(animation.fps ?? 12),
    frameCount: typeof frameCount === "number" ? frameCount : undefined,
  });

  const exportSpritesheet = path.join(exportDir, exportFilename);
  if (applyExportCleanup) {
    await processImageFile({
      inputPath: finalSpritesheetPath,
      outputPath: exportSpritesheet,
      keyColor: applyBackgroundRemoval ? bgKeyColor : undefined,
      alphaThreshold: applyAlphaThreshold ? sanitizedThreshold ?? undefined : undefined,
    });
  } else {
    await fs.copyFile(finalSpritesheetPath, exportSpritesheet);
  }

  const hashPath = path.join(exportDir, "spritesheet-hash.json");
  const arrayPath = path.join(exportDir, "spritesheet-array.json");
  await fs.writeFile(hashPath, JSON.stringify(hashJson, null, 2));
  await fs.writeFile(arrayPath, JSON.stringify(arrayJson, null, 2));

  let pngSequenceUrl: string | undefined;
  let exportFramesDir: string | null = null;
  try {
    const frameFiles = await fs.readdir(finalFramesDir);
    if (frameFiles.length > 0) {
      exportFramesDir = path.join(exportDir, "frames");
      await fs.mkdir(exportFramesDir, { recursive: true });
      const ordered = frameFiles
        .filter((file) => file.endsWith(".png"))
        .sort((a, b) => {
          const matchA = a.match(/frame_(\d+)\.png/);
          const matchB = b.match(/frame_(\d+)\.png/);
          const indexA = matchA ? Number(matchA[1]) : 0;
          const indexB = matchB ? Number(matchB[1]) : 0;
          return indexA - indexB;
        });

      const duration = Math.round(1000 / Math.max(1, Number(animation.fps ?? 12)));
      const indexJson = {
        frames: ordered.map((file) => {
          const match = file.match(/frame_(\d+)\.png/);
          const frameIndex = match ? Number(match[1]) : 0;
          return { filename: file, frameIndex, duration };
        }),
        meta: {
          frameRate: Number(animation.fps ?? 12),
        },
      };

      for (const frameFile of ordered) {
        const inputPath = path.join(finalFramesDir, frameFile);
        const outputPath = path.join(exportFramesDir, frameFile);
        if (applyExportCleanup) {
          await processImageFile({
            inputPath,
            outputPath,
            keyColor: applyBackgroundRemoval ? bgKeyColor : undefined,
            alphaThreshold: applyAlphaThreshold ? sanitizedThreshold ?? undefined : undefined,
          });
        } else {
          await fs.copyFile(inputPath, outputPath);
        }
      }

      await fs.writeFile(
        path.join(exportFramesDir, "index.json"),
        JSON.stringify(indexJson, null, 2)
      );
      pngSequenceUrl = `/api/storage/animations/${animationId}/exports/frames/`;
    }
  } catch {
    // No frames folder available.
  }

  const zipFilename = `export_${animationId}.zip`;
  const zipPath = path.join(exportDir, zipFilename);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const output = createWriteStream(zipPath);

  const archivePromise = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(output);
  archive.file(exportSpritesheet, { name: exportFilename });
  archive.file(hashPath, { name: "spritesheet-hash.json" });
  archive.file(arrayPath, { name: "spritesheet-array.json" });
  if (exportFramesDir) {
    archive.directory(exportFramesDir, "frames");
  }

  await archive.finalize();
  await archivePromise;

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
      zipBundleUrl: `/api/storage/animations/${animationId}/exports/${zipFilename}`,
      normalized: normalizedExport,
      backgroundRemoved: applyBackgroundRemoval || undefined,
      alphaThreshold: applyAlphaThreshold ? sanitizedThreshold ?? undefined : undefined,
    },
    updatedAt: new Date().toISOString(),
  };

  await writeJson(filePath, updated);

  return Response.json({ animation: updated });
}
