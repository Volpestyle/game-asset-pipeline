import { logger } from "@/lib/logger";

type StorageResult<T> = {
  value: T | null;
  error?: string;
};

const STORAGE_PREFIX = "model-studio";
const STORAGE_VERSION = "v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function buildModelStudioKey(
  scope: string,
  modelId: string | null,
  field: string
) {
  const safeScope = scope.trim() || "global";
  const safeModel = (modelId ?? "global").trim() || "global";
  const safeField = field.trim() || "value";
  return `${STORAGE_PREFIX}:${STORAGE_VERSION}:${safeScope}:${safeModel}:${safeField}`;
}

export function readStoredString(key: string): StorageResult<string> {
  if (!canUseStorage()) {
    return { value: null };
  }
  try {
    return { value: window.localStorage.getItem(key) };
  } catch (err: Error) {
    const message = err?.message ?? String(err);
    logger.warn("Model Studio storage read failed", { key, message });
    return { value: null, error: "Unable to read saved settings." };
  }
}

export function writeStoredString(key: string, value: string | null) {
  if (!canUseStorage()) {
    return null;
  }
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    return null;
  } catch (err: Error) {
    const message = err?.message ?? String(err);
    logger.warn("Model Studio storage write failed", { key, message });
    return "Unable to save settings.";
  }
}

export function readStoredNumber(key: string): StorageResult<number> {
  const result = readStoredString(key);
  if (result.error) return { value: null, error: result.error };
  const raw = result.value;
  if (raw == null || raw.trim() === "") return { value: null };
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? { value: parsed } : { value: null };
}

export function writeStoredNumber(key: string, value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return writeStoredString(key, null);
  }
  return writeStoredString(key, String(value));
}

export function readStoredBoolean(key: string): StorageResult<boolean> {
  const result = readStoredString(key);
  if (result.error) return { value: null, error: result.error };
  if (result.value === "true") return { value: true };
  if (result.value === "false") return { value: false };
  return { value: null };
}

export function writeStoredBoolean(key: string, value: boolean | null) {
  if (value == null) {
    return writeStoredString(key, null);
  }
  return writeStoredString(key, value ? "true" : "false");
}
