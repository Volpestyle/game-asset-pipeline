import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { createPrediction, waitForPrediction } from "@/lib/ai/replicate";
import {
  createVideoJob,
  downloadVideoContent,
  pollVideoJob,
} from "@/lib/ai/openai";
import { logger } from "@/lib/logger";
import { getShutdownSignal } from "@/lib/shutdown";
import { ensureDir, storagePath } from "@/lib/storage";
import { appendStudioHistoryEntry } from "@/lib/studioHistory";
import {
  runPikaframes,
  runWanVideo,
  type PikaframesTransitionInput,
} from "@/lib/ai/fal";
import {
  clampWanFrames,
  getWanAspectRatio,
  getWanResolution,
  WAN_DEFAULT_FPS,
} from "@/lib/ai/wan";
import {
  coerceVideoSecondsForModel,
  coerceVideoSizeForModel,
  getVideoModelConfig,
  getVideoModelReferenceConstraints,
  getVideoModelReferenceImageLimit,
  getVideoModelSupportsReferenceImages,
  getReplicateModelForVideo,
  getVideoAspectRatio,
  getVideoResolution,
  isVideoModelId,
  type VideoModelId,
} from "@/lib/ai/soraConstraints";
import {
  getImageModelConfig,
  getReplicateModelForImage,
  isValidImageModel,
  type ImageModelId,
} from "@/lib/ai/imageModelConfig";
import type {
  ModelCategory,
  StudioVideoParameters,
  PikaframesParameters,
  ToonCrafterParameters,
  StudioImageParameters,
  WanParameters,
  StudioHistoryEntry,
} from "@/types/studio";

export const runtime = "nodejs";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequiredString(value: unknown, field: string): ParseResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: `${field} is required.` };
  }
  return { ok: true, value: trimmed };
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseRequiredNumber(value: unknown, field: string): ParseResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: `${field} must be a valid number.` };
  }
  return { ok: true, value };
}

async function recordStudioHistory(options: {
  modelCategory: ModelCategory;
  modelId: string;
  result: StudioHistoryEntry["result"];
}) {
  const { modelCategory, modelId, result } = options;
  const entry: StudioHistoryEntry = {
    id: crypto.randomUUID(),
    modelCategory,
    modelId,
    createdAt: new Date().toISOString(),
    result,
  };
  await appendStudioHistoryEntry(entry);
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function parseRequiredStringArray(
  value: unknown,
  field: string,
  minCount: number,
  maxCount: number
): ParseResult<string[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: `${field} must be an array.` };
  }
  const output: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return { ok: false, error: `${field} must contain strings only.` };
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      return { ok: false, error: `${field} cannot include empty values.` };
    }
    output.push(trimmed);
  }
  if (output.length < minCount || output.length > maxCount) {
    return {
      ok: false,
      error: `${field} must include ${minCount}-${maxCount} items.`,
    };
  }
  return { ok: true, value: output };
}

function parseOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const output = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0
  );
  return output.length > 0 ? output : undefined;
}

function parseStudioVideoParameters(
  value: Record<string, unknown>
): ParseResult<StudioVideoParameters> {
  const promptResult = parseRequiredString(value.prompt, "prompt");
  if (!promptResult.ok) return promptResult;
  const sizeResult = parseRequiredString(value.size, "size");
  if (!sizeResult.ok) return sizeResult;
  const secondsResult = parseRequiredNumber(value.seconds, "seconds");
  if (!secondsResult.ok) return secondsResult;
  if (secondsResult.value <= 0) {
    return { ok: false, error: "seconds must be greater than 0." };
  }

  const params: StudioVideoParameters = {
    prompt: promptResult.value,
    size: sizeResult.value,
    seconds: secondsResult.value,
  };

  const startImage = parseOptionalString(value.startImage);
  if (startImage) params.startImage = startImage;
  const endImage = parseOptionalString(value.endImage);
  if (endImage) params.endImage = endImage;
  const loop = parseOptionalBoolean(value.loop);
  if (typeof loop === "boolean") params.loop = loop;
  const generateAudio = parseOptionalBoolean(value.generateAudio);
  if (typeof generateAudio === "boolean") params.generateAudio = generateAudio;
  const negativePrompt = parseOptionalString(value.negativePrompt);
  if (negativePrompt) params.negativePrompt = negativePrompt;
  const seed = parseOptionalNumber(value.seed);
  if (typeof seed === "number") params.seed = seed;
  const referenceImages = parseOptionalStringArray(value.referenceImages);
  if (referenceImages) params.referenceImages = referenceImages;
  const concepts = parseOptionalStringArray(value.concepts);
  if (concepts) params.concepts = concepts;
  const effect = parseOptionalString(value.effect);
  if (effect) params.effect = effect;

  return { ok: true, value: params };
}

function parsePikaframesParameters(
  value: Record<string, unknown>
): ParseResult<PikaframesParameters> {
  const keyframesResult = parseRequiredStringArray(
    value.keyframes,
    "keyframes",
    2,
    5
  );
  if (!keyframesResult.ok) return keyframesResult;
  const sizeResult = parseRequiredString(value.size, "size");
  if (!sizeResult.ok) return sizeResult;
  const secondsResult = parseRequiredNumber(value.seconds, "seconds");
  if (!secondsResult.ok) return secondsResult;
  if (secondsResult.value <= 0) {
    return { ok: false, error: "seconds must be greater than 0." };
  }

  const params: PikaframesParameters = {
    keyframes: keyframesResult.value,
    size: sizeResult.value,
    seconds: secondsResult.value,
  };

  const prompt = parseOptionalString(value.prompt);
  if (prompt) params.prompt = prompt;
  const negativePrompt = parseOptionalString(value.negativePrompt);
  if (negativePrompt) params.negativePrompt = negativePrompt;
  const seed = parseOptionalNumber(value.seed);
  if (typeof seed === "number") params.seed = seed;

  return { ok: true, value: params };
}

