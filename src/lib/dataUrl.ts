import { promises as fs } from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};

export function parseDataUrl(dataUrl: string): { mime: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], data: match[2] };
}

export function getExtensionForMime(mime: string): string | undefined {
  return MIME_EXT[mime];
}

export async function fileToDataUrl(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export function bufferToDataUrl(buffer: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
