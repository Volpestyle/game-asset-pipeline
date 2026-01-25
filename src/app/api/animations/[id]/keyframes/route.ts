import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
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
import type { Animation as AnimationModel, Keyframe } from "@/types";

export const runtime = "nodejs";

const RD_FAST_MODEL = process.env.RD_FAST_MODEL?.trim() || "retro-diffusion/rd-fast";
const RD_PLUS_MODEL = process.env.RD_PLUS_MODEL?.trim() || "retro-diffusion/rd-plus";
const RD_FAST_VERSION = process.env.RD_FAST_VERSION?.trim() || undefined;
const RD_PLUS_VERSION = process.env.RD_PLUS_VERSION?.trim() || undefined;

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], data: match[2] };
}

async function fileToDataUrl(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function parseNumber(value: FormDataEntryValue | null, fallback: number) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: FormDataEntryValue | null) {
  if (value == null) return false;
  if (typeof value === "string") {
    return value === "true" || value === "1" || value === "yes";
  }
  return false;
}

function updateKeyframes(list: Keyframe[], entry: Keyframe) {
  const index = list.findIndex((item) => item.frameIndex === entry.frameIndex);
  if (index === -1) {
    return [...list, entry].sort((a, b) => a.frameIndex - b.frameIndex);
  }
  const updated = [...list];
  updated[index] = entry;
  return updated;
}

