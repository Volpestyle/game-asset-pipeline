import { logger } from "@/lib/logger";
import { ensureDir, fileExists, readJson, storagePath, writeJson } from "@/lib/storage";
import type { StudioHistoryEntry, StudioHistoryPage } from "@/types/studio";

const HISTORY_DIR = storagePath("studio");
const HISTORY_PATH = storagePath("studio", "history.json");

async function readHistory(): Promise<StudioHistoryEntry[]> {
  const exists = await fileExists(HISTORY_PATH);
  if (!exists) return [];
  try {
    const data = await readJson<StudioHistoryEntry[]>(HISTORY_PATH);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error("Failed to read studio history", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function writeHistory(entries: StudioHistoryEntry[]) {
  await ensureDir(HISTORY_DIR);
  await writeJson(HISTORY_PATH, entries);
}

export async function appendStudioHistoryEntry(entry: StudioHistoryEntry) {
  try {
    const entries = await readHistory();
    entries.unshift(entry);
    await writeHistory(entries);
  } catch (error) {
    logger.error("Failed to append studio history", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getStudioHistoryPage(
  offset: number,
  limit: number
): Promise<StudioHistoryPage> {
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.max(1, Math.floor(limit));
  const entries = await readHistory();
  const items = entries.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset =
    safeOffset + items.length < entries.length
      ? safeOffset + items.length
      : null;

  return {
    items,
    nextOffset,
    total: entries.length,
  };
}
