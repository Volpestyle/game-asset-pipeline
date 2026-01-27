import { createWriteStream } from "fs";
import path from "path";
import archiver from "archiver";
import { parseBoolean } from "@/lib/parsing";
import {
  ExportPipelineError,
  clampAlphaThreshold,
  parseBackgroundRemovalMode,
  runExportPipeline,
} from "@/lib/exportPipeline";
import { logger } from "@/lib/logger";
import { storagePath, writeJson } from "@/lib/storage";
import type { BackgroundRemovalMode } from "@/types";

export const runtime = "nodejs";

type ExportPayload = {
  animationId?: string;
  normalize?: string | number | boolean | null;
  removeBackground?: string | number | boolean | null;
  backgroundRemovalMode?: string | null;
  alphaThreshold?: number | string | null;
};

export async function POST(request: Request) {
  let payload: ExportPayload = {};
  try {
    payload = await request.json();
  } catch (error) {
    logger.warn("Export: invalid JSON payload", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    payload = {};
  }

  const animationId = typeof payload.animationId === "string" ? payload.animationId : "";
  const normalize = parseBoolean(payload.normalize ?? false);
  const removeBackground = parseBoolean(payload.removeBackground ?? false);
  const alphaThreshold = clampAlphaThreshold(payload.alphaThreshold ?? null);
  const applyBackgroundRemoval = removeBackground;

  if (!animationId) {
    return Response.json({ error: "Missing animationId." }, { status: 400 });
  }

  const backgroundRemovalModeRaw = payload.backgroundRemovalMode;
  const removalModeFromPayload = parseBackgroundRemovalMode(backgroundRemovalModeRaw);
  if (applyBackgroundRemoval && backgroundRemovalModeRaw !== undefined && !removalModeFromPayload) {
    return Response.json(
      { error: "Invalid backgroundRemovalMode. Use spritesheet or per-frame." },
      { status: 400 }
    );
  }
  const backgroundRemovalMode: BackgroundRemovalMode = applyBackgroundRemoval
    ? removalModeFromPayload ?? "spritesheet"
    : "spritesheet";
  try {
    const result = await runExportPipeline(animationId, {
      normalize,
      removeBackground,
      backgroundRemovalMode,
      alphaThreshold,
    });

    const zipFilename = `export_${animationId}.zip`;
    const zipPath = path.join(result.artifacts.exportDir, zipFilename);
    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = createWriteStream(zipPath);

    const archivePromise = new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      output.on("error", reject);
      archive.on("error", reject);
    });

    archive.pipe(output);
    archive.file(result.artifacts.spritesheetPath, { name: result.artifacts.spritesheetFilename });
    archive.file(result.artifacts.hashPath, { name: "spritesheet-hash.json" });
    archive.file(result.artifacts.arrayPath, { name: "spritesheet-array.json" });
    if (result.artifacts.framesDir) {
      archive.directory(result.artifacts.framesDir, "frames");
    }

    await archive.finalize();
    await archivePromise;

    const zipBundleUrl = `/api/storage/animations/${animationId}/exports/${zipFilename}`;
    const updated = {
      ...result.animation,
      exports: {
        ...(result.animation.exports ?? {}),
        zipBundleUrl,
        lastExportedAt: result.exportedAt,
      },
      updatedAt: result.exportedAt,
    };
    await writeJson(storagePath("animations", animationId, "animation.json"), updated);

    return Response.json({ animation: updated });
  } catch (error) {
    if (error instanceof ExportPipelineError) {
      const meta = {
        animationId,
        status: error.status,
        error: error.message,
      };
      if (error.status >= 500) {
        logger.error("Export pipeline error", meta);
      } else {
        logger.warn("Export pipeline error", meta);
      }
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Export failed.";
    logger.error("Export pipeline failed", { animationId, error: message });
    return Response.json({ error: message }, { status: 500 });
  }
}
