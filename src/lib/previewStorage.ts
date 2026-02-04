import { ensureDir, fileExists, readJson, storagePath, writeJson } from "@/lib/storage";
import type { PreviewConfig, PreviewState } from "@/app/preview/[characterId]/types";
import { createDefaultConfig } from "@/app/preview/[characterId]/types";
import { logger } from "@/lib/logger";

export function previewConfigPath(characterId: string): string {
  return storagePath("preview", characterId, "config.json");
}

function normalizePreviewConfig(
  characterId: string,
  config: PreviewConfig
): PreviewConfig {
  if (!Array.isArray(config.states)) {
    logger.warn("Preview config: missing states, resetting to defaults", {
      characterId,
    });
    return createDefaultConfig(characterId);
  }

  const states: PreviewState[] = config.states.filter(
    (state) =>
      state.id &&
      typeof state.id === "string" &&
      state.name &&
      typeof state.name === "string"
  );

  const resolvedDefaultStateId = states.some((state) => state.id === config.defaultStateId)
    ? config.defaultStateId
    : states[0]?.id ?? "";

  return {
    ...createDefaultConfig(characterId),
    ...config,
    characterId,
    states,
    defaultStateId: resolvedDefaultStateId,
    keyBindings: Array.isArray(config.keyBindings)
      ? config.keyBindings.filter((binding) =>
          states.some((state) => state.id === binding.stateId)
        )
      : [],
  };
}

export async function getPreviewConfig(characterId: string): Promise<PreviewConfig> {
  const filePath = previewConfigPath(characterId);

  if (await fileExists(filePath)) {
    const config = await readJson<PreviewConfig>(filePath);
    return normalizePreviewConfig(characterId, config);
  }

  // Return default config if none exists
  return createDefaultConfig(characterId);
}

export async function savePreviewConfig(config: PreviewConfig): Promise<PreviewConfig> {
  const filePath = previewConfigPath(config.characterId);
  const dirPath = storagePath("preview", config.characterId);

  await ensureDir(dirPath);

  const updated: PreviewConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(filePath, updated);
  return updated;
}
