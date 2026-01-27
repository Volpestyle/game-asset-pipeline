import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { createPrediction, waitForPrediction } from "@/lib/ai/replicate";
import {
  createVideoJob,
  downloadVideoContent,
  pollVideoJob,
} from "@/lib/ai/openai";
import {
  buildWorkingReference,
  normalizeImageToCanvas,
} from "@/lib/character/workingReference";
import { buildVideoPrompt } from "@/lib/ai/promptBuilder";
import { DEFAULT_BG_KEY, parseHexColor } from "@/lib/color";
import { fileToDataUrl, bufferToDataUrl } from "@/lib/dataUrl";
import { runFfmpeg } from "@/lib/ffmpeg";
import { buildSpritesheetLayout, sortFrameFiles } from "@/lib/frameUtils";
import {
  normalizeSegmentPlan,
  sampleEvenly,
  selectFrameIndices,
  validateSegmentPlan,
  type SegmentInput,
  type SegmentPlan,
} from "@/lib/generationUtils";
import { logger } from "@/lib/logger";
import { getShutdownSignal } from "@/lib/shutdown";
import { composeSpritesheet } from "@/lib/spritesheet";
import { parseSize } from "@/lib/size";
import {
  ensureDir,
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import { createAnimationVersion } from "@/lib/animationVersions";
import {
  coerceVideoSizeForModel,
  getDefaultVideoSize,
  getDefaultVideoSeconds,
  coerceVideoSecondsForModel,
  getVideoModelConfig,
  getReplicateModelForVideo,
  getVertexModelForVideo,
  getVideoAspectRatio,
  getVideoResolution,
  getVideoModelSupportsContinuation,
} from "@/lib/ai/soraConstraints";
import {
  generateVertexVeoContinuation,
  getVertexVeoAvailability,
} from "@/lib/ai/vertexVeo";
import type { GenerationQueueItem, GeneratedFrame, Keyframe } from "@/types";

export const runtime = "nodejs";

const VEO_CONTINUATION_SECONDS = 7;

async function resolveLocalImagePath(url?: string) {
  if (!url) return null;
  const localPath = storagePathFromUrl(url);
  if (localPath && (await fileExists(localPath))) {
    return localPath;
  }
  return null;
}

async function resolveImageDimensions(filePath: string) {
  try {
    const metadata = await sharp(filePath).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
  } catch {
    // ignore
  }
  return null;
}

type InputClampTarget = {
  width: number;
  height: number;
  label: string;
};

function getInputClampTarget(model: string, generationSize: string): InputClampTarget {
  const parsed = parseSize(generationSize, { width: 1280, height: 720 });
  const isPortrait = parsed.height >= parsed.width;
  if (model === "veo-3.1" || model === "veo-3.1-fast") {
    return isPortrait
      ? { width: 720, height: 1280, label: "720x1280" }
      : { width: 1280, height: 720, label: "1280x720" };
  }
  return {
    width: parsed.width,
    height: parsed.height,
    label: `${parsed.width}x${parsed.height}`,
  };
}

async function clampInputImageForModel(options: {
  animationId: string;
  model: string;
  generationSize: string;
  imagePath: string;
  kind: "start" | "end";
}) {
  const target = getInputClampTarget(options.model, options.generationSize);
  const dims = await resolveImageDimensions(options.imagePath);
  if (!dims) {
    logger.warn("Unable to read input image dimensions; skipping clamp", {
      animationId: options.animationId,
      imagePath: options.imagePath,
      kind: options.kind,
      target,
    });
    return options.imagePath;
  }

  if (dims.width <= target.width && dims.height <= target.height) {
    return options.imagePath;
  }

  const outputDir = storagePath(
    "animations",
    options.animationId,
    "generation",
    "normalized"
  );
  await fs.mkdir(outputDir, { recursive: true });
  const base = path.basename(options.imagePath, path.extname(options.imagePath));
  const outputPath = path.join(
    outputDir,
    `${options.kind}_${base}_${target.label}.png`
  );

  if (await fileExists(outputPath)) {
    return outputPath;
  }

  try {
    await sharp(options.imagePath)
      .resize(target.width, target.height, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: "nearest",
      })
      .png()
      .toFile(outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to clamp input image", {
      animationId: options.animationId,
      imagePath: options.imagePath,
      outputPath,
      kind: options.kind,
      target,
      error: message,
    });
    throw new Error(`Failed to downscale ${options.kind} image for ${options.model}.`);
  }

  logger.info("Clamped input image for model", {
    animationId: options.animationId,
    kind: options.kind,
    original: dims,
    target,
    outputPath,
  });

  return outputPath;
}


async function buildKeyframeCanvas(options: {
  sourcePath: string;
  spec: {
    canvasW: number;
    canvasH: number;
    roi: { x: number; y: number; w: number; h: number };
    bgKeyColor: string;
  };
}) {
  const { spec } = options;
  const sprite = await sharp(options.sourcePath)
    .resize(spec.roi.w, spec.roi.h, {
      kernel: "nearest",
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const bg = parseHexColor(spec.bgKeyColor);
  const composed = sharp({
    create: {
      width: spec.canvasW,
      height: spec.canvasH,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 },
    },
  }).composite([{ input: sprite, left: spec.roi.x, top: spec.roi.y }]);
  return composed.png().toBuffer();
}


async function extractVideoFrames(options: {
  videoPath: string;
  outputDir: string;
  fps: number;
  roi: { x: number; y: number; w: number; h: number };
  frameWidth: number;
  frameHeight: number;
}) {
  await fs.rm(options.outputDir, { recursive: true, force: true });
  await fs.mkdir(options.outputDir, { recursive: true });
  const filters = [
    `crop=${options.roi.w}:${options.roi.h}:${options.roi.x}:${options.roi.y}`,
    `scale=${options.frameWidth}:${options.frameHeight}:flags=neighbor`,
    `fps=${options.fps}`,
  ];
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    options.videoPath,
    "-vf",
    filters.join(","),
    "-start_number",
    "0",
    path.join(options.outputDir, "frame_%03d.png"),
  ];
  await runFfmpeg(args);
}

async function normalizeVeoContinuationVideo(options: {
  inputPath: string;
  outputDir: string;
  aspectRatio: "16:9" | "9:16";
  resolution: "720p" | "1080p";
}) {
  await fs.mkdir(options.outputDir, { recursive: true });
  const isLandscape = options.aspectRatio === "16:9";
  const is1080 = options.resolution === "1080p";
  const width = isLandscape ? (is1080 ? 1920 : 1280) : (is1080 ? 1080 : 720);
  const height = isLandscape ? (is1080 ? 1080 : 720) : (is1080 ? 1920 : 1280);
  const outputPath = path.join(options.outputDir, `veo_continuation_${Date.now()}.mp4`);
  const filters = [
    "fps=24",
    `scale=${width}:${height}:flags=bicubic`,
    "format=yuv420p",
  ];
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    options.inputPath,
    "-vf",
    filters.join(","),
    "-an",
    outputPath,
  ];
  await runFfmpeg(args);
  return outputPath;
}


