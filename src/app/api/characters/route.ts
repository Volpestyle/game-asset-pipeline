import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { ensureDir, storagePath, writeJson } from "@/lib/storage";
import { getCharacters } from "@/lib/characters";
import { buildWorkingReference } from "@/lib/character/workingReference";
import type { ReferenceImageType } from "@/types";

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
      console.error("Failed to create directory:", error);
      return Response.json(
        { error: "Failed to initialize character storage." },
        { status: 500 }
      );
    }

    const referenceImages = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const ext = path.extname(file.name) || ".png";
      const imageId = crypto.randomUUID();
      const filename = `${imageId}${ext}`;
      const filePath = path.join(refsDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());

      try {
        await fs.writeFile(filePath, buffer);
      } catch (error) {
        console.error(`Failed to write file ${filename}:`, error);
        return Response.json(
          { error: "Failed to save reference image." },
          { status: 500 }
        );
      }

      referenceImages.push({
        id: imageId,
        url: `/api/storage/characters/${id}/references/${filename}`,
        filename,
        type: getTypeAtIndex(typeValues, index),
        isPrimary: index === primaryIndex,
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
        console.error("Failed to create working reference:", error);
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
      console.error("Failed to save character metadata:", error);
      return Response.json(
        { error: "Failed to save character data." },
        { status: 500 }
      );
    }

    return Response.json({ character });
  } catch (error) {
    console.error("Unexpected error in character creation:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
