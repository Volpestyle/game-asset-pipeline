import crypto from "crypto";
import {
  ensureDir,
  listDirectories,
  readJson,
  storagePath,
  writeJson,
  fileExists,
} from "@/lib/storage";
import {
  getDefaultVideoSize,
  coerceVideoSizeForModel,
} from "@/lib/ai/soraConstraints";

export const runtime = "nodejs";

const ANIMATIONS_DIR = storagePath("animations");

export async function GET() {
  await ensureDir(ANIMATIONS_DIR);
  const ids = await listDirectories(ANIMATIONS_DIR);
  const animations = [];

  for (const id of ids) {
    const filePath = storagePath("animations", id, "animation.json");
    try {
      const animation = await readJson(filePath);
      animations.push(animation);
    } catch {
      // Ignore malformed entries for now.
    }
  }

  return Response.json({ animations });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const {
    characterId,
    name,
    description,
    frameCount,
    fps,
    style,
    spriteSize,
    generationModel,
    generationProvider,
    generationSeconds,
    generationSize,
    extractFps,
    loopMode,
    sheetColumns,
    frameWidth,
    frameHeight,
    referenceImageId,
    keyframes = [],
  } = payload ?? {};

  if (!characterId || !name || !description) {
    return Response.json(
      { error: "Missing characterId, name, or description." },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const animationDir = storagePath("animations", id);
  await ensureDir(animationDir);
  await ensureDir(storagePath("animations", id, "generated"));
  await ensureDir(storagePath("animations", id, "exports"));
  await ensureDir(storagePath("animations", id, "keyframes"));

  const now = new Date().toISOString();
  let resolvedFrameWidth = Number(frameWidth ?? 0);
  let resolvedFrameHeight = Number(frameHeight ?? 0);

  if (!resolvedFrameWidth || !resolvedFrameHeight) {
    const characterPath = storagePath("characters", characterId, "character.json");
    if (await fileExists(characterPath)) {
      const character = await readJson<Record<string, unknown>>(characterPath);
      resolvedFrameWidth = Number(character.baseWidth ?? 253);
      resolvedFrameHeight = Number(character.baseHeight ?? 504);
    } else {
      resolvedFrameWidth = 253;
      resolvedFrameHeight = 504;
    }
  }

  const requestedExtractFps = Number(extractFps ?? fps ?? 6);
  const resolvedExtractFps = [6, 8, 12].includes(requestedExtractFps)
    ? requestedExtractFps
    : 6;
  const requestedSeconds = Number(generationSeconds ?? 4);
  const resolvedSeconds = [4, 8, 12].includes(requestedSeconds)
    ? requestedSeconds
    : 4;
  const expectedFrameCount = resolvedSeconds * resolvedExtractFps;

  const resolvedModel = String(generationModel ?? "sora-2");
  const requestedSize = String(generationSize ?? getDefaultVideoSize(resolvedModel));
  const resolvedSize = coerceVideoSizeForModel(requestedSize, resolvedModel);

  const resolvedColumns = Math.max(1, Number(sheetColumns ?? 6));

  const animation = {
    id,
    characterId,
    referenceImageId: referenceImageId ?? null,
    name,
    description,
    frameCount: Number(frameCount ?? expectedFrameCount),
    fps: Number(fps ?? resolvedExtractFps),
    style: style ?? "idle",
    spriteSize: Number(spriteSize ?? resolvedFrameWidth),
    frameWidth: resolvedFrameWidth,
    frameHeight: resolvedFrameHeight,
    generationProvider: String(generationProvider ?? "openai"),
    generationModel: resolvedModel,
    generationSeconds: resolvedSeconds,
    generationSize: resolvedSize,
    extractFps: resolvedExtractFps,
    loopMode: (loopMode ?? "loop") === "pingpong" ? "pingpong" : "loop",
    sheetColumns: resolvedColumns,
    keyframes,
    generatedFrames: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  await writeJson(storagePath("animations", id, "animation.json"), animation);

  return Response.json({ animation });
}
