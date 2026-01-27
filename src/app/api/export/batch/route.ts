import { createWriteStream, promises as fs } from "fs";
import path from "path";
import archiver from "archiver";
import { logger } from "@/lib/logger";
import { parseBoolean } from "@/lib/parsing";
import {
  ExportPipelineError,
  buildZipAsepriteJson,
  clampAlphaThreshold,
  parseBackgroundRemovalMode,
  runExportPipeline,
} from "@/lib/exportPipeline";
import { storagePath } from "@/lib/storage";
import type { BackgroundRemovalMode } from "@/types";

export const runtime = "nodejs";

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function resolveFolderName(
  animationName: string,
  animationId: string,
  used: Set<string>
): string {
  const baseFromName = sanitizeFilename(animationName);
  const baseFromId = sanitizeFilename(animationId);
  const base = baseFromName || baseFromId || "animation";

  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  const suffixFromId = baseFromId && baseFromId !== base ? baseFromId : "";
  if (suffixFromId) {
    const candidate = `${base}_${suffixFromId}`.slice(0, 50);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  let counter = 2;
  while (used.has(`${base}_${counter}`)) {
    counter += 1;
  }
  const unique = `${base}_${counter}`.slice(0, 50);
  used.add(unique);
  return unique;
}

interface ExportResult {
  animationId: string;
  animationName: string;
  success: boolean;
  error?: string;
  files?: {
    spritesheet: string;
    hashJson: string;
    arrayJson: string;
    framesDir?: string;
    zipHashJson?: string;
    zipArrayJson?: string;
  };
}

async function exportSingleAnimation(
  animationId: string,
  options: {
    normalize: boolean;
    removeBackground: boolean;
    backgroundRemovalMode: BackgroundRemovalMode;
    alphaThreshold: number | null;
  }
): Promise<ExportResult> {
  try {
    const result = await runExportPipeline(animationId, options);
    const animationName = result.animation.name ?? animationId;
    const zipJson = buildZipAsepriteJson(
      result.aseprite.arrayJson,
      result.aseprite.hashJson,
      "spritesheet.png"
    );

    return {
      animationId,
      animationName,
      success: true,
      files: {
        spritesheet: result.artifacts.spritesheetPath,
        hashJson: result.artifacts.hashPath,
        arrayJson: result.artifacts.arrayPath,
        framesDir: result.artifacts.framesDir ?? undefined,
        zipHashJson: zipJson.zipHashJson,
        zipArrayJson: zipJson.zipArrayJson,
      },
    };
  } catch (error) {
    if (error instanceof ExportPipelineError) {
      return {
        animationId,
        animationName: animationId,
        success: false,
        error: error.message,
      };
    }
    const message = error instanceof Error ? error.message : "Export failed";
    return {
      animationId,
      animationName: animationId,
      success: false,
      error: message,
    };
  }
}

export async function POST(request: Request) {
  let payload: {
    animationIds?: string[];
    characterId?: string;
    characterName?: string;
    normalize?: string | number | boolean | null;
    removeBackground?: string | number | boolean | null;
    backgroundRemovalMode?: string | null;
    alphaThreshold?: number | string | null;
  } = {};

  try {
    payload = await request.json();
  } catch (error) {
    logger.warn("Batch export: invalid JSON payload", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const animationIds = Array.isArray(payload?.animationIds) ? payload.animationIds : [];
  const characterId = payload?.characterId;
  const characterName = payload?.characterName;
  const normalize = parseBoolean(payload?.normalize ?? false);
  const removeBackground = parseBoolean(payload?.removeBackground ?? false);
  const removalModeRaw = payload?.backgroundRemovalMode ?? undefined;
  const removalModeParsed = parseBackgroundRemovalMode(removalModeRaw);
  if (removeBackground && removalModeRaw !== undefined && !removalModeParsed) {
    return Response.json(
      { error: "Invalid backgroundRemovalMode. Use spritesheet or per-frame." },
      { status: 400 }
    );
  }
  const backgroundRemovalMode: BackgroundRemovalMode = removeBackground
    ? removalModeParsed ?? "spritesheet"
    : "spritesheet";
  const alphaThreshold = clampAlphaThreshold(payload?.alphaThreshold);

  if (animationIds.length === 0) {
    logger.warn("Batch export: missing animationIds", {
      characterId,
      characterName,
    });
    return Response.json({ error: "Missing or empty animationIds array." }, { status: 400 });
  }

  const results: ExportResult[] = [];

  logger.info("Batch export: started", {
    characterId,
    characterName,
    animationCount: animationIds.length,
    normalize,
    removeBackground,
    backgroundRemovalMode,
  });

  for (const animationId of animationIds) {
    try {
      const result = await exportSingleAnimation(animationId, {
        normalize,
        removeBackground,
        backgroundRemovalMode,
        alphaThreshold,
      });
      if (!result.success) {
        logger.warn("Batch export: animation export failed", {
          animationId,
          error: result.error,
        });
      }
      results.push(result);
    } catch (err) {
      logger.error("Batch export: animation export threw", {
        animationId,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        animationId,
        animationName: "Unknown",
        success: false,
        error: err instanceof Error ? err.message : "Export failed",
      });
    }
  }

  const successful = results.filter((r) => r.success && r.files);

  if (successful.length === 0) {
    logger.warn("Batch export: no successful exports", {
      animationCount: animationIds.length,
      characterId,
    });
    return Response.json(
      { error: "No animations could be exported.", results },
      { status: 400 }
    );
  }

  // Create combined ZIP for the character
  const safeName = sanitizeFilename(characterName || characterId || "batch") || "batch";
  const timestamp = Date.now();
  const batchExportDir = storagePath("exports", "batch");
  await fs.mkdir(batchExportDir, { recursive: true });

  const zipFilename = `${safeName}_all_animations_${timestamp}.zip`;
  const zipPath = path.join(batchExportDir, zipFilename);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const output = createWriteStream(zipPath);

  const archivePromise = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(output);
  const usedFolders = new Set<string>();

  for (const result of successful) {
    if (!result.files) continue;
    const animFolder = resolveFolderName(result.animationName, result.animationId, usedFolders);

    archive.file(result.files.spritesheet, { name: `${animFolder}/spritesheet.png` });

    if (result.files.zipHashJson && result.files.zipArrayJson) {
      archive.append(result.files.zipHashJson, { name: `${animFolder}/spritesheet-hash.json` });
      archive.append(result.files.zipArrayJson, { name: `${animFolder}/spritesheet-array.json` });
    } else {
      archive.file(result.files.hashJson, { name: `${animFolder}/spritesheet-hash.json` });
      archive.file(result.files.arrayJson, { name: `${animFolder}/spritesheet-array.json` });
    }

    if (result.files.framesDir) {
      archive.directory(result.files.framesDir, `${animFolder}/frames`);
    }
  }

  try {
    await archive.finalize();
    await archivePromise;
  } catch (error) {
    logger.error("Batch export: failed to finalize zip", {
      zipPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Failed to finalize export zip." }, { status: 500 });
  }

  const zipUrl = `/api/storage/exports/batch/${zipFilename}`;
  logger.info("Batch export: completed", {
    exported: successful.length,
    failed: results.length - successful.length,
    zipPath,
  });

  return Response.json({
    success: true,
    exported: successful.length,
    failed: results.length - successful.length,
    results,
    zipUrl,
  });
}
