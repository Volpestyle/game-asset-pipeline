import { promises as fs } from "fs";
import path from "path";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export function storagePath(...parts: string[]) {
  return path.join(STORAGE_ROOT, ...parts);
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T> {
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data) as T;
}

export async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function listDirectories(dirPath: string) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

export function sanitizePathSegments(segments: string[]) {
  return segments.filter((segment) => segment && segment !== "." && segment !== "..");
}

export function storagePathFromUrl(url: string) {
  const marker = "/api/storage/";
  const index = url.indexOf(marker);
  if (index === -1) {
    return null;
  }

  const relative = url.slice(index + marker.length);
  const segments = relative.split("/").filter(Boolean);
  const sanitized = sanitizePathSegments(segments);
  if (segments.length !== sanitized.length) {
    return null;
  }

  return storagePath(...sanitized);
}