function parseToonCrafterParameters(
  value: Record<string, unknown>
): ParseResult<ToonCrafterParameters> {
  const keyframesResult = parseRequiredStringArray(
    value.keyframes,
    "keyframes",
    2,
    10
  );
  if (!keyframesResult.ok) return keyframesResult;

  const params: ToonCrafterParameters = {
    prompt: typeof value.prompt === "string" ? value.prompt.trim() : "",
    keyframes: keyframesResult.value,
  };

  const maxWidth = parseOptionalNumber(value.maxWidth);
  if (typeof maxWidth === "number") params.maxWidth = maxWidth;
  const maxHeight = parseOptionalNumber(value.maxHeight);
  if (typeof maxHeight === "number") params.maxHeight = maxHeight;
  const loop = parseOptionalBoolean(value.loop);
  if (typeof loop === "boolean") params.loop = loop;
  const interpolate = parseOptionalBoolean(value.interpolate);
  if (typeof interpolate === "boolean") params.interpolate = interpolate;
  const colorCorrection = parseOptionalBoolean(value.colorCorrection);
  if (typeof colorCorrection === "boolean") params.colorCorrection = colorCorrection;
  const negativePrompt = parseOptionalString(value.negativePrompt);
  if (negativePrompt) params.negativePrompt = negativePrompt;
  const seed = parseOptionalNumber(value.seed);
  if (typeof seed === "number") params.seed = seed;

  return { ok: true, value: params };
}

function parseWanParameters(
  value: Record<string, unknown>
): ParseResult<WanParameters> {
  const promptResult = parseRequiredString(value.prompt, "prompt");
  if (!promptResult.ok) return promptResult;
  const sizeResult = parseRequiredString(value.size, "size");
  if (!sizeResult.ok) return sizeResult;
  const secondsResult = parseRequiredNumber(value.seconds, "seconds");
  if (!secondsResult.ok) return secondsResult;
  if (secondsResult.value <= 0) {
    return { ok: false, error: "seconds must be greater than 0." };
  }
  const startImageResult = parseRequiredString(value.startImage, "startImage");
  if (!startImageResult.ok) return startImageResult;

  const params: WanParameters = {
    prompt: promptResult.value,
    size: sizeResult.value,
    seconds: secondsResult.value,
    startImage: startImageResult.value,
  };

  const endImage = parseOptionalString(value.endImage);
  if (endImage) params.endImage = endImage;
  const framesPerSecond = parseOptionalNumber(value.framesPerSecond);
  if (typeof framesPerSecond === "number") {
    params.framesPerSecond = framesPerSecond;
  }
  const negativePrompt = parseOptionalString(value.negativePrompt);
  if (negativePrompt) params.negativePrompt = negativePrompt;
  const seed = parseOptionalNumber(value.seed);
  if (typeof seed === "number") params.seed = seed;
  const numInferenceSteps = parseOptionalNumber(value.numInferenceSteps);
  if (typeof numInferenceSteps === "number") {
    params.numInferenceSteps = numInferenceSteps;
  }
  const enableSafetyChecker = parseOptionalBoolean(value.enableSafetyChecker);
  if (typeof enableSafetyChecker === "boolean") {
    params.enableSafetyChecker = enableSafetyChecker;
  }
  const enableOutputSafetyChecker = parseOptionalBoolean(value.enableOutputSafetyChecker);
  if (typeof enableOutputSafetyChecker === "boolean") {
    params.enableOutputSafetyChecker = enableOutputSafetyChecker;
  }
  const enablePromptExpansion = parseOptionalBoolean(value.enablePromptExpansion);
  if (typeof enablePromptExpansion === "boolean") {
    params.enablePromptExpansion = enablePromptExpansion;
  }
  const acceleration =
    typeof value.acceleration === "string" &&
    (value.acceleration === "none" || value.acceleration === "regular")
      ? value.acceleration
      : undefined;
  if (acceleration) params.acceleration = acceleration;
  const guidanceScale = parseOptionalNumber(value.guidanceScale);
  if (typeof guidanceScale === "number") params.guidanceScale = guidanceScale;
  const guidanceScale2 = parseOptionalNumber(value.guidanceScale2);
  if (typeof guidanceScale2 === "number") params.guidanceScale2 = guidanceScale2;
  const shift = parseOptionalNumber(value.shift);
  if (typeof shift === "number") params.shift = shift;
  const interpolatorModel =
    typeof value.interpolatorModel === "string" &&
    (value.interpolatorModel === "none" ||
      value.interpolatorModel === "film" ||
      value.interpolatorModel === "rife")
      ? value.interpolatorModel
      : undefined;
  if (interpolatorModel) params.interpolatorModel = interpolatorModel;
  const numInterpolatedFrames = parseOptionalNumber(value.numInterpolatedFrames);
  if (typeof numInterpolatedFrames === "number") {
    params.numInterpolatedFrames = numInterpolatedFrames;
  }
  const adjustFpsForInterpolation = parseOptionalBoolean(
    value.adjustFpsForInterpolation
  );
  if (typeof adjustFpsForInterpolation === "boolean") {
    params.adjustFpsForInterpolation = adjustFpsForInterpolation;
  }
  const videoQuality =
    typeof value.videoQuality === "string" &&
    (value.videoQuality === "low" ||
      value.videoQuality === "medium" ||
      value.videoQuality === "high" ||
      value.videoQuality === "maximum")
      ? value.videoQuality
      : undefined;
  if (videoQuality) params.videoQuality = videoQuality;
  const videoWriteMode =
    typeof value.videoWriteMode === "string" &&
    (value.videoWriteMode === "fast" ||
      value.videoWriteMode === "balanced" ||
      value.videoWriteMode === "small")
      ? value.videoWriteMode
      : undefined;
  if (videoWriteMode) params.videoWriteMode = videoWriteMode;

  return { ok: true, value: params };
}

