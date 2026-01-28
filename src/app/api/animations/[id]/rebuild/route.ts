import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { removeBackgroundFromFramesDir } from "@/lib/backgroundRemoval";
import { buildGeneratedFramesFromSequence } from "@/lib/frameOps";
import { buildSpritesheetLayout, sortFrameFiles } from "@/lib/frameUtils";
import { composeSpritesheet } from "@/lib/spritesheet";
import { logger } from "@/lib/logger";
import { fileExists, readJson, storagePath, writeJson } from "@/lib/storage";
import type { GeneratedFrame } from "@/types";

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

  const payload = await request.json().catch(() => ({}));
  const animation = await readJson<Record<string, unknown>>(animationPath);
  const applyBackgroundRemoval = payload?.applyBackgroundRemoval === true;

  const loopModeInput = String(payload?.loopMode ?? animation.loopMode ?? "loop");
  const loopMode = loopModeInput === "pingpong" ? "pingpong" : "loop";
  const sheetColumns = Math.max(1, Number(payload?.sheetColumns ?? animation.sheetColumns ?? 6));

  const rawFramesDir = storagePath("animations", id, "generated", "frames_raw");
  if (!(await fileExists(rawFramesDir))) {
    return Response.json(
      { error: "No raw frames found. Regenerate the animation first." },
      { status: 400 }
    );
  }

  const rawFiles = sortFrameFiles(await fs.readdir(rawFramesDir));
  if (rawFiles.length === 0) {
    return Response.json(
      { error: "No raw frames found. Regenerate the animation first." },
      { status: 400 }
    );
  }

  const framesDir = storagePath("animations", id, "generated", "frames");

  let frameWidth = Number(animation.frameWidth ?? animation.spriteSize ?? 0);
  let frameHeight = Number(animation.frameHeight ?? animation.spriteSize ?? 0);
  if (!frameWidth || !frameHeight) {
    const samplePath = path.join(rawFramesDir, rawFiles[0]);
    const metadata = await sharp(samplePath).metadata();
    frameWidth = metadata.width ?? 1;
    frameHeight = metadata.height ?? 1;
  }

  let generatedFrames: GeneratedFrame[];
  try {
    generatedFrames = await buildGeneratedFramesFromSequence({
      animationId: id,
      rawFramesDir,
      outputDir: framesDir,
      baseSequence: rawFiles,
      loopMode,
      source: "rebuild",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rebuild frames.";
    logger.error("Rebuild: failed to copy frames", {
      animationId: id,
      error: message,
    });
    return Response.json({ error: message }, { status: 500 });
  }

  if (applyBackgroundRemoval) {
    try {
      logger.info("Rebuild: applying background removal", { animationId: id });
      await removeBackgroundFromFramesDir({ framesDir, animationId: id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Background removal failed.";
      logger.error("Rebuild: background removal failed", {
        animationId: id,
        error: message,
      });
      return Response.json({ error: message }, { status: 500 });
    }
  }

  const layout = buildSpritesheetLayout({
    frameWidth,
    frameHeight,
    columns: sheetColumns,
    frameCount: generatedFrames.length,
  });

  const spritesheetName = `spritesheet_${Date.now()}_rebuild.png`;
  const spritesheetPath = storagePath("animations", id, "generated", spritesheetName);
  await composeSpritesheet({ framesDir, outputPath: spritesheetPath, layout });

  const updated = {
    ...animation,
    status: "complete",
    loopMode,
    sheetColumns,
    frameWidth,
    frameHeight,
    actualFrameCount: generatedFrames.length,
    generatedFrames,
    generatedSpritesheet: `/api/storage/animations/${id}/generated/${spritesheetName}`,
    spritesheetLayout: layout,
    generationNote: applyBackgroundRemoval
      ? `Rebuilt spritesheet (${loopMode}) with background removal.`
      : `Rebuilt spritesheet (${loopMode}).`,
    exports: undefined,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(animationPath, updated);
  return Response.json({ animation: updated });
}
