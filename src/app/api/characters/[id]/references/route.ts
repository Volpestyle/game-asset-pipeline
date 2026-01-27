import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { removeBackgroundWithPython } from "@/lib/backgroundRemoval";
import { buildWorkingReference } from "@/lib/character/workingReference";
import { logger } from "@/lib/logger";
import { parseBoolean } from "@/lib/parsing";
import {
  ensureDir,
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import type { Character, ReferenceImage, ReferenceImageType } from "@/types";

export const runtime = "nodejs";

const REFERENCE_TYPES: ReferenceImageType[] = [
  "front",
  "side",
  "back",
  "detail",
  "action",
  "other",
];

function isReferenceType(value: string): value is ReferenceImageType {
  return REFERENCE_TYPES.some((type) => type === value);
}

function parseReferenceType(value: string | null | undefined): ReferenceImageType {
  if (!value) return "other";
  return isReferenceType(value) ? value : "other";
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

function resolveReferencePath(characterId: string, reference: ReferenceImage): string | null {
  if (reference.filename) {
    return storagePath("characters", characterId, "references", reference.filename);
  }
  return storagePathFromUrl(reference.url);
}

async function buildPrimaryWorkingReference(options: {
  characterId: string;
  reference: ReferenceImage;
  now: string;
}) {
  const referencePath = resolveReferencePath(options.characterId, options.reference);
  if (!referencePath) {
    throw new Error("Invalid reference path.");
  }
  if (!(await fileExists(referencePath))) {
    throw new Error("Reference file not found.");
  }
  const workingPath = storagePath("characters", options.characterId, "working", "reference.png");
  const result = await buildWorkingReference({
    sourcePath: referencePath,
    outputPath: workingPath,
  });
  return {
    baseWidth: result.baseWidth,
    baseHeight: result.baseHeight,
    workingReference: {
      url: `/api/storage/characters/${options.characterId}/working/reference.png`,
      width: result.outputWidth,
      height: result.outputHeight,
      createdAt: options.now,
    },
    workingSpec: result.workingSpec,
  };
}

async function removeReferenceWorkingCache(characterId: string, referenceId: string) {
  const workingDir = storagePath("characters", characterId, "working");
  try {
    const entries = await fs.readdir(workingDir);
    const prefix = `reference_${referenceId}_`;
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith(prefix))
        .map((entry) => fs.rm(path.join(workingDir, entry), { force: true }))
    );
  } catch (error) {
    logger.warn("Failed to clean cached reference variants", {
      characterId,
      referenceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = storagePath("characters", id, "character.json");

  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Character not found." }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const removeBackground = parseBoolean(formData.get("removeBackground") ?? "true");
    const primaryIndexRaw = formData.get("primaryIndex");
    const primaryIndex = primaryIndexRaw ? Number(primaryIndexRaw) : null;

    const files = formData.getAll("images").filter(isFileEntry);
    const typeValues = formData.getAll("types").map((value) => String(value));

    if (files.length === 0) {
      return Response.json(
        { error: "No reference images provided." },
        { status: 400 }
      );
    }

    const character = await readJson<Character>(filePath);
    const refsDir = storagePath("characters", id, "references");

    await ensureDir(refsDir);

    const newReferences: ReferenceImage[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const originalExt = path.extname(file.name).toLowerCase();
      const ext = removeBackground ? ".png" : originalExt || ".png";
      const imageId = crypto.randomUUID();
      const filename = `${imageId}${ext}`;
      const filePath = path.join(refsDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());

      if (removeBackground) {
        const tempInput = path.join(refsDir, `${imageId}_input.png`);
        try {
          await sharp(buffer).png().toFile(tempInput);
          await removeBackgroundWithPython({
            inputPath: tempInput,
            outputPath: filePath,
          });
          logger.info("AI background removal applied to reference image", {
            characterId: id,
            filename,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Background removal failed.";
          logger.error("AI background removal failed for reference image", {
            characterId: id,
            filename,
            error: message,
          });
          await fs.rm(tempInput, { force: true });
          return Response.json(
            {
              error:
                "Background removal failed for a reference image. Check logs or disable removal.",
            },
            { status: 500 }
          );
        }
        await fs.rm(tempInput, { force: true });
      } else {
        try {
          await fs.writeFile(filePath, buffer);
        } catch (error) {
          logger.error("Failed to write reference image", {
            characterId: id,
            filename,
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json(
            { error: "Failed to save reference image." },
            { status: 500 }
          );
        }
      }

      newReferences.push({
        id: imageId,
        url: `/api/storage/characters/${id}/references/${filename}`,
        filename,
        type: parseReferenceType(typeValues[index] ?? null),
        isPrimary: false,
        backgroundRemoved: removeBackground || undefined,
      });
    }

    let updatedReferences = [...character.referenceImages, ...newReferences];

    if (
      primaryIndex !== null &&
      Number.isFinite(primaryIndex) &&
      primaryIndex >= 0 &&
      primaryIndex < newReferences.length
    ) {
      const newPrimaryId = newReferences[primaryIndex].id;
      updatedReferences = updatedReferences.map((image) => ({
        ...image,
        isPrimary: image.id === newPrimaryId,
      }));
    } else if (!updatedReferences.some((image) => image.isPrimary)) {
      updatedReferences = updatedReferences.map((image, index) => ({
        ...image,
        isPrimary: index === 0,
      }));
    }

    const previousPrimaryId =
      character.referenceImages.find((image) => image.isPrimary)?.id ??
      character.referenceImages[0]?.id;
    const nextPrimary =
      updatedReferences.find((image) => image.isPrimary) ?? updatedReferences[0];
    const now = new Date().toISOString();

    let nextWorkingReference = character.workingReference;
    let nextWorkingSpec = character.workingSpec;
    let nextBaseWidth = character.baseWidth;
    let nextBaseHeight = character.baseHeight;

    if (
      nextPrimary &&
      (
        !previousPrimaryId ||
        previousPrimaryId !== nextPrimary.id ||
        !character.workingReference ||
        !character.workingSpec ||
        !character.baseWidth ||
        !character.baseHeight
      )
    ) {
      try {
        const result = await buildPrimaryWorkingReference({
          characterId: id,
          reference: nextPrimary,
          now,
        });
        nextWorkingReference = result.workingReference;
        nextWorkingSpec = result.workingSpec;
        nextBaseWidth = result.baseWidth;
        nextBaseHeight = result.baseHeight;
      } catch (error) {
        logger.error("Failed to rebuild working reference after upload", {
          characterId: id,
          error: error instanceof Error ? error.message : String(error),
        });
        return Response.json(
          { error: "Failed to refresh working reference." },
          { status: 500 }
        );
      }
    }

    const updated: Character = {
      ...character,
      referenceImages: updatedReferences,
      workingReference: nextWorkingReference,
      workingSpec: nextWorkingSpec,
      baseWidth: nextBaseWidth,
      baseHeight: nextBaseHeight,
      updatedAt: now,
    };

    await writeJson(filePath, updated);

    logger.info("Reference images added", {
      characterId: id,
      addedCount: newReferences.length,
      totalCount: updatedReferences.length,
    });

    return Response.json({ character: updated });
  } catch (error) {
    logger.error("Unexpected error adding reference images", {
      characterId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = storagePath("characters", id, "character.json");

  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Character not found." }, { status: 404 });
  }

  const referenceId = new URL(request.url).searchParams.get("referenceId")?.trim();
  if (!referenceId) {
    return Response.json(
      { error: "Missing referenceId." },
      { status: 400 }
    );
  }

  try {
    const character = await readJson<Character>(filePath);
    if (character.referenceImages.length <= 1) {
      return Response.json(
        { error: "At least one reference image is required." },
        { status: 400 }
      );
    }

    const target = character.referenceImages.find((image) => image.id === referenceId);
    if (!target) {
      return Response.json({ error: "Reference image not found." }, { status: 404 });
    }

    const remaining = character.referenceImages.filter((image) => image.id !== referenceId);
    if (!remaining.some((image) => image.isPrimary)) {
      remaining[0].isPrimary = true;
    }

    const nextPrimary = remaining.find((image) => image.isPrimary) ?? remaining[0];
    const now = new Date().toISOString();

    let nextWorkingReference = character.workingReference;
    let nextWorkingSpec = character.workingSpec;
    let nextBaseWidth = character.baseWidth;
    let nextBaseHeight = character.baseHeight;

    if (
      target.isPrimary ||
      !character.workingReference ||
      !character.workingSpec ||
      !character.baseWidth ||
      !character.baseHeight
    ) {
      try {
        const result = await buildPrimaryWorkingReference({
          characterId: id,
          reference: nextPrimary,
          now,
        });
        nextWorkingReference = result.workingReference;
        nextWorkingSpec = result.workingSpec;
        nextBaseWidth = result.baseWidth;
        nextBaseHeight = result.baseHeight;
      } catch (error) {
        logger.error("Failed to rebuild working reference after removal", {
          characterId: id,
          referenceId,
          error: error instanceof Error ? error.message : String(error),
        });
        return Response.json(
          { error: "Failed to refresh working reference." },
          { status: 500 }
        );
      }
    }

    const updated: Character = {
      ...character,
      referenceImages: remaining,
      workingReference: nextWorkingReference,
      workingSpec: nextWorkingSpec,
      baseWidth: nextBaseWidth,
      baseHeight: nextBaseHeight,
      updatedAt: now,
    };

    await writeJson(filePath, updated);

    const targetPath = resolveReferencePath(id, target);
    if (targetPath) {
      try {
        await fs.rm(targetPath, { force: true });
      } catch (error) {
        logger.warn("Failed to delete reference image file", {
          characterId: id,
          referenceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await removeReferenceWorkingCache(id, referenceId);

    logger.info("Reference image removed", {
      characterId: id,
      referenceId,
      remainingCount: remaining.length,
    });

    return Response.json({ character: updated });
  } catch (error) {
    logger.error("Unexpected error removing reference image", {
      characterId: id,
      referenceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