function parseImageParameters(
  value: Record<string, unknown>
): ParseResult<StudioImageParameters> {
  const promptResult = parseRequiredString(value.prompt, "prompt");
  if (!promptResult.ok) return promptResult;

  const params: StudioImageParameters = { prompt: promptResult.value };
  const style = parseOptionalString(value.style);
  if (style) params.style = style;
  const width = parseOptionalNumber(value.width);
  if (typeof width === "number") params.width = width;
  const height = parseOptionalNumber(value.height);
  if (typeof height === "number") params.height = height;
  const inputImage = parseOptionalString(value.inputImage);
  if (inputImage) params.inputImage = inputImage;
  const referenceImages = parseOptionalStringArray(value.referenceImages);
  if (referenceImages) params.referenceImages = referenceImages;
  const strength = parseOptionalNumber(value.strength);
  if (typeof strength === "number") params.strength = strength;
  const inputPalette = parseOptionalString(value.inputPalette);
  if (inputPalette) params.inputPalette = inputPalette;
  const tileX = parseOptionalBoolean(value.tileX);
  if (typeof tileX === "boolean") params.tileX = tileX;
  const tileY = parseOptionalBoolean(value.tileY);
  if (typeof tileY === "boolean") params.tileY = tileY;
  const removeBg = parseOptionalBoolean(value.removeBg);
  if (typeof removeBg === "boolean") params.removeBg = removeBg;
  const seed = parseOptionalNumber(value.seed);
  if (typeof seed === "number") params.seed = seed;
  const bypassPromptExpansion = parseOptionalBoolean(value.bypassPromptExpansion);
  if (typeof bypassPromptExpansion === "boolean") {
    params.bypassPromptExpansion = bypassPromptExpansion;
  }
  const aspectRatio = parseOptionalString(value.aspectRatio);
  if (aspectRatio) params.aspectRatio = aspectRatio;
  const resolution = parseOptionalString(value.resolution);
  if (resolution) params.resolution = resolution;
  const numImages = parseOptionalNumber(value.numImages);
  if (typeof numImages === "number") params.numImages = numImages;
  const outputFormat = parseOptionalString(value.outputFormat);
  if (outputFormat) params.outputFormat = outputFormat;
  const safetyFilterLevel = parseOptionalString(value.safetyFilterLevel);
  if (safetyFilterLevel) params.safetyFilterLevel = safetyFilterLevel;

  return { ok: true, value: params };
}

function resolveStudioVideoInputs(options: {
  modelId: VideoModelId;
  size: string;
  seconds: number;
  context: string;
}): { size: string; seconds: number } {
  const resolvedSize = coerceVideoSizeForModel(options.size, options.modelId);
  const resolvedSeconds = coerceVideoSecondsForModel(
    options.seconds,
    options.modelId
  );

  if (resolvedSeconds !== options.seconds) {
    logger.warn(`${options.context} seconds coerced`, {
      modelId: options.modelId,
      requested: options.seconds,
      resolved: resolvedSeconds,
    });
  }
  if (resolvedSize !== options.size) {
    logger.warn(`${options.context} size coerced`, {
      modelId: options.modelId,
      requested: options.size,
      resolved: resolvedSize,
    });
  }

  return { size: resolvedSize, seconds: resolvedSeconds };
}

async function downloadStudioVideo(options: {
  outputUrl: string;
  prefix: string;
}): Promise<{ videoUrl: string }> {
  const studioDir = storagePath("studio");
  await ensureDir(studioDir);
  const timestamp = Date.now();

  const response = await fetch(options.outputUrl, {
    signal: getShutdownSignal(),
  });
  if (!response.ok) {
    logger.error("Studio video download failed", {
      status: response.status,
      url: options.outputUrl,
    });
    throw new Error("Failed to download generated video.");
  }
  const videoBuffer = Buffer.from(await response.arrayBuffer());
  const videoFilename = `${options.prefix}_${timestamp}.mp4`;
  const videoPath = path.join(studioDir, videoFilename);
  await fs.writeFile(videoPath, videoBuffer);

  return { videoUrl: `/api/storage/studio/${videoFilename}` };
}

async function saveBase64Image(base64: string, outputPath: string) {
  const match = base64.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid base64 image format.");
  }
  const buffer = Buffer.from(match[1], "base64");
  await fs.writeFile(outputPath, buffer);
}

