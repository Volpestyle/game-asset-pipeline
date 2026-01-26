import { fileExists, readJson, storagePath, writeJson } from "./storage";
import { DEFAULT_PROJECT_SETTINGS } from "./canvasNormalization";
import type { ProjectSettings } from "@/types";

const PROJECT_SETTINGS_PATH = storagePath("project.json");

/**
 * Get project settings, creating defaults if they don't exist
 */
export async function getProjectSettings(): Promise<ProjectSettings> {
  if (!(await fileExists(PROJECT_SETTINGS_PATH))) {
    await writeJson(PROJECT_SETTINGS_PATH, {
      ...DEFAULT_PROJECT_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
    return DEFAULT_PROJECT_SETTINGS;
  }

  const settings = await readJson<ProjectSettings>(PROJECT_SETTINGS_PATH);
  return {
    ...DEFAULT_PROJECT_SETTINGS,
    ...settings,
  };
}

/**
 * Update project settings
 */
export async function updateProjectSettings(
  updates: Partial<ProjectSettings>
): Promise<ProjectSettings> {
  const current = await getProjectSettings();
  const updated: ProjectSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate
  if (updated.canvasWidth < 16 || updated.canvasWidth > 4096) {
    throw new Error("Canvas width must be between 16 and 4096");
  }
  if (updated.canvasHeight < 16 || updated.canvasHeight > 4096) {
    throw new Error("Canvas height must be between 16 and 4096");
  }
  if (updated.defaultScale < 0.1 || updated.defaultScale > 1.0) {
    throw new Error("Default scale must be between 0.1 and 1.0");
  }

  await writeJson(PROJECT_SETTINGS_PATH, updated);
  return updated;
}
