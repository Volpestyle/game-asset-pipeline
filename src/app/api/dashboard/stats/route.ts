import { promises as fs } from "fs";
import { logger } from "@/lib/logger";
import {
  ensureDir,
  listDirectories,
  readJson,
  storagePath,
  fileExists,
} from "@/lib/storage";
import type { Animation, Character } from "@/types";

export const runtime = "nodejs";

type DashboardStats = {
  characters: number;
  animations: number;
  framesGenerated: number;
  exports: number;
};

type AnimationStats = {
  framesGenerated: number;
  hasExports: boolean;
};

const CHARACTERS_DIR = storagePath("characters");
const ANIMATIONS_DIR = storagePath("animations");

function toSafeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

async function countPngFiles(dirPath: string) {
  if (!(await fileExists(dirPath))) {
    return null;
  }
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const count = entries.filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png")
    ).length;
    return count;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn("Dashboard stats: failed to read PNG frames", {
      dirPath,
      error: message,
    });
    return null;
  }
}

async function hasExportFiles(animationId: string) {
  const exportDir = storagePath("animations", animationId, "exports");
  if (!(await fileExists(exportDir))) {
    return false;
  }
  try {
    const entries = await fs.readdir(exportDir, { withFileTypes: true });
    return entries.some((entry) => entry.isFile());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn("Dashboard stats: failed to read exports directory", {
      exportDir,
      error: message,
    });
    return false;
  }
}

function hasExportMetadata(animation: Animation) {
  const exportsData = animation.exports;
  if (!exportsData) {
    return false;
  }
  return Boolean(
    exportsData.spritesheetUrl ||
      exportsData.asepriteJsonArrayUrl ||
      exportsData.asepriteJsonHashUrl ||
      exportsData.pngSequenceUrl ||
      exportsData.zipBundleUrl ||
      exportsData.lastExportedAt
  );
}

function resolveMetadataFrameCount(animation: Animation) {
  const generatedCount = Array.isArray(animation.generatedFrames)
    ? animation.generatedFrames.length
    : 0;
  const actualCount =
    typeof animation.actualFrameCount === "number" && Number.isFinite(animation.actualFrameCount)
      ? animation.actualFrameCount
      : 0;
  return Math.max(generatedCount, actualCount);
}

async function loadAnimationStats(animationId: string): Promise<AnimationStats | null> {
  const animationPath = storagePath("animations", animationId, "animation.json");
  let animation: Animation;
  try {
    animation = await readJson<Animation>(animationPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn("Dashboard stats: failed to read animation", {
      animationId,
      error: message,
    });
    return null;
  }

  const framesDir = storagePath("animations", animationId, "generated", "frames");
  const fileCount = await countPngFiles(framesDir);
  const metadataCount = resolveMetadataFrameCount(animation);
  const framesGenerated = toSafeCount(fileCount ?? metadataCount);

  const exportsMetadata = hasExportMetadata(animation);
  const exportsFiles = exportsMetadata ? false : await hasExportFiles(animationId);
  const hasExports = exportsMetadata || exportsFiles;

  return { framesGenerated, hasExports };
}

async function countCharacters() {
  await ensureDir(CHARACTERS_DIR);
  const ids = await listDirectories(CHARACTERS_DIR);
  let count = 0;

  for (const id of ids) {
    const filePath = storagePath("characters", id, "character.json");
    try {
      await readJson<Character>(filePath);
      count += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.warn("Dashboard stats: failed to read character", {
        characterId: id,
        error: message,
      });
    }
  }

  return count;
}

async function countAnimations() {
  await ensureDir(ANIMATIONS_DIR);
  const ids = await listDirectories(ANIMATIONS_DIR);
  let animationCount = 0;
  let framesGenerated = 0;
  let exportsCount = 0;

  for (const id of ids) {
    const stats = await loadAnimationStats(id);
    if (!stats) {
      continue;
    }
    animationCount += 1;
    framesGenerated += stats.framesGenerated;
    if (stats.hasExports) {
      exportsCount += 1;
    }
  }

  return { animationCount, framesGenerated, exportsCount };
}

export async function GET() {
  const startedAt = Date.now();
  logger.info("Dashboard stats request started");

  try {
    const characters = await countCharacters();
    const animations = await countAnimations();

    const stats: DashboardStats = {
      characters: toSafeCount(characters),
      animations: toSafeCount(animations.animationCount),
      framesGenerated: toSafeCount(animations.framesGenerated),
      exports: toSafeCount(animations.exportsCount),
    };

    logger.info("Dashboard stats computed", {
      stats,
      durationMs: Date.now() - startedAt,
    });

    return Response.json({
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Dashboard stats failed", { error: message });
    return Response.json(
      { error: "Failed to compute dashboard stats." },
      { status: 500 }
    );
  }
}