async function generateVideo(
  modelId: VideoModelId,
  params: StudioVideoParameters
): Promise<{ videoUrl: string; thumbnailUrl?: string }> {
  const modelConfig = getVideoModelConfig(modelId);
  const provider = modelConfig.provider;

  const studioDir = storagePath("studio");
  await ensureDir(studioDir);
  const timestamp = Date.now();

  const resolvedInputs = resolveStudioVideoInputs({
    modelId,
    size: params.size,
    seconds: params.seconds,
    context: "Studio video",
  });
  let resolvedSize = resolvedInputs.size;
  let resolvedSeconds = resolvedInputs.seconds;

  const supportsReferenceImages = Boolean(modelConfig.supportsReferenceImages);
  const referenceImages = Array.isArray(params.referenceImages)
    ? params.referenceImages.filter(
        (image) => typeof image === "string" && image.trim().length > 0
      )
    : [];
  const referenceImageLimit = modelConfig.referenceImageLimit ?? 0;
  const referenceConstraints = modelConfig.referenceImageConstraints;
  const hasReferenceImages = supportsReferenceImages && referenceImages.length > 0;

  if (referenceImages.length > 0 && !supportsReferenceImages) {
    throw new Error(`Reference images are not supported for ${modelId}.`);
  }
  if (
    hasReferenceImages &&
    referenceImageLimit > 0 &&
    referenceImages.length > referenceImageLimit
  ) {
    throw new Error(
      `${modelId} supports up to ${referenceImageLimit} reference images.`
    );
  }

  if (hasReferenceImages && referenceConstraints) {
    if (
      referenceConstraints.seconds &&
      resolvedSeconds !== referenceConstraints.seconds
    ) {
      logger.warn("Studio reference image seconds coerced", {
        modelId,
        requested: resolvedSeconds,
        resolved: referenceConstraints.seconds,
      });
      resolvedSeconds = referenceConstraints.seconds;
    }
    if (
      referenceConstraints.aspectRatio &&
      getVideoAspectRatio(resolvedSize) !== referenceConstraints.aspectRatio
    ) {
      const fallbackSize = modelConfig.sizeOptions.find(
        (option) =>
          getVideoAspectRatio(option) === referenceConstraints.aspectRatio
      );
      if (!fallbackSize) {
        throw new Error(
          `${modelId} reference images require ${referenceConstraints.aspectRatio} aspect ratio.`
        );
      }
      logger.warn("Studio reference image size coerced", {
        modelId,
        requested: resolvedSize,
        resolved: fallbackSize,
      });
      resolvedSize = fallbackSize;
    }
  }

  if (provider === "fal") {
    throw new Error("Fal video models must use the Fal studio handler.");
  }
  if (provider === "vertex") {
    throw new Error("Vertex video models are not supported in Model Studio yet.");
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("Missing OPENAI_API_KEY.");
    }

    let inputReferencePath: string | undefined;
    if (params.startImage) {
      const inputPath = path.join(studioDir, `input_${timestamp}.png`);
      await saveBase64Image(params.startImage, inputPath);
      inputReferencePath = inputPath;
    }

    const job = await createVideoJob({
      prompt: params.prompt,
      model: modelId,
      seconds: resolvedSeconds,
      size: resolvedSize,
      inputReferencePath,
    });

    await pollVideoJob({ videoId: job.id });

    const videoBuffer = await downloadVideoContent({ videoId: job.id });
    const videoFilename = `video_${timestamp}.mp4`;
    const videoPath = path.join(studioDir, videoFilename);
    await fs.writeFile(videoPath, videoBuffer);

    let thumbnailUrl: string | undefined;
    try {
      const thumbBuffer = await downloadVideoContent({
        videoId: job.id,
        variant: "thumbnail",
      });
      const thumbFilename = `thumb_${timestamp}.png`;
      const thumbPath = path.join(studioDir, thumbFilename);
      await fs.writeFile(thumbPath, thumbBuffer);
      thumbnailUrl = `/api/storage/studio/${thumbFilename}`;
    } catch {
      // optional
    }

    return {
      videoUrl: `/api/storage/studio/${videoFilename}`,
      thumbnailUrl,
    };
  }

  // Replicate video models
  const replicateModel = getReplicateModelForVideo(modelId);
  if (!replicateModel) {
    throw new Error(`No Replicate model configured for ${modelId}.`);
  }

  if (!process.env.REPLICATE_API_TOKEN?.trim()) {
    throw new Error("Missing REPLICATE_API_TOKEN.");
  }

  const aspectRatio = getVideoAspectRatio(resolvedSize);
  const resolution = getVideoResolution(resolvedSize);

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration: resolvedSeconds,
    aspect_ratio: aspectRatio,
  };

  const resolutionKey = modelConfig.replicateResolutionKey;
  if (resolutionKey === "quality") {
    input.quality = resolution;
  } else if (resolutionKey === "resolution") {
    input.resolution = resolution;
  }

  const supportsNegativePrompt = Boolean(modelConfig.supportsNegativePrompt);
  const supportsSeed = Boolean(modelConfig.supportsSeed);
  const supportsConcepts = Boolean(modelConfig.supportsConcepts);
  const supportsEffect = Boolean(modelConfig.supportsEffect);
  const supportsStartEnd = Boolean(modelConfig.supportsStartEnd);
  const supportsLoop = Boolean(modelConfig.supportsLoop);
  const supportsAudio = Boolean(modelConfig.replicateSupportsAudio);

  const negativePrompt = params.negativePrompt?.trim();
  if (supportsNegativePrompt && negativePrompt) {
    input.negative_prompt = negativePrompt;
  }

  const seedValue =
    typeof params.seed === "number" && Number.isFinite(params.seed)
      ? params.seed
      : undefined;
  if (supportsSeed && typeof seedValue === "number") {
    input.seed = seedValue;
  }

  const concepts = supportsConcepts
    ? Array.isArray(params.concepts)
      ? params.concepts.filter(
          (concept) => typeof concept === "string" && concept.trim().length > 0
        )
      : []
    : [];
  if (supportsConcepts && concepts.length > 0) {
    input.concepts = concepts;
  }

  const effect = supportsEffect ? params.effect?.trim() : undefined;
  if (effect) {
    input.effect = effect;
  }

  if (supportsAudio) {
    if (params.generateAudio) {
      logger.warn("Studio audio generation disabled", { modelId });
    }
    input.generate_audio = false;
  }

  if (supportsLoop && params.loop) {
    input.loop = true;
  }

  const allowEndImage = supportsStartEnd && !hasReferenceImages && !effect;
  if (supportsStartEnd && params.startImage) {
    const startKey = modelConfig.startImageKey;
    if (startKey) {
      input[startKey] = params.startImage;
    }
  }
  if (supportsStartEnd && params.endImage) {
    if (!allowEndImage) {
      logger.warn("Studio end image ignored", {
        modelId,
        reason: hasReferenceImages ? "reference_images" : "effect",
      });
    } else {
      const endKey = modelConfig.endImageKey;
      if (endKey) {
        input[endKey] = params.endImage;
      }
    }
  }

  if (hasReferenceImages) {
    input.reference_images = referenceImages;
  }

  logger.info("Studio replicate video request", {
    modelId,
    duration: resolvedSeconds,
    size: resolvedSize,
    hasStartImage: Boolean(params.startImage),
    hasEndImage: Boolean(params.endImage) && allowEndImage,
    referenceImageCount: referenceImages.length,
    hasNegativePrompt: Boolean(negativePrompt),
    seed: seedValue,
    conceptCount: concepts.length,
    effect: effect || null,
  });

  const prediction = await createPrediction({ model: replicateModel, input });
  const finalPrediction = await waitForPrediction(prediction.id);

  const output = finalPrediction.output;
  let outputUrl: string | undefined;
  if (typeof output === "string") {
    outputUrl = output;
  } else if (Array.isArray(output)) {
    outputUrl = output.find((item) => typeof item === "string");
  } else if (output && typeof output === "object" && "url" in output) {
    const maybeUrl = output.url;
    if (typeof maybeUrl === "string") {
      outputUrl = maybeUrl;
    }
  }

  if (!outputUrl) {
    throw new Error("No output returned from Replicate.");
  }

  const response = await fetch(outputUrl, { signal: getShutdownSignal() });
  if (!response.ok) {
    throw new Error("Failed to download generated video.");
  }

  const videoBuffer = Buffer.from(await response.arrayBuffer());
  const videoFilename = `video_${timestamp}.mp4`;
  const videoPath = path.join(studioDir, videoFilename);
  await fs.writeFile(videoPath, videoBuffer);

  return { videoUrl: `/api/storage/studio/${videoFilename}` };
}

