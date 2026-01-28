import { promises as fs } from "fs";
import path from "path";
import { coerceVideoSizeForModel, getDefaultVideoSize } from "@/lib/ai/soraConstraints";
import { createAnimationVersion } from "@/lib/animationVersions";
import { DEFAULT_BG_KEY } from "@/lib/color";
import { buildGeneratedFramesFromSequence } from "@/lib/frameOps";
import { buildSpritesheetLayout, sortFrameFiles } from "@/lib/frameUtils";
import { logger } from "@/lib/logger";
import { composeSpritesheet } from "@/lib/spritesheet";
import { parseSize } from "@/lib/size";
import {
  ensureDir,
  fileExists,
  readJson,
  storagePath,
  writeJson,
} from "@/lib/storage";
import { extractVideoFrames } from "@/lib/videoFrames";
import type { GeneratedFrame } from "@/types";

export const runtime = "nodejs";

const ALLOWED_FPS = [6, 8, 12, 24];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: "Missing form data." }, { status: 400 });
  }

  const skipRoi = formData.get("skipRoi") === "true";
  const file = formData.get("video");
  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return Response.json({ error: "Missing video file." }, { status: 400 });
  }

  const videoFile = file as File;
  const ext = path.extname(videoFile.name || "").toLowerCase();
  const mime = String(videoFile.type || "");
  if (ext !== ".mp4" && mime !== "video/mp4") {
    return Response.json({ error: "Only MP4 uploads are supported." }, { status: 400 });
  }

  const buffer = Buffer.from(await videoFile.arrayBuffer());
  if (!buffer.length) {
    return Response.json({ error: "Uploaded video is empty." }, { status: 400 });
  }

  const animation = await readJson<Record<string, unknown>>(animationPath);
  const characterId = String(animation.characterId ?? "");

  let frameWidth = Number(animation.frameWidth ?? animation.spriteSize ?? 0);
  let frameHeight = Number(animation.frameHeight ?? animation.spriteSize ?? 0);

  let referenceImageId = "";
  if (characterId) {
    const characterPath = storagePath("characters", characterId, "character.json");
    if (await fileExists(characterPath)) {
      const character = await readJson<Record<string, unknown>>(characterPath);
      const referenceImages =
        (character.referenceImages as Array<Record<string, unknown>>) ?? [];
      const preferredRefId = String(animation.referenceImageId ?? "").trim();
      const selected = preferredRefId
        ? referenceImages.find((image) => String(image.id) === preferredRefId)
        : undefined;
      const primary =
        selected ??
        referenceImages.find((image) => Boolean(image.isPrimary)) ??
        referenceImages[0];
      referenceImageId = String(primary?.id ?? "");

      if (!frameWidth || !frameHeight) {
        frameWidth = Number(character.baseWidth ?? 0);
        frameHeight = Number(character.baseHeight ?? 0);
      }
    }
  }

  if (!frameWidth || !frameHeight) {
    frameWidth = 253;
    frameHeight = 504;
  }

  const requestedFps = Number(animation.extractFps ?? animation.fps ?? 12);
  const extractFps = ALLOWED_FPS.includes(requestedFps) ? requestedFps : 12;
  const loopModeInput = String(animation.loopMode ?? "loop");
  const loopMode = loopModeInput === "pingpong" ? "pingpong" : "loop";
  const sheetColumns = Math.max(1, Number(animation.sheetColumns ?? 6));

  const model = String(animation.generationModel ?? "sora-2");
  const requestedSize = String(
    animation.generationSize ?? getDefaultVideoSize(model)
  );
  const generationSize = coerceVideoSizeForModel(requestedSize, model);
  const generationNote =
    requestedSize !== generationSize
      ? `Adjusted video size to ${generationSize} for ${model}. Imported video.`
      : "Imported video.";

  let bgKeyColor = DEFAULT_BG_KEY;
  let roi: { x: number; y: number; w: number; h: number } | undefined;

  if (characterId && referenceImageId && !skipRoi) {
    const { width, height } = parseSize(generationSize);
    if (width && height) {
      const specPath = storagePath(
        "characters",
        characterId,
        "working",
        `reference_${referenceImageId}_${width}x${height}.json`
      );
      if (await fileExists(specPath)) {
        const spec = await readJson<Record<string, unknown>>(specPath);
        if (typeof spec.bgKeyColor === "string" && spec.bgKeyColor.trim()) {
          bgKeyColor = spec.bgKeyColor.trim();
        }
        if (spec.roi && typeof spec.roi === "object") {
          const roiCandidate = spec.roi as Record<string, unknown>;
          const x = Number(roiCandidate.x);
          const y = Number(roiCandidate.y);
          const w = Number(roiCandidate.w);
          const h = Number(roiCandidate.h);
          if (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(w) &&
            Number.isFinite(h) &&
            w > 0 &&
            h > 0 &&
            x >= 0 &&
            y >= 0
          ) {
            roi = { x, y, w, h };
          }
        }
      }
    }
  }

  const generatedDir = storagePath("animations", id, "generated");
  await ensureDir(generatedDir);
  const videoFilename = `video_import_${Date.now()}.mp4`;
  const videoPath = path.join(generatedDir, videoFilename);
  await fs.writeFile(videoPath, buffer);

  const rawFramesDir = path.join(generatedDir, "frames_raw");
  const framesDir = path.join(generatedDir, "frames");
  try {
    await extractVideoFrames({
      videoPath,
      outputDir: rawFramesDir,
      fps: extractFps,
      frameWidth,
      frameHeight,
      roi,
      padColor: bgKeyColor,
      mode: "pad",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to extract frames.";
    logger.error("Import video: frame extraction failed", {
      animationId: id,
      error: message,
    });
    return Response.json({ error: message }, { status: 500 });
  }

  const rawFiles = sortFrameFiles(await fs.readdir(rawFramesDir));
  if (rawFiles.length === 0) {
    return Response.json(
      { error: "No frames extracted from the uploaded video." },
      { status: 400 }
    );
  }
  let generatedFrames: GeneratedFrame[];
  try {
    generatedFrames = await buildGeneratedFramesFromSequence({
      animationId: id,
      rawFramesDir,
      outputDir: framesDir,
      baseSequence: rawFiles,
      loopMode,
      source: "import",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build frames.";
    logger.error("Import video: failed to build frames", {
      animationId: id,
      error: message,
    });
    return Response.json({ error: message }, { status: 500 });
  }

  const layout = buildSpritesheetLayout({
    frameWidth,
    frameHeight,
    columns: sheetColumns,
    frameCount: generatedFrames.length,
  });

  const spritesheetName = `spritesheet_${Date.now()}_import.png`;
  const spritesheetPath = path.join(generatedDir, spritesheetName);
  await composeSpritesheet({ framesDir, outputPath: spritesheetPath, layout });

  const updated = {
    ...animation,
    status: "complete",
    generationNote,
    generationSize,
    fps: extractFps,
    extractFps,
    frameWidth,
    frameHeight,
    loopMode,
    sheetColumns,
    actualFrameCount: generatedFrames.length,
    generatedFrames,
    generatedSpritesheet: `/api/storage/animations/${id}/generated/${spritesheetName}`,
    spritesheetLayout: layout,
    sourceVideoUrl: `/api/storage/animations/${id}/generated/${videoFilename}`,
    sourceProviderSpritesheetUrl: undefined,
    sourceThumbnailUrl: undefined,
    generationQueue: undefined,
    generationJob: {
      provider: "upload",
      providerJobId: `upload_${Date.now()}`,
      status: "completed",
      progress: 100,
      outputs: {
        videoUrl: `/api/storage/animations/${id}/generated/${videoFilename}`,
      },
    },
    exports: undefined,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(animationPath, updated);
  const { animation: versioned } = await createAnimationVersion(id, {
    name: "Imported video",
    source: "generation",
  });

  return Response.json({ animation: versioned });
}
