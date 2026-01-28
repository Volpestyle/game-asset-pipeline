import path from "path";
import { logger } from "@/lib/logger";
import {
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import type { Animation, Keyframe, KeyframeGeneration } from "@/types";

export const runtime = "nodejs";

type SaveGenerationPayload = {
  frameIndex?: number;
  generation?: KeyframeGeneration;
};

function updateKeyframes(list: Keyframe[], entry: Keyframe) {
  const index = list.findIndex((item) => item.frameIndex === entry.frameIndex);
  if (index === -1) {
    return [...list, entry].sort((a, b) => a.frameIndex - b.frameIndex);
  }
  const updated = [...list];
  updated[index] = entry;
  return updated;
}

function normalizeSource(value: string | undefined) {
  if (value === "generate" || value === "refine" || value === "upload" || value === "select") {
    return value;
  }
  return "select";
}

function toOptionalString(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toOptionalNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toOptionalBoolean(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "1" || value === "yes";
  }
  return undefined;
}

function normalizeModel(value: string | undefined) {
  if (
    value === "rd-fast" ||
    value === "rd-plus" ||
    value === "nano-banana-pro" ||
    value === "flux-2-max"
  ) {
    return value;
  }
  return undefined;
}

function buildSavedGeneration(raw: KeyframeGeneration): KeyframeGeneration {
  const image = toOptionalString(raw.image) ?? "";
  const id = toOptionalString(raw.id) ?? "";
  const createdAt = toOptionalString(raw.createdAt) ?? new Date().toISOString();
  const source = normalizeSource(raw.source);
  const modelValue = normalizeModel(toOptionalString(raw.model));

  return {
    id,
    image,
    createdAt,
    source,
    prompt: toOptionalString(raw.prompt),
    model: modelValue,
    style: toOptionalString(raw.style),
    strength: toOptionalNumber(raw.strength),
    inputPalette: toOptionalString(raw.inputPalette),
    tileX: toOptionalBoolean(raw.tileX),
    tileY: toOptionalBoolean(raw.tileY),
    removeBg: toOptionalBoolean(raw.removeBg),
    seed: toOptionalNumber(raw.seed),
    bypassPromptExpansion: toOptionalBoolean(raw.bypassPromptExpansion),
    numImages: toOptionalNumber(raw.numImages),
    outputFormat: toOptionalString(raw.outputFormat),
    safetyFilterLevel: toOptionalString(raw.safetyFilterLevel),
    saved: true,
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

  let payload: SaveGenerationPayload | null = null;
  try {
    payload = await request.json();
  } catch (err) {
    logger.warn("Keyframe generation save: invalid JSON", {
      animationId: id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const frameIndexValue = payload.frameIndex;
  const generationValue = payload.generation;
  const frameIndex = typeof frameIndexValue === "number" ? frameIndexValue : Number(frameIndexValue);

  if (!Number.isFinite(frameIndex) || frameIndex < 0) {
    return Response.json({ error: "Invalid frame index." }, { status: 400 });
  }

  if (!generationValue || typeof generationValue !== "object" || Array.isArray(generationValue)) {
    return Response.json({ error: "Missing generation data." }, { status: 400 });
  }

  const candidate = buildSavedGeneration(generationValue);
  if (!candidate.image || !candidate.id) {
    return Response.json({ error: "Generation is missing required fields." }, { status: 400 });
  }

  const imagePath = storagePathFromUrl(candidate.image);
  if (!imagePath) {
    return Response.json({ error: "Invalid generation image URL." }, { status: 400 });
  }
  const keyframesDir = storagePath("animations", id, "keyframes");
  const normalized = path.normalize(imagePath);
  if (!normalized.startsWith(`${keyframesDir}${path.sep}`)) {
    return Response.json({ error: "Generation image is not a keyframe asset." }, { status: 400 });
  }
  if (!(await fileExists(imagePath))) {
    return Response.json({ error: "Generation image not found." }, { status: 404 });
  }

  const animation = await readJson<Animation>(animationPath);
  const keyframes = Array.isArray(animation.keyframes) ? animation.keyframes : [];
  const target = keyframes.find((item) => item.frameIndex === frameIndex);

  if (!target) {
    return Response.json({ error: "Keyframe not found." }, { status: 404 });
  }

  const existingGenerations = Array.isArray(target.generations) ? target.generations : [];
  const existingIndex = existingGenerations.findIndex(
    (item) => item.id === candidate.id || item.image === candidate.image
  );

  let savedGeneration = candidate;
  let updatedGenerations = existingGenerations;

  if (existingIndex >= 0) {
    const updated = { ...existingGenerations[existingIndex], ...candidate, saved: true };
    updatedGenerations = [...existingGenerations];
    updatedGenerations[existingIndex] = updated;
    savedGeneration = updated;
  } else {
    updatedGenerations = [candidate, ...existingGenerations];
  }

  const updatedKeyframe: Keyframe = {
    ...target,
    generations: updatedGenerations,
    updatedAt: new Date().toISOString(),
  };

  const updatedAnimation: Animation = {
    ...animation,
    keyframes: updateKeyframes(keyframes, updatedKeyframe),
    updatedAt: new Date().toISOString(),
  };

  await writeJson(animationPath, updatedAnimation);

  logger.info("Keyframe generation saved", {
    animationId: id,
    frameIndex,
    generationId: savedGeneration.id,
  });

  return Response.json({ animation: updatedAnimation, generation: savedGeneration });
}
