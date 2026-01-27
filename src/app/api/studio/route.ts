import { promises as fs } from "fs";
import path from "path";
import { createPrediction, waitForPrediction } from "@/lib/ai/replicate";
import {
  createVideoJob,
  downloadVideoContent,
  pollVideoJob,
} from "@/lib/ai/openai";
import { fileToDataUrl } from "@/lib/dataUrl";
import { logger } from "@/lib/logger";
import { getShutdownSignal } from "@/lib/shutdown";
import { ensureDir, storagePath } from "@/lib/storage";
import {
  getVideoModelConfig,
  getReplicateModelForVideo,
  getVideoAspectRatio,
  getVideoResolution,
  type VideoModelId,
} from "@/lib/ai/soraConstraints";
import {
  getImageModelConfig,
  getReplicateModelForImage,
  isValidImageModel,
  type ImageModelId,
} from "@/lib/ai/imageModelConfig";

export const runtime = "nodejs";

type ModelCategory = "video" | "image";

type VideoParameters = {
  prompt: string;
  size?: string;
  seconds?: number;
  startImage?: string;
  endImage?: string;
  loop?: boolean;
  generateAudio?: boolean;
};

type ImageParameters = {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
  inputImage?: string;
  referenceImages?: string[];
  strength?: number;
  inputPalette?: string;
  tileX?: boolean;
  tileY?: boolean;
  removeBg?: boolean;
  seed?: number;
  bypassPromptExpansion?: boolean;
  aspectRatio?: string;
  resolution?: string;
};

type ToonCrafterParameters = {
  prompt: string;
  keyframes: string[];
  maxWidth?: number;
  maxHeight?: number;
  loop?: boolean;
  interpolate?: boolean;
  colorCorrection?: boolean;
  negativePrompt?: string;
  seed?: number;
};

async function saveBase64Image(base64: string, outputPath: string) {
  const match = base64.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid base64 image format.");
  }
  const buffer = Buffer.from(match[1], "base64");
  await fs.writeFile(outputPath, buffer);
}

async function generateVideo(
  modelId: string,
  params: VideoParameters
): Promise<{ videoUrl: string; thumbnailUrl?: string }> {
  const modelConfig = getVideoModelConfig(modelId);
  const provider = modelConfig.provider;

  const studioDir = storagePath("studio");
  await ensureDir(studioDir);
  const timestamp = Date.now();

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
      seconds: params.seconds ?? 4,
      size: params.size ?? "1280x720",
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

  const aspectRatio = getVideoAspectRatio(params.size ?? "1280x720");
  const resolution = getVideoResolution(params.size ?? "1280x720");

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration: params.seconds ?? modelConfig.secondsOptions[0] ?? 4,
    aspect_ratio: aspectRatio,
  };

  const resolutionKey = modelConfig.replicateResolutionKey;
  if (resolutionKey === "quality") {
    input.quality = resolution;
  } else if (resolutionKey === "resolution") {
    input.resolution = resolution;
  }

  if (modelConfig.replicateSupportsAudio) {
    input.generate_audio = params.generateAudio ?? false;
  }

  if (modelConfig.supportsLoop && params.loop) {
    input.loop = true;
  }

  if (modelConfig.supportsStartEnd && params.startImage) {
    const startKey = modelConfig.startImageKey;
    if (startKey) {
      input[startKey] = params.startImage;
    }
  }

  if (modelConfig.supportsStartEnd && params.endImage) {
    const endKey = modelConfig.endImageKey;
    if (endKey) {
      input[endKey] = params.endImage;
    }
  }

  const prediction = await createPrediction({ model: replicateModel, input });
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
  params: ImageParameters
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

  if (modelId === "nano-banana-pro") {
    input.aspect_ratio = params.aspectRatio ?? "1:1";
    input.resolution = params.resolution ?? "2K";
    input.output_format = "png";
    input.safety_filter_level = "block_only_high";

    // Handle multiple reference images
    if (Array.isArray(params.referenceImages) && params.referenceImages.length > 0) {
      input.image_input = params.referenceImages;
    } else if (params.inputImage) {
      input.image_input = [params.inputImage];
    }
  } else {
    // rd-fast or rd-plus
    input.width = params.width ?? modelConfig.defaultWidth;
    input.height = params.height ?? modelConfig.defaultHeight;
    input.num_images = 1;

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
    outputUrls.push(String((output as { url?: string }).url));
  }

  if (outputUrls.length === 0) {
    throw new Error("No output returned from image model.");
  }

  const savedUrls: string[] = [];
  for (let i = 0; i < outputUrls.length; i++) {
    const response = await fetch(outputUrls[i], { signal: getShutdownSignal() });
    if (!response.ok) {
      throw new Error("Failed to download generated image.");
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const imageFilename = `image_${timestamp}_${i}.png`;
    const imagePath = path.join(studioDir, imageFilename);
    await fs.writeFile(imagePath, imageBuffer);
    savedUrls.push(`/api/storage/studio/${imageFilename}`);
  }

  return { imageUrls: savedUrls };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { modelCategory, modelId, parameters } = payload as {
      modelCategory: ModelCategory;
      modelId: string;
      parameters: Record<string, unknown>;
    };

    if (!modelCategory || !modelId || !parameters) {
      return Response.json(
        { error: "Missing required fields: modelCategory, modelId, parameters" },
        { status: 400 }
      );
    }

    logger.info("Studio generation started", { modelCategory, modelId });

    if (modelCategory === "video") {
      if (modelId === "tooncrafter") {
        const result = await generateToonCrafter(
          parameters as unknown as ToonCrafterParameters
        );
        return Response.json({ result });
      }

      const result = await generateVideo(
        modelId as VideoModelId,
        parameters as unknown as VideoParameters
      );
      return Response.json({ result });
    }

    if (modelCategory === "image") {
      if (!isValidImageModel(modelId)) {
        return Response.json(
          { error: `Invalid image model: ${modelId}` },
          { status: 400 }
        );
      }

      const result = await generateImage(
        modelId,
        parameters as unknown as ImageParameters
      );
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
