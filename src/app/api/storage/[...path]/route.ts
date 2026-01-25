import { promises as fs } from "fs";
import path from "path";
import { sanitizePathSegments, storagePath } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: rawSegments } = await params;
  const segments = sanitizePathSegments(rawSegments);

  if (segments.length !== rawSegments.length) {
    return Response.json({ error: "Invalid path." }, { status: 400 });
  }

  const filePath = storagePath(...segments);

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch {
    return Response.json({ error: "File not found." }, { status: 404 });
  }
}