async function generatePikaframes(
  modelId: VideoModelId,
  params: PikaframesParameters
): Promise<{ videoUrl: string }> {
  const modelConfig = getVideoModelConfig(modelId);
  if (modelConfig.provider !== "fal") {
    throw new Error(`Model ${modelId} is not configured for Fal.`);
  }

  if (params.keyframes.length < 2 || params.keyframes.length > 5) {
    throw new Error("Pikaframes requires 2-5 keyframes.");
  }

  const resolved = resolveStudioVideoInputs({
    modelId,
    size: params.size,
    seconds: params.seconds,
    context: "Pikaframes",
  });
  const resolvedSize = resolved.size;
  const resolvedSeconds = resolved.seconds;

  if (resolvedSeconds > 25) {
    throw new Error("Pikaframes total duration cannot exceed 25 seconds.");
  }

  const transitionCount = params.keyframes.length - 1;
  const transitionDuration = Number(
    (resolvedSeconds / transitionCount).toFixed(3)
  );
  const transitions: PikaframesTransitionInput[] = Array.from(
    { length: transitionCount },
    () => ({ duration: transitionDuration })
  );
  const totalDuration = transitionDuration * transitionCount;
  if (totalDuration > 25) {
    throw new Error(
      `Pikaframes total duration ${totalDuration.toFixed(2)}s exceeds 25s.`
    );
  }

  const prompt = params.prompt?.trim();
  const negativePrompt = params.negativePrompt?.trim();
  const seed = Number.isFinite(params.seed) ? params.seed : undefined;
  const resolution = getVideoResolution(resolvedSize);

  logger.info("Pikaframes studio request", {
    modelId,
    keyframes: params.keyframes.length,
    totalSeconds: resolvedSeconds,
    transitionCount,
    transitionDuration,
    resolution,
    hasPrompt: Boolean(prompt),
    hasNegativePrompt: Boolean(negativePrompt),
    seed,
  });

  const payload = {
    image_urls: params.keyframes,
    transitions,
    resolution,
    prompt: prompt || undefined,
    negative_prompt: negativePrompt || undefined,
    seed,
  };

  const result = await runPikaframes(payload);
  const outputUrl = result.video?.url;
  if (!outputUrl) {
    throw new Error("No video returned from Pikaframes.");
  }

  return downloadStudioVideo({ outputUrl, prefix: "pikaframes" });
}

