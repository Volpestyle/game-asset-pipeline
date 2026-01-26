import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import sharp from "sharp";
import {
  createPrediction,
  runReplicateModel,
  waitForPrediction,
} from "@/lib/ai/replicate";
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
import { getShutdownSignal } from "@/lib/shutdown";
import { composeSpritesheet, extractFrames } from "@/lib/spritesheet";
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
  getVideoProviderForModel,
  getVideoModelConfig,
  getReplicateModelForVideo,
  getVideoAspectRatio,
  getVideoResolution,
} from "@/lib/ai/soraConstraints";
import type { AnimationStyle, Keyframe } from "@/types";

export const runtime = "nodejs";

const RD_ANIMATION_MODEL =
  process.env.RD_ANIMATION_MODEL?.trim() || "retro-diffusion/rd-animation";
const RD_ANIMATION_VERSION = process.env.RD_ANIMATION_VERSION?.trim() || undefined;

const STYLE_MAP: Record<AnimationStyle, string> = {
  idle: "walking_and_idle",
  walk: "four_angle_walking",
  run: "four_angle_walking",
  attack: "four_angle_walking",
  jump: "four_angle_walking",
  custom: "vfx",
};

const STYLE_SIZE_OPTIONS: Record<string, number[]> = {
  four_angle_walking: [48, 96],
  walking_and_idle: [48, 64],
  small_sprites: [32],
};

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const DEFAULT_BG_KEY = "#FF00FF";

async function fileToDataUrl(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function bufferToDataUrl(buffer: Buffer, mime = "image/png") {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function resolveLocalImagePath(url?: string) {
  if (!url) return null;
  const localPath = storagePathFromUrl(url);
  if (localPath && (await fileExists(localPath))) {
    return localPath;
  }
  return null;
}

function parseSize(size: string) {
  const [w, h] = size.split("x").map((value) => Number(value));
  const width = Number.isFinite(w) ? w : 1024;
  const height = Number.isFinite(h) ? h : 1792;
  return { width, height };
}

function parseHexColor(color: string) {
  const cleaned = color.replace("#", "").trim();
  if (cleaned.length !== 6) {
    return { r: 255, g: 0, b: 255 };
  }
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 255,
    g: Number.isFinite(g) ? g : 0,
    b: Number.isFinite(b) ? b : 255,
  };
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

function sampleEvenly<T>(items: T[], count: number) {
  if (items.length <= count) return items;
  const lastIndex = items.length - 1;
  const selected = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i * lastIndex) / (count - 1));
    selected.add(idx);
  }
  if (selected.size < count) {
    for (let i = 0; i < items.length && selected.size < count; i += 1) {
      selected.add(i);
    }
  }
  return Array.from(selected)
    .sort((a, b) => a - b)
    .map((index) => items[index]);
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

async function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    process.on("error", (err) => {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        reject(new Error("ffmpeg not found. Install ffmpeg to extract frames."));
      } else {
        reject(err);
      }
    });
    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `ffmpeg failed with exit code ${code}`));
      }
    });
  });
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

async function keyOutMagenta(filePath: string, color = DEFAULT_BG_KEY) {
  const cleaned = color.replace("#", "").trim();
  const target = cleaned.length === 6 ? cleaned : "FF00FF";
  const rTarget = Number.parseInt(target.slice(0, 2), 16);
  const gTarget = Number.parseInt(target.slice(2, 4), 16);
  const bTarget = Number.parseInt(target.slice(4, 6), 16);
  const tolerance = 12;

  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const within =
      Math.abs(r - rTarget) <= tolerance &&
      Math.abs(g - gTarget) <= tolerance &&
      Math.abs(b - bTarget) <= tolerance;
    if (within) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(filePath);
}

function sortFrameFiles(files: string[]) {
  return files
    .filter((file) => file.endsWith(".png"))
    .sort((a, b) => {
      const matchA = a.match(/frame_(\d+)/);
      const matchB = b.match(/frame_(\d+)/);
      const indexA = matchA ? Number(matchA[1]) : 0;
      const indexB = matchB ? Number(matchB[1]) : 0;
      return indexA - indexB;
    });
}

function buildLayout(options: {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  frameCount: number;
}) {
  const columns = Math.max(1, options.columns);
  const rows = Math.max(1, Math.ceil(options.frameCount / columns));
  return {
    frameSize:
      options.frameWidth === options.frameHeight ? options.frameWidth : undefined,
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    columns,
    rows,
    width: columns * options.frameWidth,
    height: rows * options.frameHeight,
  };
}

