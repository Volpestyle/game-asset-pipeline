import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { removeBackgroundWithPython } from "@/lib/backgroundRemoval";
import { logger } from "@/lib/logger";
import { parseBoolean } from "@/lib/parsing";
import { ensureDir, storagePath, writeJson } from "@/lib/storage";
import { getCharacters } from "@/lib/characters";
import { buildWorkingReference } from "@/lib/character/workingReference";
import type { ReferenceImage, ReferenceImageType } from "@/types";

export const runtime = "nodejs";

function getTypeAtIndex(values: string[], index: number): ReferenceImageType {
  const value = values[index] as ReferenceImageType | undefined;
  return value ?? "other";
}

export async function GET() {
  const characters = await getCharacters();
  return Response.json({ characters });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const style = String(formData.get("style") ?? "").trim();
    const primaryIndexRaw = formData.get("primaryIndex");
    const primaryIndex = primaryIndexRaw ? Number(primaryIndexRaw) : 0;
    const removeBackground = parseBoolean(formData.get("removeBackground") ?? "true");

    const files = formData.getAll("images").filter((item): item is File => {
      return typeof (item as File).arrayBuffer === "function";
    });

    const typeValues = formData.getAll("types").map((value) => String(value));

    if (!name || !style || files.length === 0) {
      return Response.json(
        { error: "Missing name, style, or images." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const refsDir = storagePath("characters", id, "references");

    try {
      await ensureDir(refsDir);
    } catch (error) {
      logger.error("Failed to create character directory", {
        error: error instanceof Error ? error.message : String(error),
      });
      return Response.json(
        { error: "Failed to initialize character storage." },
        { status: 500 }
      );
    }

    const referenceImages: ReferenceImage[] = [];

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
            filename,
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json(
            { error: "Failed to save reference image." },
            { status: 500 }
          );
        }
      }

      referenceImages.push({
        id: imageId,
        url: `/api/storage/characters/${id}/references/${filename}`,
        filename,
        type: getTypeAtIndex(typeValues, index),
        isPrimary: index === primaryIndex,
        backgroundRemoved: removeBackground || undefined,
      });
    }

    if (!referenceImages.some((image) => image.isPrimary)) {
      referenceImages[0].isPrimary = true;
    }

    const now = new Date().toISOString();
    const primary =
      referenceImages.find((image) => image.isPrimary) ?? referenceImages[0];

    let baseWidth: number | undefined;
    let baseHeight: number | undefined;
    let workingReference: { url: string; width: number; height: number; createdAt: string } | undefined;
    let workingSpec: Record<string, unknown> | undefined;

    if (primary?.filename) {
      const sourcePath = path.join(refsDir, primary.filename);
      const workingPath = storagePath("characters", id, "working", "reference.png");
      try {
        const result = await buildWorkingReference({
          sourcePath,
          outputPath: workingPath,
        });
        baseWidth = result.baseWidth;
        baseHeight = result.baseHeight;
        workingReference = {
          url: `/api/storage/characters/${id}/working/reference.png`,
          width: result.outputWidth,
          height: result.outputHeight,
          createdAt: now,
        };
        workingSpec = result.workingSpec;
      } catch (error) {
        logger.warn("Failed to create working reference", {
          characterId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const character = {
      id,
      name,
      style,
      referenceImages,
      baseWidth,
      baseHeight,
      workingReference,
      workingSpec,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await writeJson(storagePath("characters", id, "character.json"), character);
    } catch (error) {
      logger.error("Failed to save character metadata", {
        characterId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return Response.json(
        { error: "Failed to save character data." },
        { status: 500 }
      );
    }

    return Response.json({ character });
  } catch (error) {
    logger.error("Unexpected error in character creation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
