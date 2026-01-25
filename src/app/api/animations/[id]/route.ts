import { promises as fs } from "fs";
import { ensureDir, fileExists, readJson, storagePath, writeJson } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const animation = await readJson(filePath);
  return Response.json({ animation });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const payload = await request.json();
  const animation = await readJson<Record<string, unknown>>(filePath);
  const now = new Date().toISOString();

  const updated = {
    ...animation,
    ...payload,
    id,
    updatedAt: now,
  };

  await ensureDir(storagePath("animations", id));
  await writeJson(filePath, updated);

  return Response.json({ animation: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dirPath = storagePath("animations", id);

  await fs.rm(dirPath, { recursive: true, force: true });
  return Response.json({ ok: true });
}