async function ensureWorkingReference(options: {
  character: Record<string, unknown>;
  referencePath: string;
  referenceImageId: string;
  generationSize: string;
}) {
  const character = options.character;
  const { width, height } = parseSize(options.generationSize);

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
  const { width, height } = parseSize(options.generationSize);
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

async function runGeneration(animationId: string) {
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
    const requestedProvider = String(animation.generationProvider ?? "");
    const modelProvider = getVideoProviderForModel(model);
    const provider = requestedProvider === "replicate" ? "replicate" : modelProvider;
    const requestedSize = String(
      animation.generationSize ?? getDefaultVideoSize(model)
    );
    const size = coerceVideoSizeForModel(requestedSize, model);
    const requestedSeconds = Number(
      animation.generationSeconds ?? getDefaultVideoSeconds(model)
    );
    const seconds = coerceVideoSecondsForModel(requestedSeconds, model);
    const requestedFps = Number(animation.extractFps ?? animation.fps ?? 6);
    const extractFps = [6, 8, 12].includes(requestedFps) ? requestedFps : 6;
    const loopMode =
      String(animation.loopMode ?? "loop") === "pingpong" ? "pingpong" : "loop";
    const sheetColumns = Math.max(1, Number(animation.sheetColumns ?? 6));
    const frameWidth = Number(animation.frameWidth ?? character.baseWidth ?? 253);
    const frameHeight = Number(animation.frameHeight ?? character.baseHeight ?? 504);
    const expectedFrameCount = Math.max(1, Math.round(seconds * extractFps));

    const updates: Record<string, unknown> = {};
    const notes: string[] = [];
    if (size !== requestedSize) {
      notes.push(`Adjusted video size to ${size} for ${model}.`);
      updates.generationSize = size;
    }
    if (seconds !== requestedSeconds) {
      notes.push(`Adjusted clip duration to ${seconds}s for ${model}.`);
      updates.generationSeconds = seconds;
    }
    if (expectedFrameCount !== Number(animation.frameCount ?? expectedFrameCount)) {
      updates.frameCount = expectedFrameCount;
    }
    if (String(animation.generationProvider ?? "") !== provider) {
      updates.generationProvider = provider;
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

    const replicateModel = getReplicateModelForVideo(model);
    const useOpenAI = provider === "openai";
    const useReplicateVideo = provider === "replicate" && replicateModel;

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
      let workingPath = "";
      let workingSpec: {
        canvasW: number;
        canvasH: number;
        scale: number;
        roi: { x: number; y: number; w: number; h: number };
        bgKeyColor: string;
      };
      let selectedKeyframes: Keyframe[] = [];
      let keyframePaths: string[] = [];
      let effectiveSize = size;

      const appendGenerationNote = async (note: string) => {
        generationNote = generationNote ? `${generationNote} ${note}` : note;
        await updateAnimation({ generationNote });
      };

      if (isToonCrafter) {
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
      }

      const working = await ensureWorkingReference({
        character,
        referencePath,
        referenceImageId: String(primary?.id ?? "default"),
        generationSize: effectiveSize,
      });
      workingPath = working.workingPath;
      workingSpec = working.workingSpec;

      const resolvedPromptProfile =
        String(animation.promptProfile ?? "") === "concise" ||
        String(animation.promptProfile ?? "") === "verbose"
          ? (animation.promptProfile as "verbose" | "concise")
          : modelConfig.promptProfile;
      const promptOverride =
        resolvedPromptProfile === "concise"
          ? (animation.promptConcise as string | undefined)
          : (animation.promptVerbose as string | undefined);
      const prompt =
        typeof promptOverride === "string" && promptOverride.trim()
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

          const parsedSize = parseSize(effectiveSize);
          const colorCorrection =
            typeof animation.tooncrafterColorCorrection === "boolean"
              ? animation.tooncrafterColorCorrection
              : true;
          const seedValue = Number(animation.tooncrafterSeed);

          const input: Record<string, unknown> = {
            prompt,
            interpolate: animation.tooncrafterInterpolate === true,
            color_correction: colorCorrection,
            loop: animation.generationLoop === true,
          };

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
          if (startImageKey && startImagePath) {
            input[startImageKey] = await fileToDataUrl(startImagePath);
          }
          const shouldSendEndImage =
            supportsStartEnd && endImageKey && endImagePath;
          if (shouldSendEndImage) {
            input[endImageKey] = await fileToDataUrl(endImagePath);
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
        await keyOutMagenta(outputPath, workingSpec.bgKeyColor ?? DEFAULT_BG_KEY);
        generatedFrames.push({
          frameIndex: index,
          url: `/api/storage/animations/${animationId}/generated/frames/${outputName}`,
          isKeyframe: false,
          generatedAt: new Date().toISOString(),
          source: model,
        });
      }

      const layout = buildLayout({
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

    // Fallback: Replicate spritesheet generation (legacy)
    const prompt = `${animation.description ?? ""}, pixel art sprite, ${animation.style ?? "walk"} animation`;
    const styleKey = STYLE_MAP[(animation.style as AnimationStyle) ?? "walk"] ?? "four_angle_walking";
    const spriteSize = Number(animation.spriteSize ?? 48);
    let generationSize = Number.isFinite(spriteSize) ? Math.round(spriteSize) : 48;

    if (styleKey === "vfx") {
      generationSize = Math.min(96, Math.max(24, generationSize));
    } else {
      const allowedSizes = STYLE_SIZE_OPTIONS[styleKey] ?? [48];
      if (!allowedSizes.includes(generationSize)) {
        generationSize = allowedSizes[0];
      }
    }

    let outputBuffer: Buffer | null = null;
    let usedFallback = false;
    let outputExt = ".png";

    if (process.env.REPLICATE_API_TOKEN) {
      const input: Record<string, unknown> = {
        prompt,
        style: styleKey,
        width: generationSize,
        height: generationSize,
        return_spritesheet: true,
      };

      if (referencePath) {
        input.input_image = await fileToDataUrl(referencePath);
      }

      const prediction = await runReplicateModel({
        model: RD_ANIMATION_MODEL,
        version: RD_ANIMATION_VERSION,
        input,
      });

      const output = prediction.output;
      const outputUrl =
        (Array.isArray(output) ? output[0] : output) as string | undefined;

      if (!outputUrl) {
        throw new Error("No output returned from Replicate.");
      }

      const outputResponse = await fetch(outputUrl, { signal: getShutdownSignal() });
      if (!outputResponse.ok) {
        throw new Error("Failed to download generated asset.");
      }
      outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
    } else if (referencePath) {
      outputBuffer = await fs.readFile(referencePath);
      outputExt = path.extname(referencePath) || ".png";
      usedFallback = true;
    }

    if (!outputBuffer) {
      throw new Error("No generation output available.");
    }

    const filenameOut = `spritesheet_${Date.now()}${usedFallback ? "_fallback" : ""}${outputExt}`;
    const outputPath = storagePath("animations", animationId, "generated", filenameOut);
    await fs.writeFile(outputPath, outputBuffer);

    let generatedFrames = (animation.generatedFrames as Array<Record<string, unknown>> | undefined) ?? [];
    let spritesheetLayout = animation.spritesheetLayout;
    let actualFrameCount = animation.actualFrameCount;

    if (outputExt.toLowerCase() === ".png") {
      try {
        const framesDir = storagePath("animations", animationId, "generated", "frames");
        const { layout, frames } = await extractFrames({
          spritesheetPath: outputPath,
          outputDir: framesDir,
          frameSize: generationSize,
        });

        spritesheetLayout = layout;
        actualFrameCount = frames.length;
        generatedFrames = frames.map((frame) => ({
          frameIndex: frame.frameIndex,
          url: `/api/storage/animations/${animationId}/generated/frames/${frame.filename}`,
          isKeyframe: false,
          generatedAt: new Date().toISOString(),
          source: "rd-animation",
        }));
      } catch {
        // If frame extraction fails, keep spritesheet only.
      }
    }

    const updated = {
      ...animation,
      status: "complete",
      generatedSpritesheet: `/api/storage/animations/${animationId}/generated/${filenameOut}`,
      generationNote: usedFallback
        ? "Fallback sprite used (missing REPLICATE_API_TOKEN)."
        : undefined,
      generatedFrames,
      spritesheetLayout,
      actualFrameCount,
    };

    await writeJson(filePath, { ...updated, updatedAt: new Date().toISOString() });
    const { animation: versioned } = await createAnimationVersion(animationId, {
      source: "generation",
    });
    return versioned;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed.";
    console.error(`[generate] ${animationId} failed: ${message}`);
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
  const requestedProvider = String(animation.generationProvider ?? "");
  const modelProvider = getVideoProviderForModel(model);
  const provider = requestedProvider === "replicate" ? "replicate" : modelProvider;
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
    void runGeneration(animationId).catch(() => null);
    return Response.json({ animation: queued, queued: true });
  }

  try {
    const updated = await runGeneration(animationId);
    return Response.json({ animation: updated });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 }
    );
  }
}
