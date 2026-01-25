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

  const keyframesDir = storagePath("animations", id, "keyframes");
  await fs.rm(keyframesDir, { recursive: true, force: true });

  const updated: Record<string, unknown> = {
    ...animation,
    keyframes: [],
    updatedAt: now,
  };

  await writeJson(animationPath, updated);

  return Response.json({ animation: updated });
}