async function ensureWorkingReference(options: {
  character: Record<string, unknown>;
  referencePath: string;
  referenceImageId: string;
  generationSize: string;
}) {
  const character = options.character;
  const { width, height } = parseSize(options.generationSize, {
    width: 1024,
    height: 1792,
  });

  // Cache key includes both reference image ID and canvas size
  const baseName = `reference_${options.referenceImageId}_${width}x${height}`;
  const outputPath = storagePath(
    "characters",
    String(character.id),
    "working",
    `${baseName}.png`
  );
  const specPath = storagePath(
    "characters",
    String(character.id),
    "working",
    `${baseName}.json`
  );

  // Check if this specific working reference already exists
  if (await fileExists(outputPath) && await fileExists(specPath)) {
    const workingSpec = await readJson<{
      canvasW: number;
      canvasH: number;
      scale: number;
      roi: { x: number; y: number; w: number; h: number };
      bgKeyColor: string;
    }>(specPath);
    return { workingPath: outputPath, workingSpec };
  }

  const result = await buildWorkingReference({
    sourcePath: options.referencePath,
    outputPath,
    canvasW: width,
    canvasH: height,
  });

  // Store spec alongside the image for future cache hits
  await writeJson(specPath, result.workingSpec);

  return { workingPath: outputPath, workingSpec: result.workingSpec };
}

async function normalizeGenerationFrame(options: {
  animationId: string;
  kind: "start" | "end";
  sourcePath: string;
  generationSize: string;
  bgKeyColor?: string;
}) {
  const { width, height } = parseSize(options.generationSize, {
    width: 1024,
    height: 1792,
  });
  const outputDir = storagePath(
    "animations",
    options.animationId,
    "generation",
    "normalized"
  );
  await fs.mkdir(outputDir, { recursive: true });
  const baseName = path.basename(
    options.sourcePath,
    path.extname(options.sourcePath)
  );
  const outputPath = path.join(
    outputDir,
    `${options.kind}_${baseName}_${width}x${height}.png`
  );
  if (await fileExists(outputPath)) {
    return outputPath;
  }
  await normalizeImageToCanvas({
    sourcePath: options.sourcePath,
    outputPath,
    canvasW: width,
    canvasH: height,
    bgKeyColor: options.bgKeyColor,
  });
  return outputPath;
}

async function resolveSegmentImagePath(options: {
  animationId: string;
  imageUrl: string;
  referenceUrl: string;
  workingPath: string;
  generationSize: string;
  bgKeyColor?: string;
  kind: "start" | "end";
}) {
  if (options.imageUrl === options.referenceUrl) {
    return options.workingPath;
  }
  const localPath = storagePathFromUrl(options.imageUrl);
  if (!localPath || !(await fileExists(localPath))) {
    throw new Error(`Invalid ${options.kind} image path.`);
  }
  return normalizeGenerationFrame({
    animationId: options.animationId,
    kind: options.kind,
    sourcePath: localPath,
    generationSize: options.generationSize,
    bgKeyColor: options.bgKeyColor,
  });
}

