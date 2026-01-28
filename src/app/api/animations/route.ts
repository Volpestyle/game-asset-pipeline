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
  getDefaultVideoSeconds,
  coerceVideoSecondsForModel,
  getVideoModelPromptProfile,
  getVideoModelConfig,
} from "@/lib/ai/soraConstraints";
import { buildVideoPrompt } from "@/lib/ai/promptBuilder";

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
    generationLoop,
    promptProfile,
    promptConcise,
    promptVerbose,
    generationNegativePrompt,
    generationContinuationEnabled,
    extractFps,
    loopMode,
    sheetColumns,
    frameWidth,
    frameHeight,
    referenceImageId,
    keyframes = [],
    tooncrafterInterpolate,
    tooncrafterColorCorrection,
    tooncrafterSeed,
    tooncrafterNegativePrompt,
    tooncrafterEmptyPrompt,
  } = payload ?? {};

  const resolvedStyle = String(style ?? "idle");
  const resolvedDescription = String(description ?? "");
  if (!characterId || !name || (resolvedStyle === "custom" && !resolvedDescription)) {
    return Response.json(
      {
        error:
          resolvedStyle === "custom"
            ? "Custom animations require a description."
            : "Missing characterId or name.",
      },
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
  let characterStyle: string | undefined;
  let bgKeyColor: string | undefined;

  const characterPath = storagePath("characters", characterId, "character.json");
  if (await fileExists(characterPath)) {
    const character = await readJson<Record<string, unknown>>(characterPath);
    characterStyle = String(character.style ?? "");
    bgKeyColor = String(
      (character.workingSpec as { bgKeyColor?: string } | undefined)?.bgKeyColor ?? ""
    );
    if (!resolvedFrameWidth || !resolvedFrameHeight) {
      resolvedFrameWidth = Number(character.baseWidth ?? 253);
      resolvedFrameHeight = Number(character.baseHeight ?? 504);
    }
  }

  if (!resolvedFrameWidth || !resolvedFrameHeight) {
    resolvedFrameWidth = 253;
    resolvedFrameHeight = 504;
  }

  const requestedExtractFps = Number(extractFps ?? fps ?? 12);
  const resolvedExtractFps = [6, 8, 12, 24].includes(requestedExtractFps)
    ? requestedExtractFps
    : 12;
  const resolvedModel = String(generationModel ?? "sora-2");
  const requestedProvider = String(generationProvider ?? "").trim();
  if (
    requestedProvider !== "openai" &&
    requestedProvider !== "replicate" &&
    requestedProvider !== "fal" &&
    requestedProvider !== "vertex"
  ) {
    return Response.json(
      {
        error:
          "Generation provider is required. Select OpenAI, Replicate, Fal, or Vertex AI.",
      },
      { status: 400 }
    );
  }
  const modelProvider = getVideoModelConfig(resolvedModel).provider;
  if (requestedProvider !== modelProvider) {
    return Response.json(
      {
        error: `Generation provider (${requestedProvider}) does not match model provider (${modelProvider}).`,
      },
      { status: 400 }
    );
  }
  const requestedSeconds = Number(generationSeconds ?? getDefaultVideoSeconds(resolvedModel));
  const resolvedSeconds = coerceVideoSecondsForModel(requestedSeconds, resolvedModel);
  const expectedFrameCount = resolvedSeconds * resolvedExtractFps;

  const requestedSize = String(generationSize ?? getDefaultVideoSize(resolvedModel));
  const resolvedSize = coerceVideoSizeForModel(requestedSize, resolvedModel);
  const resolvedColumns = Math.max(1, Number(sheetColumns ?? 6));
  const requestedPromptProfile = String(promptProfile ?? "").trim();
  const resolvedPromptProfile =
    requestedPromptProfile === "concise" || requestedPromptProfile === "verbose"
      ? requestedPromptProfile
      : getVideoModelPromptProfile(resolvedModel);
  const resolvedNegativePrompt =
    typeof tooncrafterNegativePrompt === "string"
      ? tooncrafterNegativePrompt.trim()
      : "";
  const resolvedGenerationNegativePrompt =
    typeof generationNegativePrompt === "string"
      ? generationNegativePrompt.trim()
      : "";
  const resolvedContinuationEnabled = generationContinuationEnabled === true;
  const artStyle = characterStyle || "pixel-art";
  const autoPromptConcise = buildVideoPrompt({
    description: String(description ?? ""),
    style: String(style ?? ""),
    artStyle,
    bgKeyColor: bgKeyColor || undefined,
    promptProfile: "concise",
  });
  const autoPromptVerbose = buildVideoPrompt({
    description: String(description ?? ""),
    style: String(style ?? ""),
    artStyle,
    bgKeyColor: bgKeyColor || undefined,
    promptProfile: "verbose",
  });
  const requestedConcise = typeof promptConcise === "string" ? promptConcise : "";
  const requestedVerbose = typeof promptVerbose === "string" ? promptVerbose : "";
  const resolvedPromptConcise = requestedConcise.trim() ? requestedConcise : autoPromptConcise;
  const resolvedPromptVerbose = requestedVerbose.trim() ? requestedVerbose : autoPromptVerbose;

  const animation = {
    id,
    characterId,
    referenceImageId: referenceImageId ?? null,
    name,
    description: resolvedDescription,
    frameCount: Number(frameCount ?? expectedFrameCount),
    fps: Number(fps ?? resolvedExtractFps),
    style: resolvedStyle,
    spriteSize: Number(spriteSize ?? resolvedFrameWidth),
    frameWidth: resolvedFrameWidth,
    frameHeight: resolvedFrameHeight,
    generationProvider: requestedProvider,
    generationModel: resolvedModel,
    promptProfile: resolvedPromptProfile,
    promptConcise: resolvedPromptConcise,
    promptVerbose: resolvedPromptVerbose,
    generationSeconds: resolvedSeconds,
    generationSize: resolvedSize,
    generationLoop: generationLoop === true,
    generationStartImageUrl: null,
    generationEndImageUrl: null,
    generationContinuationEnabled: resolvedContinuationEnabled,
    generationContinuationVideoUrl: null,
    generationNegativePrompt: resolvedGenerationNegativePrompt
      ? resolvedGenerationNegativePrompt
      : null,
    tooncrafterInterpolate: tooncrafterInterpolate === true,
    tooncrafterColorCorrection:
      typeof tooncrafterColorCorrection === "boolean"
        ? tooncrafterColorCorrection
        : true,
    tooncrafterSeed:
      typeof tooncrafterSeed === "number" && Number.isFinite(tooncrafterSeed)
        ? tooncrafterSeed
        : null,
    tooncrafterNegativePrompt: resolvedNegativePrompt ? resolvedNegativePrompt : null,
    tooncrafterEmptyPrompt: tooncrafterEmptyPrompt === true,
    extractFps: resolvedExtractFps,
    loopMode: (loopMode ?? "loop") === "pingpong" ? "pingpong" : "loop",
    sheetColumns: resolvedColumns,
    keyframes,
    generatedFrames: [],
    status: "draft",
    versions: [],
    activeVersionId: null,
    versionCounter: 0,
    createdAt: now,
    updatedAt: now,
  };

  await writeJson(storagePath("animations", id, "animation.json"), animation);

  return Response.json({ animation });
}
