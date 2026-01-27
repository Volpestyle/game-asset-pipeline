import { promises as fs } from "fs";
import sharp from "sharp";
import { runReplicateModel } from "@/lib/ai/replicate";
import { bufferToDataUrl } from "@/lib/dataUrl";
import { getShutdownSignal } from "@/lib/shutdown";
import { composeSpritesheet, writeFrameImage } from "@/lib/spritesheet";
import {
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import { inferAspectRatio, inferResolution } from "@/lib/videoMetrics";
import type { Animation as AnimationModel, GeneratedFrame, Keyframe } from "@/types";

export const runtime = "nodejs";

const RD_FAST_MODEL = process.env.RD_FAST_MODEL?.trim() || "retro-diffusion/rd-fast";
const RD_PLUS_MODEL = process.env.RD_PLUS_MODEL?.trim() || "retro-diffusion/rd-plus";
const RD_FAST_VERSION = process.env.RD_FAST_VERSION?.trim() || undefined;
const RD_PLUS_VERSION = process.env.RD_PLUS_VERSION?.trim() || undefined;
const NANO_BANANA_MODEL =
  process.env.NANO_BANANA_MODEL?.trim() || "google/nano-banana-pro";
const NANO_BANANA_VERSION = process.env.NANO_BANANA_VERSION?.trim() || undefined;

const MIN_STRENGTH = 0.15;
const MAX_STRENGTH = 0.35;

function clampStrength(value: number) {
  return Math.min(1, Math.max(0, value));
}

function computeStrength(t: number) {
  const peak = 4 * t * (1 - t); // 0 at ends, 1 at midpoint
  return MIN_STRENGTH + (MAX_STRENGTH - MIN_STRENGTH) * peak;
}


async function loadImageBuffer(imageUrl: string) {
  const localPath = storagePathFromUrl(imageUrl);
  if (!localPath) {
    throw new Error("Invalid image path.");
  }
  return fs.readFile(localPath);
}

async function toRawImage(buffer: Buffer, width: number, height: number) {
  return sharp(buffer)
    .resize(width, height, {
      fit: "contain",
      kernel: "nearest",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function blendKeyframes(
  prevBuffer: Buffer,
  nextBuffer: Buffer,
  t: number,
  frameWidth: number,
  frameHeight: number
) {
  const prev = await toRawImage(prevBuffer, frameWidth, frameHeight);
  const next = await toRawImage(nextBuffer, frameWidth, frameHeight);

  if (prev.info.width !== next.info.width || prev.info.height !== next.info.height) {
    throw new Error("Mismatched keyframe sizes.");
  }

  const out = Buffer.alloc(prev.data.length);
  const invT = 1 - t;
  for (let i = 0; i < out.length; i += 1) {
    const value = prev.data[i] * invT + next.data[i] * t;
    out[i] = Math.max(0, Math.min(255, Math.round(value)));
  }

  return sharp(out, {
    raw: {
      width: prev.info.width,
      height: prev.info.height,
      channels: prev.info.channels,
    },
  })
    .png()
    .toBuffer();
}

function buildLayout(
  frameWidth: number,
  frameHeight: number,
  frameCount: number
) {
  const safeCount = Math.max(1, frameCount);
  const columns = Math.max(1, Math.ceil(Math.sqrt(safeCount)));
  const rows = Math.max(1, Math.ceil(safeCount / columns));
  return {
    frameSize: frameWidth === frameHeight ? frameWidth : undefined,
    frameWidth,
    frameHeight,
    columns,
    rows,
    width: columns * frameWidth,
    height: rows * frameHeight,
  };
}

async function resolveFrameDimensions(
  animation: AnimationModel,
  keyframes: Keyframe[]
) {
  const firstWithImage = keyframes.find((kf) => kf.image);
  if (firstWithImage?.image) {
    try {
      const buffer = await loadImageBuffer(String(firstWithImage.image));
      const metadata = await sharp(buffer).metadata();
      if (metadata.width && metadata.height) {
        return { frameWidth: metadata.width, frameHeight: metadata.height };
      }
    } catch {
      // Fall through to animation defaults.
    }
  }

  const frameWidth = Number(
    animation.spritesheetLayout?.frameWidth ?? animation.frameWidth ?? 0
  );
  const frameHeight = Number(
    animation.spritesheetLayout?.frameHeight ?? animation.frameHeight ?? 0
  );
  if (frameWidth && frameHeight) {
    return { frameWidth, frameHeight };
  }

  const fallback = Number(animation.spriteSize ?? 48);
  return { frameWidth: fallback, frameHeight: fallback };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const modelInput = String(payload?.model ?? "rd-plus");
  const model =
    modelInput === "nano-banana-pro"
      ? "nano-banana-pro"
      : modelInput === "rd-fast"
        ? "rd-fast"
        : "rd-plus";
  const styleInput = String(payload?.style ?? "").trim();
  const removeBg = payload?.removeBg === true;

  const animation = await readJson<AnimationModel>(animationPath);
  const now = new Date().toISOString();
  await writeJson(animationPath, { ...animation, status: "generating", updatedAt: now });

  try {
    const keyframes = (animation.keyframes as Keyframe[] | undefined) ?? [];
    const usableKeyframes = keyframes
      .filter((kf) => kf.image)
      .sort((a, b) => a.frameIndex - b.frameIndex);

    if (usableKeyframes.length < 2) {
      return Response.json(
        { error: "At least two keyframes with images are required." },
        { status: 400 }
      );
    }

    const totalFrames = Number(
      animation.actualFrameCount ?? animation.frameCount ?? 0
    );
    const { frameWidth, frameHeight } = await resolveFrameDimensions(
      animation,
      usableKeyframes
    );

    const isNano = model === "nano-banana-pro";
    const isRdFast = model === "rd-fast";
    const modelId = isNano
      ? NANO_BANANA_MODEL
      : isRdFast
        ? RD_FAST_MODEL
        : RD_PLUS_MODEL;
    const version = isNano
      ? NANO_BANANA_VERSION
      : isRdFast
        ? RD_FAST_VERSION
        : RD_PLUS_VERSION;

    const defaultStyle = isRdFast ? "game_asset" : "default";
    const style = isNano ? "" : styleInput || defaultStyle;

    const framesDir = storagePath("animations", id, "generated", "frames");
    const framesMap = new Map<number, GeneratedFrame>();
    if (Array.isArray(animation.generatedFrames)) {
      for (const frame of animation.generatedFrames) {
        if (typeof frame.frameIndex === "number") {
          framesMap.set(frame.frameIndex, frame as GeneratedFrame);
        }
      }
    }

    for (let idx = 0; idx < usableKeyframes.length - 1; idx += 1) {
      const prev = usableKeyframes[idx];
      const next = usableKeyframes[idx + 1];
      const gap = next.frameIndex - prev.frameIndex;

      if (gap <= 1) continue;

      const prevBuffer = await loadImageBuffer(String(prev.image));
      const nextBuffer = await loadImageBuffer(String(next.image));

      for (let frameIndex = prev.frameIndex + 1; frameIndex < next.frameIndex; frameIndex += 1) {
        if (getShutdownSignal().aborted) {
          throw new Error("Interpolation aborted (shutdown signal).");
        }

        const t = (frameIndex - prev.frameIndex) / gap;
        const blended = await blendKeyframes(
          prevBuffer,
          nextBuffer,
          t,
          frameWidth,
          frameHeight
        );
        const inputImage = bufferToDataUrl(blended, "image/png");
        const strength = clampStrength(computeStrength(t));
        const promptBase = String(animation.description ?? "").trim();
        const prompt = promptBase
          ? `${promptBase}, in-between frame ${frameIndex + 1} of ${totalFrames}`
          : `in-between frame ${frameIndex + 1} of ${totalFrames}`;

        let input: Record<string, unknown>;
        if (isNano) {
          input = {
            prompt,
            output_format: "png",
            safety_filter_level: "block_only_high",
            image_input: [inputImage],
          };
          const aspectRatio = inferAspectRatio(frameWidth, frameHeight);
          if (aspectRatio) {
            input.aspect_ratio = aspectRatio;
          }
          const resolution = inferResolution(frameWidth, frameHeight);
          if (resolution) {
            input.resolution = resolution;
          }
        } else {
          input = {
            prompt,
            style,
            width: frameWidth,
            height: frameHeight,
            num_images: 1,
            input_image: inputImage,
            strength,
            remove_bg: removeBg,
            bypass_prompt_expansion: true,
          };
        }

        const prediction = await runReplicateModel({
          model: modelId,
          version,
          input,
        });

        const output = prediction.output;
        const outputUrl = (Array.isArray(output) ? output[0] : output) as
          | string
          | undefined;

        if (!outputUrl) {
          throw new Error("No output returned from Replicate.");
        }

        const outputResponse = await fetch(outputUrl, { signal: getShutdownSignal() });
        if (!outputResponse.ok) {
          throw new Error("Failed to download interpolated frame.");
        }

        const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
        const framePath = storagePath(
          "animations",
          id,
          "generated",
          "frames",
          `frame_${String(frameIndex).padStart(3, "0")}.png`
        );
        await writeFrameImage({
          buffer: outputBuffer,
          outputPath: framePath,
          frameWidth,
          frameHeight,
        });

        framesMap.set(frameIndex, {
          frameIndex,
          url: `/api/storage/animations/${id}/generated/frames/frame_${String(frameIndex).padStart(3, "0")}.png`,
          isKeyframe: false,
          generatedAt: new Date().toISOString(),
          source: `interpolate:${model}`,
        });
      }
    }

    const existingLayout = animation.spritesheetLayout;
    const spritesheetLayout =
      existingLayout &&
      existingLayout.frameWidth === frameWidth &&
      existingLayout.frameHeight === frameHeight
        ? existingLayout
        : buildLayout(frameWidth, frameHeight, totalFrames);
    let generatedSpritesheet = animation.generatedSpritesheet;
    const recomposedName = `spritesheet_${Date.now()}_interpolated.png`;
    const recomposedPath = storagePath("animations", id, "generated", recomposedName);

    try {
      await composeSpritesheet({
        framesDir,
        outputPath: recomposedPath,
        layout: spritesheetLayout,
      });
      generatedSpritesheet = `/api/storage/animations/${id}/generated/${recomposedName}`;
    } catch {
      // Keep existing spritesheet if recomposition fails.
    }

    const generatedFrames = Array.from(framesMap.values())
      .filter((frame) => frame.frameIndex < totalFrames)
      .sort((a, b) => a.frameIndex - b.frameIndex);

    const updated: AnimationModel = {
      ...(animation as AnimationModel),
      generatedFrames,
      spritesheetLayout,
      generatedSpritesheet,
      status: "complete",
      updatedAt: new Date().toISOString(),
    };

    await writeJson(animationPath, updated);

    return Response.json({ animation: updated });
  } catch (error) {
    const updated = {
      ...animation,
      status: "failed",
      updatedAt: new Date().toISOString(),
    };
    await writeJson(animationPath, updated);

    return Response.json(
      { error: error instanceof Error ? error.message : "Interpolation failed." },
      { status: 500 }
    );
  }
}