async function generateWanVideo(
  modelId: VideoModelId,
  params: WanParameters
): Promise<{ videoUrl: string }> {
  const modelConfig = getVideoModelConfig(modelId);
  if (modelConfig.provider !== "fal") {
    throw new Error(`Model ${modelId} is not configured for Fal.`);
  }

  if (!params.startImage) {
    throw new Error("Wan 2.2 requires a start image.");
  }

  const resolved = resolveStudioVideoInputs({
    modelId,
    size: params.size,
    seconds: params.seconds,
    context: "Wan 2.2",
  });
  const resolvedSize = resolved.size;
  const resolvedSeconds = resolved.seconds;

  const rawFps =
    typeof params.framesPerSecond === "number" &&
    Number.isFinite(params.framesPerSecond)
      ? params.framesPerSecond
      : WAN_DEFAULT_FPS;
  const clampedFps = Math.min(60, Math.max(4, Math.round(rawFps)));
  if (clampedFps !== rawFps) {
    logger.warn("Wan 2.2 FPS clamped", {
      modelId,
      requested: rawFps,
      clamped: clampedFps,
    });
  }

  const desiredFrames = Math.round(resolvedSeconds * clampedFps);
  const frameClamp = clampWanFrames(desiredFrames);
  if (frameClamp.clamped) {
    logger.warn("Wan 2.2 frame count clamped", {
      modelId,
      requested: desiredFrames,
      clamped: frameClamp.frames,
    });
  }

  const resolution = getWanResolution(resolvedSize);
  const aspectRatio = getWanAspectRatio(resolvedSize);

  const clampValue = (
    value: number,
    min: number,
    max: number,
    field: string
  ) => {
    const clamped = Math.min(max, Math.max(min, value));
    if (clamped !== value) {
      logger.warn("Wan 2.2 value clamped", {
        modelId,
        field,
        requested: value,
        clamped,
      });
    }
    return clamped;
  };

  const payload = {
    image_url: params.startImage,
    prompt: params.prompt,
    num_frames: frameClamp.frames,
    frames_per_second: clampedFps,
    resolution,
    aspect_ratio: aspectRatio,
  };
  if (params.endImage) payload.end_image_url = params.endImage;
  if (params.negativePrompt?.trim()) {
    payload.negative_prompt = params.negativePrompt.trim();
  }
  if (typeof params.seed === "number" && Number.isFinite(params.seed)) {
    payload.seed = params.seed;
  }
  if (
    typeof params.numInferenceSteps === "number" &&
    Number.isFinite(params.numInferenceSteps)
  ) {
    payload.num_inference_steps = clampValue(
      Math.round(params.numInferenceSteps),
      2,
      40,
      "num_inference_steps"
    );
  }
  if (typeof params.enableSafetyChecker === "boolean") {
    payload.enable_safety_checker = params.enableSafetyChecker;
  }
  if (typeof params.enableOutputSafetyChecker === "boolean") {
    payload.enable_output_safety_checker = params.enableOutputSafetyChecker;
  }
  if (typeof params.enablePromptExpansion === "boolean") {
    payload.enable_prompt_expansion = params.enablePromptExpansion;
  }
  if (params.acceleration) {
    payload.acceleration = params.acceleration;
  }
  if (
    typeof params.guidanceScale === "number" &&
    Number.isFinite(params.guidanceScale)
  ) {
    payload.guidance_scale = clampValue(
      params.guidanceScale,
      1,
      10,
      "guidance_scale"
    );
  }
  if (
    typeof params.guidanceScale2 === "number" &&
    Number.isFinite(params.guidanceScale2)
  ) {
    payload.guidance_scale_2 = clampValue(
      params.guidanceScale2,
      1,
      10,
      "guidance_scale_2"
    );
  }
  if (typeof params.shift === "number" && Number.isFinite(params.shift)) {
    payload.shift = clampValue(params.shift, 1, 10, "shift");
  }
  if (params.interpolatorModel) {
    payload.interpolator_model = params.interpolatorModel;
  }
  if (
    typeof params.numInterpolatedFrames === "number" &&
    Number.isFinite(params.numInterpolatedFrames)
  ) {
    payload.num_interpolated_frames = clampValue(
      Math.round(params.numInterpolatedFrames),
      0,
      4,
      "num_interpolated_frames"
    );
  }
  if (typeof params.adjustFpsForInterpolation === "boolean") {
    payload.adjust_fps_for_interpolation = params.adjustFpsForInterpolation;
  }
  if (params.videoQuality) {
    payload.video_quality = params.videoQuality;
  }
  if (params.videoWriteMode) {
    payload.video_write_mode = params.videoWriteMode;
  }

  logger.info("Wan 2.2 studio request", {
    modelId,
    frames: frameClamp.frames,
    framesPerSecond: clampedFps,
    resolution,
    aspectRatio,
    hasEndImage: Boolean(params.endImage),
    hasNegativePrompt: Boolean(params.negativePrompt),
    seed: params.seed ?? null,
  });

  const result = await runWanVideo(payload);
  const outputUrl = result.video?.url;
  if (!outputUrl) {
    throw new Error("No video returned from Wan 2.2.");
  }

  return downloadStudioVideo({ outputUrl, prefix: "wan2.2" });
}

async function generateToonCrafter(
  params: ToonCrafterParameters
): Promise<{ videoUrl: string }> {
  if (!process.env.REPLICATE_API_TOKEN?.trim()) {
    throw new Error("Missing REPLICATE_API_TOKEN.");
  }

  if (params.keyframes.length < 2 || params.keyframes.length > 10) {
    throw new Error("ToonCrafter requires 2-10 keyframes.");
  }

  const studioDir = storagePath("studio");
  await ensureDir(studioDir);
  const timestamp = Date.now();

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    loop: params.loop ?? false,
    interpolate: params.interpolate ?? false,
    color_correction: params.colorCorrection ?? true,
  };

  if (params.maxWidth) {
    input.max_width = params.maxWidth;
  }
  if (params.maxHeight) {
    input.max_height = params.maxHeight;
  }
  if (params.negativePrompt) {
    input.negative_prompt = params.negativePrompt;
  }
  if (typeof params.seed === "number" && Number.isFinite(params.seed)) {
    input.seed = params.seed;
  }

  for (let i = 0; i < params.keyframes.length; i++) {
    input[`image_${i + 1}`] = params.keyframes[i];
  }

  const prediction = await createPrediction({
    model: "fofr/tooncrafter",
    input,
  });
  const finalPrediction = await waitForPrediction(prediction.id);

  const output = finalPrediction.output;
  let outputUrl: string | undefined;
  if (typeof output === "string") {
    outputUrl = output;
  } else if (Array.isArray(output)) {
    outputUrl = output.find((item) => typeof item === "string");
  } else if (output && typeof output === "object" && "url" in output) {
    const maybeUrl = output.url;
    if (typeof maybeUrl === "string") {
      outputUrl = maybeUrl;
    }
  }

  if (!outputUrl) {
    throw new Error("No output returned from ToonCrafter.");
  }

  const response = await fetch(outputUrl, { signal: getShutdownSignal() });
  if (!response.ok) {
    throw new Error("Failed to download ToonCrafter video.");
  }

  const videoBuffer = Buffer.from(await response.arrayBuffer());
  const videoFilename = `tooncrafter_${timestamp}.mp4`;
  const videoPath = path.join(studioDir, videoFilename);
  await fs.writeFile(videoPath, videoBuffer);

  return { videoUrl: `/api/storage/studio/${videoFilename}` };
}

