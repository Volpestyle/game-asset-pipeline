import { promises as fs } from "fs";
import { ensureDir, fileExists, readJson, storagePath, writeJson } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = storagePath("characters", id, "character.json");

  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Character not found." }, { status: 404 });
  }

  const character = await readJson(filePath);
  return Response.json({ character });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = storagePath("characters", id, "character.json");

  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Character not found." }, { status: 404 });
  }

  const payload = await request.json();
  const character = await readJson<Record<string, unknown>>(filePath);
  const now = new Date().toISOString();

  const updated = {
    ...character,
    ...payload,
    id,
    updatedAt: now,
  };

  await ensureDir(storagePath("characters", id));
  await writeJson(filePath, updated);

  return Response.json({ character: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dirPath = storagePath("characters", id);

  await fs.rm(dirPath, { recursive: true, force: true });
  return Response.json({ ok: true });
}
