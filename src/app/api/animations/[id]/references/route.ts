import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  fileExists,
  readJson,
  storagePath,
  writeJson,
} from "@/lib/storage";
import type { Animation, AnimationReference } from "@/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("image");

  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return Response.json({ error: "No image file provided." }, { status: 400 });
  }

  const inputFile = file as File;
  const buffer = Buffer.from(await inputFile.arrayBuffer());
  const ext = path.extname(inputFile.name) || ".png";
  const refId = crypto.randomUUID();
  const filename = `ref_${refId}${ext}`;

  const referencesDir = storagePath("animations", id, "references");
  await fs.mkdir(referencesDir, { recursive: true });

  const filePath = path.join(referencesDir, filename);
  await fs.writeFile(filePath, buffer);

  const animation = await readJson<Animation>(animationPath);
  const references = animation.references ?? [];

  const newReference: AnimationReference = {
    id: refId,
    url: `/api/storage/animations/${id}/references/${filename}`,
    filename,
    createdAt: new Date().toISOString(),
  };

  const updatedAnimation: Animation = {
    ...animation,
    references: [...references, newReference],
    updatedAt: new Date().toISOString(),
  };

  await writeJson(animationPath, updatedAnimation);

  return Response.json({
    reference: newReference,
    animation: updatedAnimation,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const { referenceId } = await request.json();

  if (!referenceId || typeof referenceId !== "string") {
    return Response.json({ error: "Missing referenceId." }, { status: 400 });
  }

  const animation = await readJson<Animation>(animationPath);
  const references = animation.references ?? [];
  const refToDelete = references.find((ref) => ref.id === referenceId);

  if (!refToDelete) {
    return Response.json({ error: "Reference not found." }, { status: 404 });
  }

  // Delete the file from storage
  const filePath = storagePath("animations", id, "references", refToDelete.filename);
  try {
    await fs.unlink(filePath);
  } catch {
    // File may not exist, continue
  }

  const updatedReferences = references.filter((ref) => ref.id !== referenceId);
  const updatedAnimation: Animation = {
    ...animation,
    references: updatedReferences,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(animationPath, updatedAnimation);

  return Response.json({
    animation: updatedAnimation,
  });
}
