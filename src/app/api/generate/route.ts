import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import sharp from "sharp";
import { runReplicateModel } from "@/lib/ai/replicate";
import {
  createVideoJob,
  downloadVideoContent,
  pollVideoJob,
} from "@/lib/ai/openai";
import { buildWorkingReference } from "@/lib/character/workingReference";
import { getShutdownSignal } from "@/lib/shutdown";
import { composeSpritesheet, extractFrames } from "@/lib/spritesheet";
import {
  ensureDir,
  fileExists,
  readJson,
  storagePath,
  writeJson,
} from "@/lib/storage";
import { createAnimationVersion } from "@/lib/animationVersions";
import {
  coerceVideoSizeForModel,
  getDefaultVideoSize,
} from "@/lib/ai/soraConstraints";
import type { AnimationStyle } from "@/types";

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

function parseSize(size: string) {
  const [w, h] = size.split("x").map((value) => Number(value));
  const width = Number.isFinite(w) ? w : 1024;
  const height = Number.isFinite(h) ? h : 1792;
  return { width, height };
}

const ANIMATION_STYLE_HINTS: Record<string, string> = {
  idle: "subtle breathing, gentle sway, standing in relaxed pose",
};

const ART_STYLE_PROMPTS: Record<
  string,
  { label: string; constraints: string[] }
> = {
  "pixel-art": {
    label: "pixel art sprite",
    constraints: [
      "limited color palette",
      "crisp hard edges",
      "no anti-aliasing",
      "no motion blur",
    ],
  },
  "hand-drawn": {
    label: "hand-drawn 2d sprite",
    constraints: ["clean linework", "flat shading", "no motion blur"],
  },
  "3d-rendered": {
    label: "3d rendered character sprite",
    constraints: ["clean lighting", "no motion blur"],
  },
  anime: {
    label: "anime-style character sprite",
    constraints: ["clean lineart", "cel shading", "no motion blur"],
  },
  realistic: {
    label: "realistic character sprite",
    constraints: ["natural lighting", "no motion blur"],
  },
  custom: {
    label: "character sprite",
    constraints: ["no motion blur"],
  },
};

function buildSoraPrompt(options: {
  description: string;
  style?: string;
  artStyle?: string;
  bgKeyColor?: string;
}) {
  const bg = options.bgKeyColor ?? DEFAULT_BG_KEY;
  const styleKey = options.style ?? "";
  const styleHint = ANIMATION_STYLE_HINTS[styleKey] ?? (styleKey ? `${styleKey} animation` : "");
  const artStyleKey = options.artStyle ?? "pixel-art";
  const artConfig =
    ART_STYLE_PROMPTS[artStyleKey] ?? ART_STYLE_PROMPTS.custom;
  const parts = [
    options.description,
    styleHint,
    artConfig.label,
    ...artConfig.constraints,
    "static camera",
    "character stays centered, no camera movement",
    "keep proportions and identity identical to reference",
    "seamless looping animation, first and last pose match",
    `pure solid magenta background (${bg}), perfectly uniform, no gradients or shadows`,
  ]
    .filter(Boolean)
    .join(", ");

  return parts;
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

    const provider = String(animation.generationProvider ?? "openai");
    const useOpenAI = provider === "openai";

    if (useOpenAI) {
      if (!process.env.OPENAI_API_KEY?.trim()) {
        throw new Error("Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server.");
      }
      if (!referencePath) {
        throw new Error("Reference image not found.");
      }

      const model = String(animation.generationModel ?? "sora-2");
      const requestedSize = String(
        animation.generationSize ?? getDefaultVideoSize(model)
      );
      const size = coerceVideoSizeForModel(requestedSize, model);
      let generationNote: string | undefined;
      if (size !== requestedSize) {
        generationNote = `Adjusted video size to ${size} for ${model}.`;
        await updateAnimation({ generationSize: size, generationNote });
      }
      const requestedSeconds = Number(animation.generationSeconds ?? 4);
      const seconds = [4, 8, 12].includes(requestedSeconds)
        ? requestedSeconds
        : 4;
      const requestedFps = Number(animation.extractFps ?? animation.fps ?? 6);
      const extractFps = [6, 8, 12].includes(requestedFps) ? requestedFps : 6;
      const loopMode =
        String(animation.loopMode ?? "loop") === "pingpong" ? "pingpong" : "loop";
      const sheetColumns = Math.max(1, Number(animation.sheetColumns ?? 6));
      const frameWidth = Number(animation.frameWidth ?? character.baseWidth ?? 253);
      const frameHeight = Number(animation.frameHeight ?? character.baseHeight ?? 504);

      const { workingPath, workingSpec } = await ensureWorkingReference({
        character,
        referencePath,
        referenceImageId: String(primary?.id ?? "default"),
        generationSize: size,
      });

      const prompt = buildSoraPrompt({
        description: String(animation.description ?? ""),
        style: String(animation.style ?? ""),
        artStyle: String(character.style ?? "pixel-art"),
        bgKeyColor: workingSpec.bgKeyColor ?? DEFAULT_BG_KEY,
      });

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

      const expiresAt = finalJob.expires_at
        ? new Date(finalJob.expires_at * 1000).toISOString()
        : undefined;

      const generatedDir = storagePath("animations", animationId, "generated");
      await ensureDir(generatedDir);
      const videoFilename = `video_${Date.now()}.mp4`;
      const videoPath = path.join(generatedDir, videoFilename);
      const videoBuffer = await downloadVideoContent({ videoId: job.id });
      await fs.writeFile(videoPath, videoBuffer);

      let providerSpritesheetUrl: string | undefined;
      let providerThumbUrl: string | undefined;

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
          source: "sora",
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

  const provider = String(animation.generationProvider ?? "openai");
  if (provider === "openai" && !process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "Missing OPENAI_API_KEY. Add it to .env.local (or your env) and restart the dev server.",
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
