import { promises as fs } from "fs";
import sharp from "sharp";
import { runReplicateModel } from "@/lib/ai/replicate";
import { getShutdownSignal } from "@/lib/shutdown";
import { composeSpritesheet, writeFrameImage } from "@/lib/spritesheet";
import {
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import type { Animation as AnimationModel, GeneratedFrame, Keyframe } from "@/types";

export const runtime = "nodejs";

const RD_FAST_MODEL = process.env.RD_FAST_MODEL?.trim() || "retro-diffusion/rd-fast";
const RD_PLUS_MODEL = process.env.RD_PLUS_MODEL?.trim() || "retro-diffusion/rd-plus";
const RD_FAST_VERSION = process.env.RD_FAST_VERSION?.trim() || undefined;
const RD_PLUS_VERSION = process.env.RD_PLUS_VERSION?.trim() || undefined;

const MIN_STRENGTH = 0.15;
const MAX_STRENGTH = 0.35;

function clampStrength(value: number) {
  return Math.min(1, Math.max(0, value));
}

function computeStrength(t: number) {
  const peak = 4 * t * (1 - t); // 0 at ends, 1 at midpoint
  return MIN_STRENGTH + (MAX_STRENGTH - MIN_STRENGTH) * peak;
}

function toDataUrl(buffer: Buffer, mime = "image/png") {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function loadImageBuffer(imageUrl: string) {
  const localPath = storagePathFromUrl(imageUrl);
  if (!localPath) {
    throw new Error("Invalid image path.");
  }
  return fs.readFile(localPath);
}

async function toRawImage(buffer: Buffer, size: number) {
  return sharp(buffer)
    .resize(size, size, {
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
  frameSize: number
) {
  const prev = await toRawImage(prevBuffer, frameSize);
  const next = await toRawImage(nextBuffer, frameSize);

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

function buildLayout(frameSize: number, frameCount: number) {
  const safeCount = Math.max(1, frameCount);
  const columns = Math.max(1, Math.ceil(Math.sqrt(safeCount)));
  const rows = Math.max(1, Math.ceil(safeCount / columns));
  return {
    frameSize,
    frameWidth: frameSize,
    frameHeight: frameSize,
    columns,
    rows,
    width: columns * frameSize,
    height: rows * frameSize,
  };
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
  const model = modelInput === "rd-fast" ? "rd-fast" : "rd-plus";
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
    const frameSize = Number(
      animation.spritesheetLayout?.frameSize ?? animation.spriteSize ?? 48
    );

    const modelId = model === "rd-fast" ? RD_FAST_MODEL : RD_PLUS_MODEL;
    const version = model === "rd-fast" ? RD_FAST_VERSION : RD_PLUS_VERSION;

    const defaultStyle = model === "rd-fast" ? "game_asset" : "default";
    const style = styleInput || defaultStyle;

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
        const blended = await blendKeyframes(prevBuffer, nextBuffer, t, frameSize);
        const inputImage = toDataUrl(blended, "image/png");
        const strength = clampStrength(computeStrength(t));
        const promptBase = String(animation.description ?? "").trim();
        const prompt = promptBase
          ? `${promptBase}, in-between frame ${frameIndex + 1} of ${totalFrames}`
          : `in-between frame ${frameIndex + 1} of ${totalFrames}`;

        const input: Record<string, unknown> = {
          prompt,
          style,
          width: frameSize,
          height: frameSize,
          num_images: 1,
          input_image: inputImage,
          strength,
          remove_bg: removeBg,
        };

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
          frameSize,
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

    const spritesheetLayout = animation.spritesheetLayout ?? buildLayout(frameSize, totalFrames);
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
