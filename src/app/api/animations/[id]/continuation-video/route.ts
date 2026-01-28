import { promises as fs } from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import {
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import type { Animation } from "@/types";

export const runtime = "nodejs";

const ALLOWED_EXT = new Set([".mp4"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: "Missing form data." }, { status: 400 });
  }

  const file = formData.get("video");
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "Missing video file." }, { status: 400 });
  }

  const ext = path.extname(file.name || "").toLowerCase() || ".mp4";
  if (!ALLOWED_EXT.has(ext)) {
    return Response.json(
      { error: "Unsupported video type. Use MP4." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) {
    return Response.json({ error: "Uploaded video is empty." }, { status: 400 });
  }

  const dir = storagePath("animations", id, "continuation");
  await fs.mkdir(dir, { recursive: true });
  const filename = `continuation_${Date.now()}${ext}`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);

  const animation = await readJson<Animation>(animationPath);
  const existingUrl =
    typeof animation.generationContinuationVideoUrl === "string"
      ? animation.generationContinuationVideoUrl
      : "";
  if (existingUrl) {
    const existingPath = storagePathFromUrl(existingUrl);
    if (existingPath) {
      await fs.rm(existingPath, { force: true });
    }
  }

  const url = `/api/storage/animations/${id}/continuation/${filename}`;
  const updated: Animation = {
    ...animation,
    generationContinuationVideoUrl: url,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(animationPath, updated);

  logger.info("Continuation video uploaded", {
    animationId: id,
    filename,
    bytes: buffer.length,
  });

  return Response.json({ animation: updated });
}