async function resolveFrameDimensions(
  animation: AnimationModel,
  inputImagePath?: string | null
) {
  if (inputImagePath) {
    try {
      const metadata = await sharp(inputImagePath).metadata();
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

  const formData = await request.formData();
  const mode = String(formData.get("mode") ?? "upload");
  const frameIndex = parseNumber(formData.get("frameIndex"), -1);
  const promptInput = String(formData.get("prompt") ?? "").trim();
  const model = String(formData.get("model") ?? "rd-fast");
  const styleInput = String(formData.get("style") ?? "").trim();
  const strength = parseNumber(formData.get("strength"), 0.4);
  const removeBg = parseBoolean(formData.get("removeBg"));
  const bypassPromptExpansion = parseBoolean(formData.get("bypassPromptExpansion"));
  const tileX = parseBoolean(formData.get("tileX"));
  const tileY = parseBoolean(formData.get("tileY"));
  const seedRaw = formData.get("seed");
  const seed = seedRaw == null || seedRaw === "" ? null : Number(seedRaw);

  const animation = await readJson<AnimationModel>(animationPath);
  const totalFrames = Number(animation.actualFrameCount ?? animation.frameCount ?? 0);
  if (!Number.isFinite(frameIndex) || frameIndex < 0 || frameIndex >= totalFrames) {
    return Response.json({ error: "Invalid frame index." }, { status: 400 });
  }

  const keyframes = (animation.keyframes as Keyframe[] | undefined) ?? [];
  const existingKeyframe = keyframes.find((item) => item.frameIndex === frameIndex);

  const file = formData.get("image");
  const shouldGenerate = mode === "generate" || mode === "refine";

  let outputBuffer: Buffer | null = null;
  let outputExt = ".png";
  let paletteUrl: string | undefined;

  if (shouldGenerate) {
    if (!process.env.REPLICATE_API_TOKEN) {
      return Response.json(
        { error: "Missing REPLICATE_API_TOKEN for generation." },
        { status: 400 }
      );
    }

    let inputImagePath: string | null = null;
    if (file && typeof (file as File).arrayBuffer === "function") {
      const inputFile = file as File;
      const buffer = Buffer.from(await inputFile.arrayBuffer());
      const ext = path.extname(inputFile.name) || ".png";
      const tempName = `temp_${crypto.randomUUID()}${ext}`;
      const tempPath = storagePath("animations", id, "keyframes", tempName);
      await fs.mkdir(path.dirname(tempPath), { recursive: true });
      await fs.writeFile(tempPath, buffer);
      inputImagePath = tempPath;
      outputExt = ext;
    } else if (mode === "refine") {
      // Try keyframe image first, then fall back to generated frame
      const imageUrl = existingKeyframe?.image ??
        (animation.generatedFrames as Array<{ frameIndex: number; url?: string }> | undefined)
          ?.find((f) => f.frameIndex === frameIndex)?.url;
      if (imageUrl) {
        const existingPath = storagePathFromUrl(imageUrl);
        if (existingPath && (await fileExists(existingPath))) {
          inputImagePath = existingPath;
          outputExt = path.extname(existingPath) || ".png";
        }
      }
    }

    if (mode === "refine" && !inputImagePath) {
      return Response.json(
        { error: "Refine requires an existing frame (keyframe, generated, or upload)." },
        { status: 400 }
      );
    }

    if (!inputImagePath && mode === "generate") {
      const characterId = String(animation.characterId ?? "");
      const characterPath = storagePath("characters", characterId, "character.json");
      if (characterId && (await fileExists(characterPath))) {
        const character = await readJson<Record<string, unknown>>(characterPath);
        const references =
          (character.referenceImages as Array<Record<string, unknown>> | undefined) ?? [];
        const primary =
          references.find((image) => image.isPrimary) ?? references[0];
        const filename =
          (primary?.filename as string | undefined) ??
          String(primary?.url ?? "").split("/").pop();
        if (filename) {
          const refPath = storagePath("characters", characterId, "references", filename);
          if (await fileExists(refPath)) {
            inputImagePath = refPath;
          }
        }
      }
    }

    const { frameWidth, frameHeight } = await resolveFrameDimensions(
      animation,
      inputImagePath
    );
    const prompt = promptInput || String(animation.description ?? "");
    const usePlus = model === "rd-plus";
    const version = usePlus ? RD_PLUS_VERSION : RD_FAST_VERSION;
    const modelId = usePlus ? RD_PLUS_MODEL : RD_FAST_MODEL;
    const allowedStyles = usePlus
      ? [
        "default",
        "retro",
        "watercolor",
        "textured",
        "cartoon",
        "ui_element",
        "item_sheet",
        "character_turnaround",
        "environment",
        "isometric",
        "isometric_asset",
        "topdown_map",
        "topdown_asset",
        "classic",
        "topdown_item",
        "low_res",
        "mc_item",
        "mc_texture",
        "skill_icon",
      ]
      : [
        "default",
        "simple",
        "detailed",
        "retro",
        "game_asset",
        "portrait",
        "texture",
        "ui",
        "item_sheet",
        "character_turnaround",
        "1_bit",
        "low_res",
        "mc_item",
        "mc_texture",
        "no_style",
      ];
    const style = allowedStyles.includes(styleInput)
      ? styleInput
      : usePlus
        ? "default"
        : "game_asset";

    const input: Record<string, unknown> = {
      prompt,
      style,
      width: frameWidth,
      height: frameHeight,
      num_images: 1,
      remove_bg: removeBg,
    };

    if (inputImagePath) {
      input.input_image = await fileToDataUrl(inputImagePath);
      input.strength = Math.min(1, Math.max(0, strength));
    }
    if (tileX) {
      input.tile_x = true;
    }
    if (tileY) {
      input.tile_y = true;
    }
    if (bypassPromptExpansion) {
      input.bypass_prompt_expansion = true;
    }
    if (Number.isFinite(seed)) {
      input.seed = seed;
    }

    const paletteInput = formData.get("inputPalette");
    if (paletteInput && typeof paletteInput === "string") {
      const parsed = parseDataUrl(paletteInput);
      if (parsed) {
        const ext = MIME_EXT[parsed.mime] ?? ".png";
        const paletteFilename = `palette_${crypto.randomUUID()}${ext}`;
        const palettePath = storagePath("animations", id, "keyframes", paletteFilename);
        await fs.mkdir(path.dirname(palettePath), { recursive: true });
        await fs.writeFile(palettePath, Buffer.from(parsed.data, "base64"));
        input.input_palette = await fileToDataUrl(palettePath);
        paletteUrl = `/api/storage/animations/${id}/keyframes/${paletteFilename}`;
      } else {
        input.input_palette = paletteInput;
        paletteUrl = paletteInput;
      }
    } else if (paletteInput && typeof (paletteInput as File).arrayBuffer === "function") {
      const paletteBuffer = Buffer.from(await (paletteInput as File).arrayBuffer());
      const paletteFilename = `palette_${crypto.randomUUID()}.png`;
      const palettePath = storagePath("animations", id, "keyframes", paletteFilename);
      await fs.mkdir(path.dirname(palettePath), { recursive: true });
      await fs.writeFile(palettePath, paletteBuffer);
      input.input_palette = await fileToDataUrl(palettePath);
      paletteUrl = `/api/storage/animations/${id}/keyframes/${paletteFilename}`;
    }

    const prediction = await runReplicateModel({
      version,
      model: modelId,
      input,
    });

    const output = prediction.output;
    const outputUrl =
      (Array.isArray(output) ? output[0] : output) as string | undefined;

    if (!outputUrl) {
      return Response.json({ error: "No output returned." }, { status: 500 });
    }

    const outputResponse = await fetch(outputUrl, { signal: getShutdownSignal() });
    if (!outputResponse.ok) {
      return Response.json({ error: "Failed to download output." }, { status: 500 });
    }
    outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
  } else if (file && typeof (file as File).arrayBuffer === "function") {
    const inputFile = file as File;
    outputBuffer = Buffer.from(await inputFile.arrayBuffer());
    outputExt = path.extname(inputFile.name) || ".png";
  }

  if (!outputBuffer) {
    return Response.json({ error: "No image provided." }, { status: 400 });
  }

  const filename = `frame_${String(frameIndex).padStart(3, "0")}_${Date.now()}${outputExt}`;
  const keyframePath = storagePath("animations", id, "keyframes", filename);
  await fs.mkdir(path.dirname(keyframePath), { recursive: true });
  await fs.writeFile(keyframePath, outputBuffer);

  const framesDir = storagePath("animations", id, "generated", "frames");
  const frameFile = storagePath(
    "animations",
    id,
    "generated",
    "frames",
    `frame_${String(frameIndex).padStart(3, "0")}.png`
  );
  try {
    let outputWidth = 0;
    let outputHeight = 0;
    try {
      const metadata = await sharp(outputBuffer).metadata();
      outputWidth = metadata.width ?? 0;
      outputHeight = metadata.height ?? 0;
    } catch {
      // Fall back to animation defaults.
    }

    const fallback = Number(animation.spriteSize ?? 48);
    const frameWidth =
      outputWidth || Number(animation.frameWidth ?? animation.spriteSize ?? fallback);
    const frameHeight =
      outputHeight || Number(animation.frameHeight ?? animation.spriteSize ?? fallback);

    await writeFrameImage({
      buffer: outputBuffer,
      outputPath: frameFile,
      frameWidth,
      frameHeight,
    });
  } catch {
    // Frame write is best-effort; continue.
  }

  const updatedKeyframe: Keyframe = {
    frameIndex,
    image: `/api/storage/animations/${id}/keyframes/${filename}`,
    prompt: promptInput || existingKeyframe?.prompt,
    model: model === "rd-plus" ? "rd-plus" : "rd-fast",
    strength: Math.min(1, Math.max(0, strength)),
    inputPalette: paletteUrl ?? existingKeyframe?.inputPalette,
    tileX,
    tileY,
    removeBg,
    seed: typeof seed === "number" && Number.isFinite(seed) ? seed : undefined,
    bypassPromptExpansion,
    updatedAt: new Date().toISOString(),
  };

  const updatedKeyframes = updateKeyframes(keyframes, updatedKeyframe);
  const updatedAnimation: Record<string, unknown> = {
    ...animation,
    keyframes: updatedKeyframes,
    updatedAt: new Date().toISOString(),
  };

  if (Array.isArray(animation.generatedFrames)) {
    const updatedFrames = animation.generatedFrames.map((frame: Keyframe & { frameIndex: number; url?: string }) => {
      if (frame.frameIndex !== frameIndex) return frame;
      return {
        ...frame,
        url: `/api/storage/animations/${id}/generated/frames/frame_${String(frameIndex).padStart(3, "0")}.png`,
        isKeyframe: true,
        generatedAt: new Date().toISOString(),
        source: model === "rd-plus" ? "rd-plus" : "rd-fast",
      };
    });
    updatedAnimation.generatedFrames = updatedFrames;
  }

  if (animation.generatedSpritesheet && animation.spritesheetLayout) {
    const spritesheetPath = storagePathFromUrl(String(animation.generatedSpritesheet));
    if (spritesheetPath) {
      const recomposedName = `spritesheet_${Date.now()}_recomposed.png`;
      const recomposedPath = storagePath("animations", id, "generated", recomposedName);
      try {
        await composeSpritesheet({
          framesDir,
          outputPath: recomposedPath,
          layout: animation.spritesheetLayout,
        });
        updatedAnimation.generatedSpritesheet = `/api/storage/animations/${id}/generated/${recomposedName}`;
      } catch {
        // If recomposition fails, keep existing spritesheet.
      }
    }
  }

  await writeJson(animationPath, updatedAnimation);

  return Response.json({ animation: updatedAnimation, keyframe: updatedKeyframe });
}
