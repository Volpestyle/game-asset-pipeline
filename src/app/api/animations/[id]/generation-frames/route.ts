import { promises as fs } from "fs";
import path from "path";
import { fileExists, readJson, storagePath, writeJson } from "@/lib/storage";

export const runtime = "nodejs";

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

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

  const kindRaw = String(formData.get("kind") ?? "").trim().toLowerCase();
  const kind = kindRaw === "start" || kindRaw === "end" ? kindRaw : null;
  if (!kind) {
    return Response.json({ error: "Invalid kind (start/end)." }, { status: 400 });
  }

  const file = formData.get("image");
  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return Response.json({ error: "Missing image file." }, { status: 400 });
  }

  const imageFile = file as File;
  const ext = path.extname(imageFile.name || "").toLowerCase() || ".png";
  if (!ALLOWED_EXT.has(ext)) {
    return Response.json(
      { error: "Unsupported image type. Use PNG, JPG, or WEBP." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await imageFile.arrayBuffer());
  if (!buffer.length) {
    return Response.json({ error: "Uploaded image is empty." }, { status: 400 });
  }

  const dir = storagePath("animations", id, "generation");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${kind}_${Date.now()}${ext}`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);

  const url = `/api/storage/animations/${id}/generation/${filename}`;
  const animation = await readJson<Record<string, unknown>>(animationPath);
  const updated: Record<string, unknown> = {
    ...animation,
    updatedAt: new Date().toISOString(),
  };
  if (kind === "start") {
    updated.generationStartImageUrl = url;
  } else {
    updated.generationEndImageUrl = url;
    if (animation.generationLoop === true) {
      updated.generationLoop = false;
    }
  }

  await writeJson(animationPath, updated);

  return Response.json({ animation: updated });
}