async function runGeneration(animationId: string, segments?: SegmentInput[]) {
  const filePath = storagePath("animations", animationId, "animation.json");
  let animation = await readJson<Record<string, unknown>>(filePath);

  const updateAnimation = async (patch: Record<string, unknown>) => {
    animation = {
      ...animation,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await writeJson(filePath, animation);
  };

  const updateGenerationJob = async (patch: Record<string, unknown>) => {
    const currentJob =
      (animation.generationJob as Record<string, unknown> | undefined) ?? {};
    animation = {
      ...animation,
      generationJob: {
        ...currentJob,
        ...patch,
      },
      updatedAt: new Date().toISOString(),
    };
    await writeJson(filePath, animation);
  };

  await updateAnimation({ status: "generating" });

  try {
    const characterId = String(animation.characterId ?? "");
    const characterPath = storagePath("characters", characterId, "character.json");
    if (!(await fileExists(characterPath))) {
      throw new Error("Character not found.");
    }

    const character = await readJson<Record<string, unknown>>(characterPath);
    const referenceImages = (character.referenceImages as Array<Record<string, unknown>>) ?? [];
    const preferredRefId = String(animation.referenceImageId ?? "").trim();
    const selected =
      preferredRefId
        ? referenceImages.find((image) => String(image.id) === preferredRefId)
        : undefined;
    const primary =
      selected ??
      referenceImages.find((image) => image.isPrimary) ??
      referenceImages[0];
    const filename =
      (primary?.filename as string | undefined) ??
      String(primary?.url ?? "").split("/").pop();

    const referencePath = filename
      ? storagePath("characters", characterId, "references", filename)
      : null;

    const model = String(animation.generationModel ?? "sora-2");
    const modelConfig = getVideoModelConfig(model);
    const supportsContinuation = getVideoModelSupportsContinuation(model);
    const vertexModelId = getVertexModelForVideo(model);
    const supportsNegativePrompt = Boolean(modelConfig.supportsNegativePrompt);
    const generationNegativePrompt =
      typeof animation.generationNegativePrompt === "string"
        ? animation.generationNegativePrompt.trim()
        : "";
    const requestedProvider = String(animation.generationProvider ?? "").trim();
    if (requestedProvider !== "openai" && requestedProvider !== "replicate") {
      throw new Error("Generation provider is required. Select OpenAI or Replicate.");
    }
    const modelProvider = modelConfig.provider;
    if (requestedProvider !== modelProvider) {
      throw new Error(
        `Generation provider (${requestedProvider}) does not match model provider (${modelProvider}).`
      );
    }
    const provider: "openai" | "replicate" = requestedProvider;
    const requestedSize = String(
      animation.generationSize ?? getDefaultVideoSize(model)
    );
    const size = coerceVideoSizeForModel(requestedSize, model);
    const useSegmentPlan = Array.isArray(segments) && segments.length > 0;
    const requestedSeconds = Number(
      animation.generationSeconds ?? getDefaultVideoSeconds(model)
    );
    const seconds = useSegmentPlan
      ? requestedSeconds
      : coerceVideoSecondsForModel(requestedSeconds, model);
    const requestedFps = Number(animation.extractFps ?? animation.fps ?? 12);
    const extractFps = [6, 8, 12, 24].includes(requestedFps) ? requestedFps : 12;
    const loopMode =
      String(animation.loopMode ?? "loop") === "pingpong" ? "pingpong" : "loop";
    const sheetColumns = Math.max(1, Number(animation.sheetColumns ?? 6));
    let frameWidth = Number(animation.frameWidth ?? character.baseWidth ?? 253);
    let frameHeight = Number(animation.frameHeight ?? character.baseHeight ?? 504);
    const expectedFrameCount = Math.max(1, Math.round(seconds * extractFps));

    const frameSizeNotes: string[] = [];
    const requestedFrameWidth = frameWidth;
    const requestedFrameHeight = frameHeight;
    const sizeBounds = parseSize(size, {
      width: frameWidth,
      height: frameHeight,
    });
    const scaleToGeneration = Math.min(
      1,
      sizeBounds.width / frameWidth,
      sizeBounds.height / frameHeight
    );
    if (scaleToGeneration < 1) {
      const scaledWidth = Math.max(1, Math.floor(frameWidth * scaleToGeneration));
      const scaledHeight = Math.max(1, Math.floor(frameHeight * scaleToGeneration));
      logger.info("Frame size clamped to generation size", {
        animationId,
        from: { width: frameWidth, height: frameHeight },
        to: { width: scaledWidth, height: scaledHeight },
        generationSize: sizeBounds,
      });
      frameWidth = scaledWidth;
      frameHeight = scaledHeight;
      frameSizeNotes.push(
        `Scaled frame size to ${scaledWidth}x${scaledHeight} to fit ${sizeBounds.width}x${sizeBounds.height}.`
      );
    }

    const estimatedBaseFrameCount = Math.max(
      1,
      Number(animation.frameCount ?? expectedFrameCount)
    );
    const estimatedSheetFrameCount =
      loopMode === "pingpong"
        ? Math.max(1, estimatedBaseFrameCount * 2 - 2)
        : estimatedBaseFrameCount;
    const sheetRows = Math.max(
      1,
      Math.ceil(estimatedSheetFrameCount / sheetColumns)
    );
    const sheetPixels = sheetColumns * sheetRows * frameWidth * frameHeight;
    const maxSpritesheetPixels = 260_000_000;
    if (sheetPixels > maxSpritesheetPixels) {
      const scale = Math.sqrt(maxSpritesheetPixels / sheetPixels);
      const scaledWidth = Math.max(1, Math.floor(frameWidth * scale));
      const scaledHeight = Math.max(1, Math.floor(frameHeight * scale));
      if (scaledWidth < frameWidth || scaledHeight < frameHeight) {
        logger.info("Frame size clamped for spritesheet limit", {
          animationId,
          from: { width: frameWidth, height: frameHeight },
          to: { width: scaledWidth, height: scaledHeight },
          frameCount: estimatedSheetFrameCount,
          columns: sheetColumns,
          sheetPixels,
          maxSpritesheetPixels,
        });
        frameWidth = scaledWidth;
        frameHeight = scaledHeight;
        frameSizeNotes.push(
          `Scaled frame size to ${scaledWidth}x${scaledHeight} to keep spritesheet under ${maxSpritesheetPixels} pixels.`
        );
      }
    }

    const updates: Record<string, unknown> = {};
    const notes: string[] = [];
    if (size !== requestedSize) {
      notes.push(`Adjusted video size to ${size} for ${model}.`);
      updates.generationSize = size;
    }
    if (!useSegmentPlan && seconds !== requestedSeconds) {
      notes.push(`Adjusted clip duration to ${seconds}s for ${model}.`);
      updates.generationSeconds = seconds;
    }
    if (!useSegmentPlan && expectedFrameCount !== Number(animation.frameCount ?? expectedFrameCount)) {
      updates.frameCount = expectedFrameCount;
    }
    if (
      frameWidth !== requestedFrameWidth ||
      frameHeight !== requestedFrameHeight
    ) {
      updates.frameWidth = frameWidth;
      updates.frameHeight = frameHeight;
      notes.push(...frameSizeNotes);
    }
    if (notes.length) {
      updates.generationNote = notes.join(" ");
    }
    if (Object.keys(updates).length) {
      await updateAnimation(updates);
    }
    let generationNote =
      (updates.generationNote as string | undefined) ??
      (animation.generationNote as string | undefined);

    const totalFrameCount = Math.max(
      1,
      Number(animation.frameCount ?? expectedFrameCount)
    );
    const segmentPlan = useSegmentPlan
      ? normalizeSegmentPlan(
          (segments ?? []).map((segment) => ({
            ...segment,
            targetFrameCount: Math.max(
              1,
              segment.endFrame - segment.startFrame + 1
            ),
          }))
        )
      : null;
    const continuationRequested =
      Boolean(segmentPlan && segmentPlan.length > 1) &&
      supportsContinuation &&
      Boolean(vertexModelId) &&
      process.env.VEO_CONTINUATION_ENABLED === "true";

    const replicateModel = getReplicateModelForVideo(model);
    const useOpenAI = provider === "openai";
    const useReplicateVideo = provider === "replicate" && Boolean(replicateModel);

    if (!useOpenAI && !useReplicateVideo) {
      throw new Error(`Model ${model} is not available for provider ${provider}.`);
    }

    if (segmentPlan) {
      const validationError = validateSegmentPlan({
        segments: segmentPlan,
        totalFrameCount,
        extractFps,
        allowedSeconds: modelConfig.secondsOptions,
        supportsStartEnd: Boolean(modelConfig.supportsStartEnd),
        modelLabel: modelConfig.label,
      });
      if (validationError) {
        throw new Error(validationError);
      }
    }

    if (useOpenAI || useReplicateVideo) {
      if (!referencePath) {
        throw new Error("Reference image not found.");
      }
      if (useOpenAI && !process.env.OPENAI_API_KEY?.trim()) {
        throw new Error("Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server.");
      }
      if (useReplicateVideo && !process.env.REPLICATE_API_TOKEN?.trim()) {
        throw new Error("Missing REPLICATE_API_TOKEN. Add it to .env.local and restart the dev server.");
      }

      const isToonCrafter = modelConfig.id === "tooncrafter";
      let selectedKeyframes: Keyframe[] = [];
      let keyframePaths: string[] = [];
      let effectiveSize = size;

      const appendGenerationNote = async (note: string) => {
        generationNote = generationNote ? `${generationNote} ${note}` : note;
        await updateAnimation({ generationNote });
      };

      const continuationAvailability = continuationRequested
        ? getVertexVeoAvailability()
        : { available: false, config: undefined, reason: "Veo continuation disabled." };
      const continuationEnabled =
        continuationRequested &&
        continuationAvailability.available &&
        Boolean(continuationAvailability.config) &&
        Boolean(vertexModelId);
      if (continuationRequested) {
        if (continuationEnabled) {
          await appendGenerationNote(
            "Veo continuation enabled for segmented generation. End frames are ignored after the first segment."
          );
          logger.info("Veo continuation enabled", {
            animationId,
            model,
            provider,
          });
        } else {
          const reason = continuationAvailability.reason ?? "Vertex configuration missing.";
          await appendGenerationNote(`Veo continuation disabled: ${reason}`);
          logger.warn("Veo continuation disabled", {
            animationId,
            model,
            provider,
            reason,
          });
        }
      }

      if (segmentPlan && isToonCrafter) {
        throw new Error("Segmented generation is not supported for ToonCrafter.");
      }

      if (isToonCrafter && !segmentPlan) {
        const keyframes = (animation.keyframes as Keyframe[] | undefined) ?? [];
        const usableKeyframes = keyframes
          .filter((kf) => kf.image)
          .sort((a, b) => a.frameIndex - b.frameIndex);
        if (usableKeyframes.length < 2) {
          throw new Error("ToonCrafter requires at least two keyframes with images.");
        }
        if (usableKeyframes.length > 10) {
          selectedKeyframes = sampleEvenly(usableKeyframes, 10);
          await appendGenerationNote(
            `ToonCrafter supports up to 10 keyframes; sampled ${selectedKeyframes.length} of ${usableKeyframes.length}.`
          );
        } else {
          selectedKeyframes = usableKeyframes;
        }

        keyframePaths = selectedKeyframes.map((keyframe) => {
          const imageUrl = String(keyframe.image ?? "");
          const localPath = storagePathFromUrl(imageUrl);
          if (!localPath) {
            throw new Error("Invalid keyframe image path.");
          }
          return localPath;
        });

        if (size === "native") {
          let maxWidth = 0;
          let maxHeight = 0;
          for (const keyframePath of keyframePaths) {
            const dims = await resolveImageDimensions(keyframePath);
            if (dims) {
              maxWidth = Math.max(maxWidth, dims.width);
              maxHeight = Math.max(maxHeight, dims.height);
            }
          }
          if (!maxWidth || !maxHeight) {
            maxWidth = frameWidth;
            maxHeight = frameHeight;
          }
          effectiveSize = `${maxWidth}x${maxHeight}`;
          await appendGenerationNote(
            `Using native keyframe size ${maxWidth}x${maxHeight}.`
          );
        }

        const maxToonCrafterDimension = 768;
        const parsedEffectiveSize = parseSize(effectiveSize, {
          width: frameWidth,
          height: frameHeight,
        });
        if (
          parsedEffectiveSize.width > maxToonCrafterDimension ||
          parsedEffectiveSize.height > maxToonCrafterDimension
        ) {
          const scale = Math.min(
            maxToonCrafterDimension / parsedEffectiveSize.width,
            maxToonCrafterDimension / parsedEffectiveSize.height
          );
          const scaledWidth = Math.max(
            1,
            Math.round(parsedEffectiveSize.width * scale)
          );
          const scaledHeight = Math.max(
            1,
            Math.round(parsedEffectiveSize.height * scale)
          );
          effectiveSize = `${scaledWidth}x${scaledHeight}`;
          await appendGenerationNote(
            `ToonCrafter max dimension is ${maxToonCrafterDimension}px; scaled to ${scaledWidth}x${scaledHeight}.`
          );
          logger.info("ToonCrafter size clamped", {
            animationId,
            requestedSize: parsedEffectiveSize,
            effectiveSize,
          });
        }
      }

      const { workingPath, workingSpec } = await ensureWorkingReference({
        character,
        referencePath,
        referenceImageId: String(primary?.id ?? "default"),
        generationSize: effectiveSize,
      });

      const resolvedPromptProfile =
        String(animation.promptProfile ?? "") === "concise" ||
        String(animation.promptProfile ?? "") === "verbose"
          ? (animation.promptProfile as "verbose" | "concise")
          : modelConfig.promptProfile;
      const promptOverride =
        resolvedPromptProfile === "concise"
          ? (animation.promptConcise as string | undefined)
          : (animation.promptVerbose as string | undefined);
      const forceEmptyPrompt =
        isToonCrafter && animation.tooncrafterEmptyPrompt === true;
      if (forceEmptyPrompt) {
        logger.info("ToonCrafter using empty prompt override", { animationId });
      }
      const prompt = forceEmptyPrompt
        ? ""
        : typeof promptOverride === "string" && promptOverride.trim()
        ? promptOverride
        : buildVideoPrompt({
            description: String(animation.description ?? ""),
            style: String(animation.style ?? ""),
            artStyle: String(character.style ?? "pixel-art"),
            bgKeyColor: workingSpec.bgKeyColor ?? DEFAULT_BG_KEY,
            promptProfile: resolvedPromptProfile,
          });

      let providerSpritesheetUrl: string | undefined;
      let providerThumbUrl: string | undefined;
      let expiresAt: string | undefined;

      const generatedDir = storagePath("animations", animationId, "generated");
      await ensureDir(generatedDir);

      if (segmentPlan && segmentPlan.length > 0) {
        const queueTimestamp = new Date().toISOString();
        let queueItems: GenerationQueueItem[] = segmentPlan.map((segment) => ({
          id: segment.id,
          status: "queued",
          startFrame: segment.startFrame,
          endFrame: segment.endFrame,
          targetFrameCount: segment.targetFrameCount,
          durationSeconds: segment.durationSeconds,
          model,
          provider,
          startImageUrl: segment.startImageUrl,
          endImageUrl: segment.endImageUrl ?? null,
          progress: 0,
          createdAt: queueTimestamp,
        }));

        await updateAnimation({
          generationQueue: queueItems,
          generationJob: undefined,
        });

        const updateQueueItem = async (
          id: string,
          patch: Partial<GenerationQueueItem>
        ) => {
          const updatedAt = new Date().toISOString();
          queueItems = queueItems.map((item) =>
            item.id === id ? { ...item, ...patch, updatedAt } : item
          );
          await updateAnimation({ generationQueue: queueItems });
        };

        const rawFramesDir = path.join(generatedDir, "frames_raw");
        const framesDir = path.join(generatedDir, "frames");
        await fs.rm(rawFramesDir, { recursive: true, force: true });
        await fs.rm(framesDir, { recursive: true, force: true });
        await fs.mkdir(rawFramesDir, { recursive: true });
        await fs.mkdir(framesDir, { recursive: true });

        const referenceUrl = String(primary?.url ?? "");
        const loopRequested =
          segmentPlan.length > 1 ? false : animation.generationLoop === true;

        const normalizeProgress = (value?: number) => {
          if (typeof value !== "number") return null;
          return Math.round(value > 1 ? value : value * 100);
        };

        logger.info("Segmented generation starting", {
          animationId,
          segments: segmentPlan.length,
          model,
          provider,
        });
        let loggedNegativePrompt = false;
        let previousSegmentVideoPath: string | null = null;
        const continuationFrameLimit = Math.round(
          VEO_CONTINUATION_SECONDS * extractFps
        );

        for (let index = 0; index < segmentPlan.length; index += 1) {
          const segment = segmentPlan[index];
          try {
            logger.info("Generating segment", {
              animationId,
              segmentId: segment.id,
              startFrame: segment.startFrame,
              endFrame: segment.endFrame,
              durationSeconds: segment.durationSeconds,
            });
            await updateQueueItem(segment.id, {
              status: "in_progress",
              progress: 0,
            });

            const startImagePath = await resolveSegmentImagePath({
              animationId,
              imageUrl: segment.startImageUrl,
              referenceUrl,
              workingPath,
              generationSize: size,
              bgKeyColor: workingSpec.bgKeyColor ?? DEFAULT_BG_KEY,
              kind: "start",
            });
            const endImagePath = segment.endImageUrl
              ? await resolveSegmentImagePath({
                  animationId,
                  imageUrl: segment.endImageUrl,
                  referenceUrl,
                  workingPath,
                  generationSize: size,
                  bgKeyColor: workingSpec.bgKeyColor ?? DEFAULT_BG_KEY,
                  kind: "end",
                })
              : null;

            const videoFilename = `video_segment_${index + 1}_${Date.now()}.mp4`;
            const videoPath = path.join(generatedDir, videoFilename);
            let providerSpritesheetUrl: string | undefined;
            let providerThumbUrl: string | undefined;
            const aspectRatio = getVideoAspectRatio(size);
            const resolution = getVideoResolution(size);
            const continuationCandidate =
              continuationEnabled &&
              index > 0 &&
              segment.targetFrameCount <= continuationFrameLimit;
            if (
              continuationEnabled &&
              index > 0 &&
              segment.targetFrameCount > continuationFrameLimit
            ) {
              logger.warn("Veo continuation skipped (segment too long)", {
                animationId,
                segmentId: segment.id,
                targetFrameCount: segment.targetFrameCount,
                continuationFrameLimit,
              });
            }

            if (continuationCandidate) {
              if (!previousSegmentVideoPath) {
                throw new Error(
                  "Veo continuation requires a previous segment video."
                );
              }
              if (!vertexModelId || !continuationAvailability.config) {
                throw new Error(
                  "Veo continuation is enabled but Vertex configuration is missing."
                );
              }
              const normalizedPath = await normalizeVeoContinuationVideo({
                inputPath: previousSegmentVideoPath,
                outputDir: generatedDir,
                aspectRatio,
                resolution,
              });
              try {
                const continuationBuffer = await generateVertexVeoContinuation({
                  model: vertexModelId,
                  prompt,
                  aspectRatio,
                  resolution,
                  durationSeconds: VEO_CONTINUATION_SECONDS,
                  negativePrompt: supportsNegativePrompt
                    ? generationNegativePrompt
                    : undefined,
                  inputVideoPath: normalizedPath,
                  gcsPrefix: `veo-continuation/${animationId}/segments/${segment.id}`,
                  config: continuationAvailability.config,
                });
                await fs.writeFile(videoPath, continuationBuffer);
                logger.info("Veo continuation segment generated", {
                  animationId,
                  segmentId: segment.id,
                  model: vertexModelId,
                });
              } finally {
                await fs.rm(normalizedPath, { force: true });
              }
            } else if (useOpenAI) {
              const job = await createVideoJob({
                prompt,
                model,
                seconds: segment.durationSeconds,
                size,
                inputReferencePath: startImagePath,
              });
              const initialProgress = normalizeProgress(job.progress);
              if (initialProgress !== null) {
                await updateQueueItem(segment.id, { progress: initialProgress });
              }

              const finalJob = await pollVideoJob({
                videoId: job.id,
                onUpdate: async (update) => {
                  const progress = normalizeProgress(update.progress);
                  if (progress !== null) {
                    await updateQueueItem(segment.id, { progress });
                  }
                },
              });

              const videoBuffer = await downloadVideoContent({ videoId: job.id });
              await fs.writeFile(videoPath, videoBuffer);

              try {
                const spriteBuffer = await downloadVideoContent({
                  videoId: job.id,
                  variant: "spritesheet",
                });
                const spriteName = `provider_spritesheet_${Date.now()}.png`;
                const spritePath = path.join(generatedDir, spriteName);
                await fs.writeFile(spritePath, spriteBuffer);
                providerSpritesheetUrl = `/api/storage/animations/${animationId}/generated/${spriteName}`;
              } catch {
                // optional
              }

              try {
                const thumbBuffer = await downloadVideoContent({
                  videoId: job.id,
                  variant: "thumbnail",
                });
                const thumbName = `thumbnail_${Date.now()}.png`;
                const thumbPath = path.join(generatedDir, thumbName);
                await fs.writeFile(thumbPath, thumbBuffer);
                providerThumbUrl = `/api/storage/animations/${animationId}/generated/${thumbName}`;
              } catch {
                // optional
              }
            } else if (useReplicateVideo && replicateModel) {
              const supportsStartEnd = Boolean(modelConfig.supportsStartEnd);
              const supportsLoop = Boolean(modelConfig.supportsLoop);
              const startImageKey = modelConfig.startImageKey;
              const endImageKey = modelConfig.endImageKey;
              const resolutionKey = modelConfig.replicateResolutionKey;
              const supportsAudio = Boolean(modelConfig.replicateSupportsAudio);
              let effectiveEndImagePath: string | null = null;
              if (supportsStartEnd && (!loopRequested || !supportsLoop)) {
                if (loopRequested && !supportsLoop) {
                  effectiveEndImagePath = startImagePath;
                } else if (endImagePath) {
                  effectiveEndImagePath = endImagePath;
                }
              }

              const input: Record<string, unknown> = {
                prompt,
                duration: segment.durationSeconds,
                aspect_ratio: aspectRatio,
              };

              if (supportsNegativePrompt && generationNegativePrompt) {
                input.negative_prompt = generationNegativePrompt;
                if (!loggedNegativePrompt) {
                  logger.info("Using negative prompt for segmented generation", {
                    animationId,
                    model,
                    provider,
                  });
                  loggedNegativePrompt = true;
                }
              }

              if (resolutionKey === "quality") {
                input.quality = resolution;
              } else if (resolutionKey === "resolution") {
                input.resolution = resolution;
              }
              if (supportsAudio) {
                input.generate_audio = false;
              }
              if (supportsLoop && loopRequested) {
                input.loop = true;
              }
              const clampedStartImagePath = startImageKey
                ? await clampInputImageForModel({
                    animationId,
                    model,
                    generationSize: size,
                    imagePath: startImagePath,
                    kind: "start",
                  })
                : startImagePath;
              const clampedEndImagePath =
                supportsStartEnd && endImageKey && effectiveEndImagePath
                  ? await clampInputImageForModel({
                      animationId,
                      model,
                      generationSize: size,
                      imagePath: effectiveEndImagePath,
                      kind: "end",
                    })
                  : effectiveEndImagePath;
              if (startImageKey) {
                input[startImageKey] = await fileToDataUrl(clampedStartImagePath);
              }
              if (supportsStartEnd && endImageKey && clampedEndImagePath) {
                input[endImageKey] = await fileToDataUrl(clampedEndImagePath);
              }

              const prediction = await createPrediction({
                model: replicateModel,
                input,
              });

              const finalPrediction = await waitForPrediction(prediction.id);
              const output = finalPrediction.output as
                | string
                | string[]
                | { url?: string }
                | null
                | undefined;
              const outputUrl =
                typeof output === "string"
                  ? output
                  : Array.isArray(output)
                  ? output[0]
                  : output?.url;
              if (!outputUrl) {
                throw new Error("No output returned from Replicate.");
              }

              const outputResponse = await fetch(outputUrl, { signal: getShutdownSignal() });
              if (!outputResponse.ok) {
                throw new Error("Failed to download generated video.");
              }
              const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
              await fs.writeFile(videoPath, outputBuffer);
            } else {
              throw new Error(`Model ${model} is not available for provider ${provider}.`);
            }

            previousSegmentVideoPath = videoPath;

            await updateQueueItem(segment.id, {
              status: "completed",
              progress: 100,
              outputs: {
                videoUrl: `/api/storage/animations/${animationId}/generated/${videoFilename}`,
                spritesheetUrl: providerSpritesheetUrl,
                thumbnailUrl: providerThumbUrl,
              },
            });

            const tempDir = path.join(generatedDir, `frames_raw_segment_${index + 1}`);
            await extractVideoFrames({
              videoPath,
              outputDir: tempDir,
              fps: extractFps,
              roi: workingSpec.roi,
              frameWidth,
              frameHeight,
            });

            const rawFiles = sortFrameFiles(await fs.readdir(tempDir));
            if (rawFiles.length === 0) {
              throw new Error("No frames extracted from segmented video.");
            }

            const selection = selectFrameIndices(
              rawFiles.length,
              segment.targetFrameCount
            );
            if (selection.length !== segment.targetFrameCount) {
              throw new Error("Segment frame count mismatch after extraction.");
            }

            const skipFirst = index > 0;
            const filesToCopy = skipFirst ? selection.slice(1) : selection;
            const expectedCopyCount =
              segment.targetFrameCount - (skipFirst ? 1 : 0);
            if (filesToCopy.length !== expectedCopyCount) {
              throw new Error("Segment frame selection mismatch.");
            }

            const baseIndex = skipFirst
              ? segment.startFrame + 1
              : segment.startFrame;
            for (let offset = 0; offset < filesToCopy.length; offset += 1) {
              const rawName = rawFiles[filesToCopy[offset]];
              const outputIndex = baseIndex + offset;
              if (outputIndex > segment.endFrame) {
                throw new Error("Segment frame overflow.");
              }
              const outputName = `frame_${String(outputIndex).padStart(3, "0")}.png`;
              const outputPath = path.join(rawFramesDir, outputName);
              await fs.copyFile(path.join(tempDir, rawName), outputPath);
            }
            await fs.rm(tempDir, { recursive: true, force: true });
            logger.info("Segment complete", {
              animationId,
              segmentId: segment.id,
              framesCopied: filesToCopy.length,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Segment generation failed.";
            logger.error("Segment generation failed", {
              animationId,
              segmentId: segment.id,
              message,
            });
            await updateQueueItem(segment.id, { status: "failed", error: message });
            throw error;
          }
        }

        const rawFiles = sortFrameFiles(await fs.readdir(rawFramesDir));
        if (rawFiles.length === 0) {
          throw new Error("No frames extracted from segmented videos.");
        }
        if (rawFiles.length < totalFrameCount) {
          throw new Error("Segmented generation did not produce enough frames.");
        }

        const effectiveLoopMode =
          segmentPlan.length > 1 ? "loop" : loopMode;
        if (segmentPlan.length > 1 && loopMode === "pingpong") {
          const note = "Ping-pong output disabled for segmented generation.";
          generationNote = generationNote ? `${generationNote} ${note}` : note;
        }

        const baseSequence = rawFiles;
        const sequence =
          effectiveLoopMode === "pingpong"
            ? baseSequence.concat(baseSequence.slice(1, -1).reverse())
            : baseSequence;

        const generatedFrames: GeneratedFrame[] = [];
        for (let index = 0; index < sequence.length; index += 1) {
          const inputName = sequence[index];
          const inputPath = path.join(rawFramesDir, inputName);
          const outputName = `frame_${String(index).padStart(3, "0")}.png`;
          const outputPath = path.join(framesDir, outputName);
          await fs.copyFile(inputPath, outputPath);
          generatedFrames.push({
            frameIndex: index,
            url: `/api/storage/animations/${animationId}/generated/frames/${outputName}`,
            isKeyframe: false,
            generatedAt: new Date().toISOString(),
            source: model,
          });
        }

        const layout = buildSpritesheetLayout({
          frameWidth,
          frameHeight,
          columns: sheetColumns,
          frameCount: generatedFrames.length,
        });

        const spritesheetName = `spritesheet_${Date.now()}_segment.png`;
        const spritesheetPath = path.join(generatedDir, spritesheetName);
        await composeSpritesheet({
          framesDir,
          outputPath: spritesheetPath,
          layout,
        });

        const updated = {
          ...animation,
          status: "complete",
          generationNote,
          fps: extractFps,
          extractFps,
          frameWidth,
          frameHeight,
          loopMode: effectiveLoopMode,
          sheetColumns,
          actualFrameCount: generatedFrames.length,
          generatedFrames,
          generatedSpritesheet: `/api/storage/animations/${animationId}/generated/${spritesheetName}`,
          spritesheetLayout: layout,
          sourceVideoUrl: undefined,
          sourceProviderSpritesheetUrl: undefined,
          sourceThumbnailUrl: undefined,
          generationJob: undefined,
        };

        await writeJson(filePath, { ...updated, updatedAt: new Date().toISOString() });
        const { animation: versioned } = await createAnimationVersion(animationId, {
          source: "generation",
        });
        return versioned;
      }

      const videoFilename = `video_${Date.now()}.mp4`;
      const videoPath = path.join(generatedDir, videoFilename);

      if (useOpenAI) {
        const job = await createVideoJob({
          prompt,
          model,
          seconds,
          size,
          inputReferencePath: workingPath,
        });

        await updateGenerationJob({
          provider: "openai",
          providerJobId: job.id,
          status: job.status,
          progress: typeof job.progress === "number" ? job.progress : 0,
          expiresAt: job.expires_at ? new Date(job.expires_at * 1000).toISOString() : undefined,
        });

        const finalJob = await pollVideoJob({
          videoId: job.id,
          onUpdate: async (update) => {
            const patch: Record<string, unknown> = {
              status: update.status,
            };
            if (typeof update.progress === "number") {
              patch.progress = update.progress;
            }
            if (update.expires_at) {
              patch.expiresAt = new Date(update.expires_at * 1000).toISOString();
            }
            await updateGenerationJob(patch);
          },
        });

        expiresAt = finalJob.expires_at
          ? new Date(finalJob.expires_at * 1000).toISOString()
          : undefined;

        const videoBuffer = await downloadVideoContent({ videoId: job.id });
        await fs.writeFile(videoPath, videoBuffer);

        try {
          const spriteBuffer = await downloadVideoContent({
            videoId: job.id,
            variant: "spritesheet",
          });
          const spriteName = `provider_spritesheet_${Date.now()}.png`;
          const spritePath = path.join(generatedDir, spriteName);
          await fs.writeFile(spritePath, spriteBuffer);
          providerSpritesheetUrl = `/api/storage/animations/${animationId}/generated/${spriteName}`;
        } catch {
          // optional
        }

        try {
          const thumbBuffer = await downloadVideoContent({
            videoId: job.id,
            variant: "thumbnail",
          });
          const thumbName = `thumbnail_${Date.now()}.png`;
          const thumbPath = path.join(generatedDir, thumbName);
          await fs.writeFile(thumbPath, thumbBuffer);
          providerThumbUrl = `/api/storage/animations/${animationId}/generated/${thumbName}`;
        } catch {
          // optional
        }
      } else if (useReplicateVideo && replicateModel) {
        if (isToonCrafter) {
          if (selectedKeyframes.length < 2 || keyframePaths.length < 2) {
            throw new Error("ToonCrafter requires at least two keyframes with images.");
          }

          const parsedSize = parseSize(effectiveSize, { width: 1024, height: 1792 });
          const colorCorrection =
            typeof animation.tooncrafterColorCorrection === "boolean"
              ? animation.tooncrafterColorCorrection
              : true;
          const seedValue = Number(animation.tooncrafterSeed);
          const tooncrafterNegativePrompt =
            typeof animation.tooncrafterNegativePrompt === "string"
              ? animation.tooncrafterNegativePrompt.trim()
              : "";
          const negativePrompt =
            tooncrafterNegativePrompt || (supportsNegativePrompt ? generationNegativePrompt : "");

          const input: Record<string, unknown> = {
            prompt,
            interpolate: animation.tooncrafterInterpolate === true,
            color_correction: colorCorrection,
            loop: animation.generationLoop === true,
          };

          if (negativePrompt) {
            input.negative_prompt = negativePrompt;
            logger.info("Using negative prompt for ToonCrafter", {
              animationId,
              model,
            });
          }

          if (
            Number.isFinite(parsedSize.width) &&
            Number.isFinite(parsedSize.height) &&
            parsedSize.width > 0 &&
            parsedSize.height > 0
          ) {
            input.max_width = parsedSize.width;
            input.max_height = parsedSize.height;
          }

          if (Number.isFinite(seedValue)) {
            input.seed = seedValue;
          }

          for (let index = 0; index < selectedKeyframes.length; index += 1) {
            const buffer = await buildKeyframeCanvas({
              sourcePath: keyframePaths[index],
              spec: workingSpec,
            });
            input[`image_${index + 1}`] = bufferToDataUrl(buffer);
          }

          const prediction = await createPrediction({
            model: replicateModel,
            input,
          });

          await updateGenerationJob({
            provider: "replicate",
            providerJobId: prediction.id,
            status: prediction.status,
          });

          const finalPrediction = await waitForPrediction(prediction.id);
          await updateGenerationJob({
            status: finalPrediction.status,
            progress: 100,
          });

          const output = finalPrediction.output as
            | string
            | string[]
            | { url?: string }
            | null
            | undefined;
          const outputUrl =
            typeof output === "string"
              ? output
              : Array.isArray(output)
              ? output[0]
              : output?.url;
          if (!outputUrl) {
            throw new Error("No output returned from Replicate.");
          }

          const outputResponse = await fetch(outputUrl, { signal: getShutdownSignal() });
          if (!outputResponse.ok) {
            throw new Error("Failed to download generated video.");
          }
          const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
          await fs.writeFile(videoPath, outputBuffer);
        } else {
          const aspectRatio = getVideoAspectRatio(size);
          const resolution = getVideoResolution(size);
          const supportsStartEnd = Boolean(modelConfig.supportsStartEnd);
          const supportsLoop = Boolean(modelConfig.supportsLoop);
          const startImageKey = modelConfig.startImageKey;
          const endImageKey = modelConfig.endImageKey;
          const resolutionKey = modelConfig.replicateResolutionKey;
          const supportsAudio = Boolean(modelConfig.replicateSupportsAudio);
          const loopRequested = animation.generationLoop === true;

          const customStartPath = await resolveLocalImagePath(
            typeof animation.generationStartImageUrl === "string"
              ? animation.generationStartImageUrl
              : undefined
          );
          const customEndPath = await resolveLocalImagePath(
            typeof animation.generationEndImageUrl === "string"
              ? animation.generationEndImageUrl
              : undefined
          );

          let startImagePath = customStartPath ?? workingPath;
          if (customStartPath) {
            startImagePath = await normalizeGenerationFrame({
              animationId,
              kind: "start",
              sourcePath: customStartPath,
              generationSize: size,
              bgKeyColor: workingSpec.bgKeyColor ?? DEFAULT_BG_KEY,
            });
          }

          let endImagePath: string | null = null;
          if (supportsStartEnd && (!loopRequested || !supportsLoop)) {
            if (loopRequested && !supportsLoop) {
              endImagePath = startImagePath;
            } else if (customEndPath) {
              endImagePath = await normalizeGenerationFrame({
                animationId,
                kind: "end",
                sourcePath: customEndPath,
                generationSize: size,
                bgKeyColor: workingSpec.bgKeyColor ?? DEFAULT_BG_KEY,
              });
            }
          }
          const input: Record<string, unknown> = {
            prompt,
            duration: seconds,
            aspect_ratio: aspectRatio,
          };

          if (supportsNegativePrompt && generationNegativePrompt) {
            input.negative_prompt = generationNegativePrompt;
            logger.info("Using negative prompt for generation", {
              animationId,
              model,
              provider,
            });
          }

          if (resolutionKey === "quality") {
            input.quality = resolution;
          } else if (resolutionKey === "resolution") {
            input.resolution = resolution;
          }
          if (supportsAudio) {
            input.generate_audio = false;
          }
          if (supportsLoop && loopRequested) {
            input.loop = true;
          }
          const clampedStartImagePath =
            startImageKey && startImagePath
              ? await clampInputImageForModel({
                  animationId,
                  model,
                  generationSize: size,
                  imagePath: startImagePath,
                  kind: "start",
                })
              : startImagePath;
          const clampedEndImagePath =
            supportsStartEnd && endImageKey && endImagePath
              ? await clampInputImageForModel({
                  animationId,
                  model,
                  generationSize: size,
                  imagePath: endImagePath,
                  kind: "end",
                })
              : endImagePath;
          if (startImageKey && clampedStartImagePath) {
            input[startImageKey] = await fileToDataUrl(clampedStartImagePath);
          }
          if (supportsStartEnd && endImageKey && clampedEndImagePath) {
            input[endImageKey] = await fileToDataUrl(clampedEndImagePath);
          }

          const prediction = await createPrediction({
            model: replicateModel,
            input,
          });

          await updateGenerationJob({
            provider: "replicate",
            providerJobId: prediction.id,
            status: prediction.status,
          });

          const finalPrediction = await waitForPrediction(prediction.id);
          await updateGenerationJob({
            status: finalPrediction.status,
            progress: 100,
          });

          const output = finalPrediction.output as
            | string
            | string[]
            | { url?: string }
            | null
            | undefined;
          const outputUrl =
            typeof output === "string"
              ? output
              : Array.isArray(output)
              ? output[0]
              : output?.url;
          if (!outputUrl) {
            throw new Error("No output returned from Replicate.");
          }

          const outputResponse = await fetch(outputUrl, { signal: getShutdownSignal() });
          if (!outputResponse.ok) {
            throw new Error("Failed to download generated video.");
          }
          const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
          await fs.writeFile(videoPath, outputBuffer);
        }
      }

      const rawFramesDir = path.join(generatedDir, "frames_raw");
      const framesDir = path.join(generatedDir, "frames");
      await extractVideoFrames({
        videoPath,
        outputDir: rawFramesDir,
        fps: extractFps,
        roi: workingSpec.roi,
        frameWidth,
        frameHeight,
      });

      await fs.rm(framesDir, { recursive: true, force: true });
      await fs.mkdir(framesDir, { recursive: true });

      const rawFiles = sortFrameFiles(await fs.readdir(rawFramesDir));
      if (rawFiles.length === 0) {
        throw new Error("No frames extracted from video.");
      }
      const baseSequence = rawFiles;
      const pingpongSequence =
        loopMode === "pingpong"
          ? baseSequence.concat(baseSequence.slice(1, -1).reverse())
          : baseSequence;

      const generatedFrames = [];
      for (let index = 0; index < pingpongSequence.length; index += 1) {
        const inputName = pingpongSequence[index];
        const inputPath = path.join(rawFramesDir, inputName);
        const outputName = `frame_${String(index).padStart(3, "0")}.png`;
        const outputPath = path.join(framesDir, outputName);
        await fs.copyFile(inputPath, outputPath);
        generatedFrames.push({
          frameIndex: index,
          url: `/api/storage/animations/${animationId}/generated/frames/${outputName}`,
          isKeyframe: false,
          generatedAt: new Date().toISOString(),
          source: model,
        });
      }

      const layout = buildSpritesheetLayout({
        frameWidth,
        frameHeight,
        columns: sheetColumns,
        frameCount: generatedFrames.length,
      });

      const spritesheetName = `spritesheet_${Date.now()}.png`;
      const spritesheetPath = path.join(generatedDir, spritesheetName);
      await composeSpritesheet({
        framesDir,
        outputPath: spritesheetPath,
        layout,
      });

      const updated = {
        ...animation,
        status: "complete",
        generationNote,
        fps: extractFps,
        extractFps,
        frameWidth,
        frameHeight,
        loopMode,
        sheetColumns,
        actualFrameCount: generatedFrames.length,
        generatedFrames,
        generatedSpritesheet: `/api/storage/animations/${animationId}/generated/${spritesheetName}`,
        spritesheetLayout: layout,
        sourceVideoUrl: `/api/storage/animations/${animationId}/generated/${videoFilename}`,
        sourceProviderSpritesheetUrl: providerSpritesheetUrl,
        sourceThumbnailUrl: providerThumbUrl,
        generationJob: {
          ...(animation.generationJob as Record<string, unknown>),
          status: "completed",
          progress: 100,
          expiresAt,
          outputs: {
            videoUrl: `/api/storage/animations/${animationId}/generated/${videoFilename}`,
            spritesheetUrl: providerSpritesheetUrl,
            thumbnailUrl: providerThumbUrl,
          },
        },
      };

      await writeJson(filePath, { ...updated, updatedAt: new Date().toISOString() });
      const { animation: versioned } = await createAnimationVersion(animationId, {
        source: "generation",
      });
      return versioned;
    }

  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed.";
    logger.error("Generation failed", { animationId, message });
    const failed = {
      ...animation,
      status: "failed",
      generationNote: message,
      generationJob: {
        ...(animation.generationJob as Record<string, unknown>),
        status: "failed",
        error: message,
      },
    };
    await writeJson(filePath, { ...failed, updatedAt: new Date().toISOString() });
    throw error;
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const { animationId, async: runAsync } = payload ?? {};
  const rawSegments = Array.isArray(payload?.segments) ? payload.segments : null;
  const parsedSegments: SegmentInput[] = [];
  if (rawSegments) {
    for (let index = 0; index < rawSegments.length; index += 1) {
      const raw = rawSegments[index];
      if (!raw || typeof raw !== "object") {
        return Response.json(
          { error: "Invalid segment payload." },
          { status: 400 }
        );
      }
      const id =
        typeof raw.id === "string" && raw.id.trim().length > 0
          ? raw.id
          : `segment-${index + 1}`;
      const startFrame = Number(raw.startFrame);
      const endFrame = Number(raw.endFrame);
      const durationSeconds = Number(raw.durationSeconds);
      const startImageUrl =
        typeof raw.startImageUrl === "string" ? raw.startImageUrl : "";
      const endImageUrl =
        typeof raw.endImageUrl === "string" ? raw.endImageUrl : null;
      if (
        !Number.isFinite(startFrame) ||
        !Number.isFinite(endFrame) ||
        !Number.isFinite(durationSeconds) ||
        !Number.isInteger(startFrame) ||
        !Number.isInteger(endFrame) ||
        startImageUrl.length === 0
      ) {
        return Response.json(
          { error: "Invalid segment payload." },
          { status: 400 }
        );
      }
      parsedSegments.push({
        id,
        startFrame,
        endFrame,
        durationSeconds,
        startImageUrl,
        endImageUrl,
      });
    }
  }
  const segmentInputs = parsedSegments.length > 0 ? parsedSegments : undefined;

  if (!animationId) {
    return Response.json({ error: "Missing animationId." }, { status: 400 });
  }

  const filePath = storagePath("animations", animationId, "animation.json");
  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const animation = await readJson<Record<string, unknown>>(filePath);
  if (animation.status === "generating") {
    return Response.json({ animation, message: "Generation already in progress." });
  }

  const model = String(animation.generationModel ?? "sora-2");
  const requestedProvider = String(animation.generationProvider ?? "").trim();
  if (requestedProvider !== "openai" && requestedProvider !== "replicate") {
    return Response.json(
      { error: "Generation provider is required. Select OpenAI or Replicate." },
      { status: 400 }
    );
  }
  const modelProvider = getVideoModelConfig(model).provider;
  if (requestedProvider !== modelProvider) {
    return Response.json(
      {
        error: `Generation provider (${requestedProvider}) does not match model provider (${modelProvider}).`,
      },
      { status: 400 }
    );
  }
  const provider = requestedProvider;
  if (provider === "openai" && !process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "Missing OPENAI_API_KEY. Add it to .env.local (or your env) and restart the dev server.",
      },
      { status: 500 }
    );
  }
  if (provider === "replicate" && getReplicateModelForVideo(model) && !process.env.REPLICATE_API_TOKEN?.trim()) {
    return Response.json(
      {
        error:
          "Missing REPLICATE_API_TOKEN. Add it to .env.local (or your env) and restart the dev server.",
      },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  const queued = {
    ...animation,
    status: "generating",
    generationNote: undefined,
    updatedAt: now,
  };
  await writeJson(filePath, queued);

  if (runAsync) {
    void runGeneration(animationId, segmentInputs).catch(() => null);
    return Response.json({ animation: queued, queued: true });
  }

  try {
    const updated = await runGeneration(animationId, segmentInputs);
    return Response.json({ animation: updated });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 }
    );
  }
}
