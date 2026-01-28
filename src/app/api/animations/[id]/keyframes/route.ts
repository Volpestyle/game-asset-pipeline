import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { runReplicateModel } from "@/lib/ai/replicate";
import { logger } from "@/lib/logger";
import { fileToDataUrl, getExtensionForMime, parseDataUrl } from "@/lib/dataUrl";
import { getShutdownSignal } from "@/lib/shutdown";
import { composeSpritesheet, writeFrameImage } from "@/lib/spritesheet";
import { parseBoolean } from "@/lib/parsing";
import {
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import { inferAspectRatio, inferResolution } from "@/lib/videoMetrics";
import type { Animation as AnimationModel, Keyframe, KeyframeGeneration } from "@/types";

export const runtime = "nodejs";

const RD_FAST_MODEL = process.env.RD_FAST_MODEL?.trim() || "retro-diffusion/rd-fast";
const RD_PLUS_MODEL = process.env.RD_PLUS_MODEL?.trim() || "retro-diffusion/rd-plus";
const RD_FAST_VERSION = process.env.RD_FAST_VERSION?.trim() || undefined;
const RD_PLUS_VERSION = process.env.RD_PLUS_VERSION?.trim() || undefined;
const NANO_BANANA_MODEL =
  process.env.NANO_BANANA_MODEL?.trim() || "google/nano-banana-pro";
const NANO_BANANA_VERSION = process.env.NANO_BANANA_VERSION?.trim() || undefined;
const FLUX_2_MAX_MODEL =
  process.env.FLUX_2_MAX_MODEL?.trim() || "black-forest-labs/flux-2-max";
const FLUX_2_MAX_VERSION = process.env.FLUX_2_MAX_VERSION?.trim() || undefined;

type FluxResolution = "0.5 MP" | "1 MP" | "2 MP" | "4 MP";

function inferFluxResolution(
  width: number,
  height: number
): FluxResolution | undefined {
  if (!width || !height) return undefined;
  const megaPixels = (width * height) / 1_000_000;
  if (!Number.isFinite(megaPixels) || megaPixels <= 0) return undefined;
  if (megaPixels <= 0.75) return "0.5 MP";
  if (megaPixels <= 1.5) return "1 MP";
  if (megaPixels <= 3) return "2 MP";
  return "4 MP";
}


function parseNumber(value: FormDataEntryValue | null, fallback: number) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const modeInput = String(formData.get("mode") ?? "upload");
  const mode =
    modeInput === "generate" || modeInput === "refine" || modeInput === "select"
      ? modeInput
      : "upload";
  const frameIndex = parseNumber(formData.get("frameIndex"), -1);
  const promptInput = String(formData.get("prompt") ?? "").trim();
  const modelInput = String(formData.get("model") ?? "rd-fast");
  const model =
    modelInput === "nano-banana-pro"
      ? "nano-banana-pro"
      : modelInput === "flux-2-max"
        ? "flux-2-max"
        : modelInput === "rd-plus"
          ? "rd-plus"
          : "rd-fast";
  const styleInput = String(formData.get("style") ?? "").trim();
  const selectedImageUrl = String(formData.get("imageUrl") ?? "").trim();
  const strength = parseNumber(formData.get("strength"), 0.4);
  const removeBg = parseBoolean(formData.get("removeBg"));
  const bypassPromptExpansion = parseBoolean(formData.get("bypassPromptExpansion"));
  const tileX = parseBoolean(formData.get("tileX"));
  const tileY = parseBoolean(formData.get("tileY"));
  const seedRaw = formData.get("seed");
  const seed = seedRaw == null || seedRaw === "" ? null : Number(seedRaw);
  const numImagesRaw = parseNumber(formData.get("numImages"), 1);
  const outputFormatInput = String(formData.get("outputFormat") ?? "")
    .trim()
    .toLowerCase();
  const safetyFilterInput = String(formData.get("safetyFilterLevel") ?? "")
    .trim();

  // Parse reference images array (for multi-image models like nano-banana-pro or flux-2-max)
  const referenceImagesRaw = formData.get("referenceImages");
  let referenceImageUrls: string[] = [];
  if (referenceImagesRaw && typeof referenceImagesRaw === "string") {
    try {
      const parsed = JSON.parse(referenceImagesRaw);
      if (Array.isArray(parsed)) {
        referenceImageUrls = parsed.filter((url): url is string => typeof url === "string");
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  const animation = await readJson<AnimationModel>(animationPath);
  const totalFrames = Number(animation.actualFrameCount ?? animation.frameCount ?? 0);
  if (!Number.isFinite(frameIndex) || frameIndex < 0 || frameIndex >= totalFrames) {
    return Response.json({ error: "Invalid frame index." }, { status: 400 });
  }

  const keyframes = (animation.keyframes as Keyframe[] | undefined) ?? [];
  const existingKeyframe = keyframes.find((item) => item.frameIndex === frameIndex);

  const file = formData.get("image");
  const paletteInput = formData.get("inputPalette");
  const shouldGenerate = mode === "generate" || mode === "refine";

  let outputBuffer: Buffer | null = null;
  let outputExt = ".png";
  let generatedBuffers: Buffer[] = [];
  let generatedFilenames: string[] = [];
  let outputUrls: string[] = [];
  let paletteUrl: string | undefined;
  let resolvedStyle: string | undefined = styleInput || undefined;
  let resolvedNumImages: number | null = null;
  let resolvedOutputFormat: string | null = null;
  let resolvedSafetyFilter: string | null = null;
  let selectedImageFilename: string | null = null;

  if (shouldGenerate) {
    logger.info("Keyframe generation request", {
      animationId: id,
      frameIndex,
      model,
      mode,
      referenceImageCount: referenceImageUrls.length,
    });

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
    const promptBase = promptInput || String(animation.description ?? "").trim();
    const prompt =
      model === "nano-banana-pro" ? promptBase || "pixel art sprite" : promptBase;

    if (model === "nano-banana-pro") {
    const input: Record<string, unknown> = {
      prompt,
    };

    const allowedFormats = ["png", "jpg", "jpeg"];
    const formatCandidate = outputFormatInput || "png";
    const resolvedFormat = allowedFormats.includes(formatCandidate)
      ? formatCandidate
      : "png";
    if (formatCandidate && !allowedFormats.includes(formatCandidate)) {
      logger.warn("Nano Banana output format invalid", {
        requested: formatCandidate,
        resolved: resolvedFormat,
      });
    }
    resolvedOutputFormat = resolvedFormat;
    outputExt = resolvedFormat === "jpg" || resolvedFormat === "jpeg" ? ".jpg" : ".png";
    input.output_format = resolvedFormat;

    const safetyOptions = [
      "block_only_high",
      "block_medium_and_above",
      "block_low_and_above",
    ];
    const safetyCandidate = safetyFilterInput || "block_only_high";
    const resolvedSafety = safetyOptions.includes(safetyCandidate)
      ? safetyCandidate
      : "block_only_high";
    if (safetyCandidate && !safetyOptions.includes(safetyCandidate)) {
      logger.warn("Nano Banana safety filter invalid", {
        requested: safetyCandidate,
        resolved: resolvedSafety,
      });
    }
    resolvedSafetyFilter = resolvedSafety;
    input.safety_filter_level = resolvedSafety;

      const aspectRatio = inferAspectRatio(frameWidth, frameHeight);
      if (aspectRatio) {
        input.aspect_ratio = aspectRatio;
      }
      const resolution = inferResolution(frameWidth, frameHeight);
      if (resolution) {
        input.resolution = resolution;
      }

      // Handle multiple reference images
      if (referenceImageUrls.length > 0) {
        const imageInputs: string[] = [];
        for (const url of referenceImageUrls) {
          const refPath = storagePathFromUrl(url);
          if (refPath && (await fileExists(refPath))) {
            imageInputs.push(await fileToDataUrl(refPath));
          }
        }
        if (imageInputs.length > 0) {
          input.image_input = imageInputs;
        }
      } else if (inputImagePath) {
        // Fallback to single uploaded image
        input.image_input = [await fileToDataUrl(inputImagePath)];
      }

      const prediction = await runReplicateModel({
        version: NANO_BANANA_VERSION,
        model: NANO_BANANA_MODEL,
        input,
      });

      const output = prediction.output;
      if (typeof output === "string") {
        outputUrls = [output];
      } else if (Array.isArray(output)) {
        outputUrls = output.filter((url) => typeof url === "string");
      } else if (output && typeof output === "object" && "url" in output) {
        const maybeUrl = output.url;
        if (typeof maybeUrl === "string") {
          outputUrls = [maybeUrl];
        }
      }
    } else if (model === "flux-2-max") {
      if (referenceImageUrls.length > 8) {
        return Response.json(
          { error: "Flux 2 Max supports up to 8 reference images." },
          { status: 400 }
        );
      }

      const input: Record<string, unknown> = {
        prompt,
        output_format: "png",
      };

      const imageInputs: string[] = [];
      let resolvedAspectRatio: string | undefined;
      let resolvedResolution: string | undefined;
      if (referenceImageUrls.length > 0) {
        for (const url of referenceImageUrls) {
          const refPath = storagePathFromUrl(url);
          if (refPath && (await fileExists(refPath))) {
            imageInputs.push(await fileToDataUrl(refPath));
          }
        }
      } else if (inputImagePath) {
        imageInputs.push(await fileToDataUrl(inputImagePath));
      }

      if (imageInputs.length > 0) {
        input.input_images = imageInputs;
        resolvedAspectRatio = "match_input_image";
        resolvedResolution = "match_input_image";
      } else {
        const aspectRatio = inferAspectRatio(frameWidth, frameHeight);
        if (aspectRatio) {
          resolvedAspectRatio = aspectRatio;
        }
        const resolution = inferFluxResolution(frameWidth, frameHeight);
        if (resolution) {
          resolvedResolution = resolution;
        }
      }

      if (resolvedAspectRatio) {
        input.aspect_ratio = resolvedAspectRatio;
      }
      if (resolvedResolution) {
        input.resolution = resolvedResolution;
      }

      if (Number.isFinite(seed)) {
        input.seed = seed;
      }

      logger.info("Flux keyframe input resolved", {
        animationId: id,
        frameIndex,
        imageCount: imageInputs.length,
        aspectRatio: resolvedAspectRatio,
        resolution: resolvedResolution,
      });

      const prediction = await runReplicateModel({
        version: FLUX_2_MAX_VERSION,
        model: FLUX_2_MAX_MODEL,
        input,
      });

      const output = prediction.output;
      if (typeof output === "string") {
        outputUrls = [output];
      } else if (Array.isArray(output)) {
        outputUrls = output.filter((url) => typeof url === "string");
      } else if (output && typeof output === "object" && "url" in output) {
        const maybeUrl = output.url;
        if (typeof maybeUrl === "string") {
          outputUrls = [maybeUrl];
        }
      }
    } else {
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
      resolvedStyle = style;

      const input: Record<string, unknown> = {
        prompt,
        style,
        width: frameWidth,
        height: frameHeight,
        remove_bg: removeBg,
      };

      const requestedNumImages = Number.isFinite(numImagesRaw)
        ? Math.round(numImagesRaw)
        : 1;
      resolvedNumImages = Math.min(4, Math.max(1, requestedNumImages));
      if (resolvedNumImages !== requestedNumImages) {
        logger.warn("RD num_images clamped", {
          requested: requestedNumImages,
          resolved: resolvedNumImages,
        });
      }
      input.num_images = resolvedNumImages;

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

      if (paletteInput && typeof paletteInput === "string") {
        const parsed = parseDataUrl(paletteInput);
        if (parsed) {
          const ext = getExtensionForMime(parsed.mime) ?? ".png";
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
      if (typeof output === "string") {
        outputUrls = [output];
      } else if (Array.isArray(output)) {
        outputUrls = output.filter((url) => typeof url === "string");
      } else if (output && typeof output === "object" && "url" in output) {
        const maybeUrl = output.url;
        if (typeof maybeUrl === "string") {
          outputUrls = [maybeUrl];
        }
      }
    }

    if (outputUrls.length === 0) {
      return Response.json({ error: "No output returned." }, { status: 500 });
    }

    for (const outputUrl of outputUrls) {
      const outputResponse = await fetch(outputUrl, { signal: getShutdownSignal() });
      if (!outputResponse.ok) {
        return Response.json({ error: "Failed to download output." }, { status: 500 });
      }
      const buffer = Buffer.from(await outputResponse.arrayBuffer());
      generatedBuffers.push(buffer);
    }

    if (generatedBuffers.length === 0) {
      return Response.json({ error: "No output returned." }, { status: 500 });
    }

    const generationTimestamp = Date.now();
    generatedFilenames = generatedBuffers.map(
      (_, index) =>
        `frame_${String(frameIndex).padStart(3, "0")}_${generationTimestamp}_${index}${outputExt}`
    );
    outputBuffer = generatedBuffers[0];
  } else if (mode === "select") {
    if (paletteInput && typeof paletteInput === "string") {
      paletteUrl = paletteInput.trim() || undefined;
    }
    if (!selectedImageUrl) {
      return Response.json({ error: "Missing image URL for selection." }, { status: 400 });
    }
    const selectedPath = storagePathFromUrl(selectedImageUrl);
    if (!selectedPath) {
      return Response.json({ error: "Invalid image URL for selection." }, { status: 400 });
    }
    const keyframesDir = storagePath("animations", id, "keyframes");
    const normalized = path.normalize(selectedPath);
    if (!normalized.startsWith(`${keyframesDir}${path.sep}`)) {
      return Response.json({ error: "Image URL is not a keyframe asset." }, { status: 400 });
    }
    if (!(await fileExists(selectedPath))) {
      return Response.json({ error: "Selected image not found." }, { status: 404 });
    }
    outputBuffer = await fs.readFile(selectedPath);
    outputExt = path.extname(selectedPath) || ".png";
    selectedImageFilename = path.basename(selectedPath);
  } else if (file && typeof (file as File).arrayBuffer === "function") {
    const inputFile = file as File;
    outputBuffer = Buffer.from(await inputFile.arrayBuffer());
    outputExt = path.extname(inputFile.name) || ".png";
  }

  if (!outputBuffer) {
    return Response.json({ error: "No image provided." }, { status: 400 });
  }

  const filename =
    selectedImageFilename ??
    generatedFilenames[0] ??
    `frame_${String(frameIndex).padStart(3, "0")}_${Date.now()}${outputExt}`;
  const keyframePath = storagePath("animations", id, "keyframes", filename);
  if (!selectedImageFilename) {
    await fs.mkdir(path.dirname(keyframePath), { recursive: true });
    await fs.writeFile(keyframePath, outputBuffer);
  }

  if (generatedFilenames.length > 1) {
    for (let i = 1; i < generatedFilenames.length; i += 1) {
      const name = generatedFilenames[i];
      const buffer = generatedBuffers[i];
      if (!buffer) continue;
      const outputPath = storagePath("animations", id, "keyframes", name);
      await fs.writeFile(outputPath, buffer);
    }
  }

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

  const normalizedStrength = Math.min(1, Math.max(0, strength));
  const normalizedSeed =
    typeof seed === "number" && Number.isFinite(seed) ? seed : undefined;
  const normalizedNumImages =
    typeof resolvedNumImages === "number" ? resolvedNumImages : undefined;
  const outputFormatValue = resolvedOutputFormat ?? undefined;
  const safetyFilterValue = resolvedSafetyFilter ?? undefined;
  const updatedKeyframe: Keyframe = {
    frameIndex,
    image: `/api/storage/animations/${id}/keyframes/${filename}`,
    prompt: promptInput || existingKeyframe?.prompt,
    model,
    strength: normalizedStrength,
    generations: existingKeyframe?.generations,
    inputPalette: paletteUrl ?? existingKeyframe?.inputPalette,
    tileX,
    tileY,
    removeBg,
    seed: normalizedSeed,
    bypassPromptExpansion,
    updatedAt: new Date().toISOString(),
  };
  const generationEntries: KeyframeGeneration[] = [];
  if (shouldGenerate) {
    const filenames =
      generatedFilenames.length > 0 ? generatedFilenames : [filename];
    for (const generatedName of filenames) {
      generationEntries.push({
        id: crypto.randomUUID(),
        image: `/api/storage/animations/${id}/keyframes/${generatedName}`,
        createdAt: new Date().toISOString(),
        source: mode,
        prompt: promptInput || existingKeyframe?.prompt,
        model,
        style: resolvedStyle,
        strength: normalizedStrength,
        inputPalette: paletteUrl ?? existingKeyframe?.inputPalette,
        tileX,
        tileY,
        removeBg,
        seed: normalizedSeed,
        bypassPromptExpansion,
        numImages: normalizedNumImages,
        outputFormat: outputFormatValue,
        safetyFilterLevel: safetyFilterValue,
        saved: false,
      });
    }
  }
  const generationEntry = generationEntries[0] ?? null;

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
        source: model,
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

  return Response.json({
    animation: updatedAnimation,
    keyframe: updatedKeyframe,
    generation: generationEntry,
    generations: generationEntries.length > 0 ? generationEntries : undefined,
  });
}