async function generateImage(
  modelId: ImageModelId,
  params: StudioImageParameters
): Promise<{ imageUrls: string[] }> {
  if (!process.env.REPLICATE_API_TOKEN?.trim()) {
    throw new Error("Missing REPLICATE_API_TOKEN.");
  }

  const modelConfig = getImageModelConfig(modelId);
  const replicateModel = getReplicateModelForImage(modelId);

  const studioDir = storagePath("studio");
  await ensureDir(studioDir);
  const timestamp = Date.now();

  const input: Record<string, unknown> = {
    prompt: params.prompt,
  };
  let outputFormat: string | undefined;

  if (modelId === "nano-banana-pro") {
    input.aspect_ratio = params.aspectRatio ?? "1:1";
    input.resolution = params.resolution ?? "2K";
    const formatCandidate =
      typeof params.outputFormat === "string"
        ? params.outputFormat.trim().toLowerCase()
        : "";
    const allowedFormats = new Set(["png", "jpg", "jpeg"]);
    const resolvedFormat = allowedFormats.has(formatCandidate)
      ? formatCandidate
      : "png";
    if (formatCandidate && !allowedFormats.has(formatCandidate)) {
      logger.warn("Nano Banana output format invalid", {
        requested: formatCandidate,
        resolved: resolvedFormat,
      });
    }
    outputFormat = resolvedFormat;
    input.output_format = resolvedFormat;

    const safetyCandidate =
      typeof params.safetyFilterLevel === "string"
        ? params.safetyFilterLevel.trim()
        : "";
    const allowedSafety = new Set([
      "block_only_high",
      "block_medium_and_above",
      "block_low_and_above",
    ]);
    const resolvedSafety = allowedSafety.has(safetyCandidate)
      ? safetyCandidate
      : "block_only_high";
    if (safetyCandidate && !allowedSafety.has(safetyCandidate)) {
      logger.warn("Nano Banana safety filter invalid", {
        requested: safetyCandidate,
        resolved: resolvedSafety,
      });
    }
    input.safety_filter_level = resolvedSafety;

    // Handle multiple reference images
    if (Array.isArray(params.referenceImages) && params.referenceImages.length > 0) {
      input.image_input = params.referenceImages;
    } else if (params.inputImage) {
      input.image_input = [params.inputImage];
    }
  } else if (modelId === "flux-2-max") {
    const aspectRatio = params.aspectRatio;
    const resolution = params.resolution;
    const resolvedAspectRatio = aspectRatio;
    const resolvedResolution =
      resolution && aspectRatio !== "custom" ? resolution : undefined;
    if (resolvedAspectRatio) {
      input.aspect_ratio = resolvedAspectRatio;
    }
    if (resolvedResolution) {
      input.resolution = resolvedResolution;
    }
    if (aspectRatio === "custom") {
      const width = params.width ?? modelConfig.defaultWidth;
      const height = params.height ?? modelConfig.defaultHeight;
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error("Flux 2 Max requires width and height for custom aspect ratio.");
      }
      input.width = width;
      input.height = height;
    }

    if (typeof params.seed === "number" && Number.isFinite(params.seed)) {
      input.seed = params.seed;
    }

    input.output_format = "png";

    let inputImages: string[] | undefined;
    // Handle multiple reference images
    if (Array.isArray(params.referenceImages) && params.referenceImages.length > 0) {
      if (params.referenceImages.length > modelConfig.maxImageCount) {
        throw new Error(
          `Flux 2 Max supports up to ${modelConfig.maxImageCount} reference images.`
        );
      }
      inputImages = params.referenceImages;
    } else if (params.inputImage) {
      inputImages = [params.inputImage];
    }

    if (inputImages) {
      input.input_images = inputImages;
    }

    logger.info("Flux 2 Max studio input resolved", {
      aspectRatio: resolvedAspectRatio,
      resolution: resolvedResolution,
      imageCount: inputImages?.length ?? 0,
    });
  } else {
    // rd-fast or rd-plus
    input.width = params.width ?? modelConfig.defaultWidth;
    input.height = params.height ?? modelConfig.defaultHeight;
    const requestedNumImages =
      typeof params.numImages === "number" && Number.isFinite(params.numImages)
        ? Math.round(params.numImages)
        : 1;
    const clampedNumImages = Math.min(4, Math.max(1, requestedNumImages));
    if (clampedNumImages !== requestedNumImages) {
      logger.warn("RD num_images clamped", {
        requested: requestedNumImages,
        resolved: clampedNumImages,
      });
    }
    input.num_images = clampedNumImages;

    if (params.style) {
      input.style = params.style;
    }

    if (params.inputImage) {
      input.input_image = params.inputImage;
      if (modelConfig.supportsStrength && typeof params.strength === "number") {
        input.strength = params.strength;
      }
    }

    if (modelConfig.supportsPalette && params.inputPalette) {
      input.input_palette = params.inputPalette;
    }

    if (modelConfig.supportsTiling) {
      input.tile_x = params.tileX ?? false;
      input.tile_y = params.tileY ?? false;
    }

    if (modelConfig.supportsRemoveBg) {
      input.remove_bg = params.removeBg ?? false;
    }

    if (
      modelConfig.supportsSeed &&
      typeof params.seed === "number" &&
      Number.isFinite(params.seed)
    ) {
      input.seed = params.seed;
    }

    if (typeof params.bypassPromptExpansion === "boolean") {
      input.bypass_prompt_expansion = params.bypassPromptExpansion;
    }
  }

  const prediction = await createPrediction({ model: replicateModel, input });
  const finalPrediction = await waitForPrediction(prediction.id);

  const output = finalPrediction.output;
  const outputUrls: string[] = [];

  if (typeof output === "string") {
    outputUrls.push(output);
  } else if (Array.isArray(output)) {
    outputUrls.push(
      ...output.filter((url): url is string => typeof url === "string")
    );
  } else if (output && typeof output === "object" && "url" in output) {
    const maybeUrl = output.url;
    if (typeof maybeUrl === "string") {
      outputUrls.push(maybeUrl);
    }
  }

  if (outputUrls.length === 0) {
    throw new Error("No output returned from image model.");
  }

  const savedUrls: string[] = [];
  const outputExt =
    outputFormat === "jpg" || outputFormat === "jpeg" ? ".jpg" : ".png";
  for (let i = 0; i < outputUrls.length; i++) {
    const response = await fetch(outputUrls[i], { signal: getShutdownSignal() });
    if (!response.ok) {
      throw new Error("Failed to download generated image.");
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const imageFilename = `image_${timestamp}_${i}${outputExt}`;
    const imagePath = path.join(studioDir, imageFilename);
    await fs.writeFile(imagePath, imageBuffer);
    savedUrls.push(`/api/storage/studio/${imageFilename}`);
  }

  return { imageUrls: savedUrls };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!isRecord(payload)) {
      return Response.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const modelCategory = payload.modelCategory;
    const modelId = typeof payload.modelId === "string" ? payload.modelId.trim() : "";
    const parameters = payload.parameters;

    if (!modelCategory || !modelId || !parameters) {
      return Response.json(
        { error: "Missing required fields: modelCategory, modelId, parameters" },
        { status: 400 }
      );
    }

    if (modelCategory !== "video" && modelCategory !== "image") {
      return Response.json(
        { error: `Invalid model category: ${String(modelCategory)}` },
        { status: 400 }
      );
    }

    if (!isRecord(parameters)) {
      return Response.json(
        { error: "Parameters must be an object." },
        { status: 400 }
      );
    }

    logger.info("Studio generation started", { modelCategory, modelId });

    if (modelCategory === "video") {
      if (!isVideoModelId(modelId)) {
        return Response.json(
          { error: `Invalid video model: ${modelId}` },
          { status: 400 }
        );
      }

      if (modelId === "tooncrafter") {
        const parsed = parseToonCrafterParameters(parameters);
        if (!parsed.ok) {
          return Response.json({ error: parsed.error }, { status: 400 });
        }
        const result = await generateToonCrafter(parsed.value);
        await recordStudioHistory({ modelCategory: "video", modelId, result });
        return Response.json({ result });
      }

      const modelConfig = getVideoModelConfig(modelId);
      if (modelConfig.provider === "fal") {
        if (modelId === "pikaframes") {
          const parsed = parsePikaframesParameters(parameters);
          if (!parsed.ok) {
            return Response.json({ error: parsed.error }, { status: 400 });
          }
          const result = await generatePikaframes(modelId, parsed.value);
          await recordStudioHistory({ modelCategory: "video", modelId, result });
          return Response.json({ result });
        }
        if (modelId === "wan2.2") {
          const parsed = parseWanParameters(parameters);
          if (!parsed.ok) {
            return Response.json({ error: parsed.error }, { status: 400 });
          }
          const result = await generateWanVideo(modelId, parsed.value);
          await recordStudioHistory({ modelCategory: "video", modelId, result });
          return Response.json({ result });
        }
        return Response.json(
          { error: `Fal model ${modelId} is not supported in Model Studio.` },
          { status: 400 }
        );
      }

      if (modelConfig.provider === "vertex") {
        return Response.json(
          { error: "Vertex video models are not supported in Model Studio yet." },
          { status: 400 }
        );
      }

      const parsed = parseStudioVideoParameters(parameters);
      if (!parsed.ok) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }
      const result = await generateVideo(modelId, parsed.value);
      await recordStudioHistory({ modelCategory: "video", modelId, result });
      return Response.json({ result });
    }

    if (modelCategory === "image") {
      if (!isValidImageModel(modelId)) {
        return Response.json(
          { error: `Invalid image model: ${modelId}` },
          { status: 400 }
        );
      }

      const parsed = parseImageParameters(parameters);
      if (!parsed.ok) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }

      const result = await generateImage(modelId, parsed.value);
      await recordStudioHistory({ modelCategory: "image", modelId, result });
      return Response.json({ result });
    }

    return Response.json(
      { error: `Invalid model category: ${modelCategory}` },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Studio generation failed.";
    logger.error("Studio generation failed", { message });
    return Response.json({ error: message }, { status: 500 });
  }
}
