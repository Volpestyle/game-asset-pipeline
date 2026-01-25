import { promises as fs } from "fs";
import {
  fileExists,
  readJson,
  storagePath,
  writeJson,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const animation = await readJson<Record<string, unknown>>(animationPath);
  const now = new Date().toISOString();

  const generatedDir = storagePath("animations", id, "generated");
  const exportsDir = storagePath("animations", id, "exports");

  await fs.rm(generatedDir, { recursive: true, force: true });
  await fs.rm(exportsDir, { recursive: true, force: true });

  const updated: Record<string, unknown> = {
    ...animation,
    generatedFrames: [],
    status: "draft",
    updatedAt: now,
  };

  delete updated.generatedSpritesheet;
  delete updated.spritesheetLayout;
  delete updated.actualFrameCount;
  delete updated.exports;
  delete updated.generationNote;
  delete updated.generationJob;
  delete updated.sourceVideoUrl;
  delete updated.sourceProviderSpritesheetUrl;
  delete updated.sourceThumbnailUrl;

  await writeJson(animationPath, updated);

  return Response.json({ animation: updated });
}
