import { promises as fs } from "fs";
import { composeSpritesheet } from "@/lib/spritesheet";
import {
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import type { Keyframe, SpritesheetLayout } from "@/types";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; frameIndex: string }> }
) {
  const { id, frameIndex } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const animation = await readJson<Record<string, unknown>>(animationPath);
  const parsedIndex = Number(frameIndex);

  if (!Number.isFinite(parsedIndex) || parsedIndex < 0) {
    return Response.json({ error: "Invalid frame index." }, { status: 400 });
  }

  const keyframes = (animation.keyframes as Keyframe[] | undefined) ?? [];
  const remaining = keyframes.filter((kf) => kf.frameIndex !== parsedIndex);
  const removed = keyframes.find((kf) => kf.frameIndex === parsedIndex);

  if (removed?.image) {
    const keyframePath = storagePathFromUrl(removed.image);
    if (keyframePath) {
      await fs.rm(keyframePath, { force: true });
    }
  }

  const updatedAnimation: Record<string, unknown> = {
    ...animation,
    keyframes: remaining,
    updatedAt: new Date().toISOString(),
  };

  if (Array.isArray(animation.generatedFrames)) {
    updatedAnimation.generatedFrames = animation.generatedFrames.map(
      (frame: Record<string, unknown>) => {
        if (frame.frameIndex !== parsedIndex) return frame;
        return {
          ...frame,
          isKeyframe: false,
          generatedAt: new Date().toISOString(),
        };
      }
    );
  }

  if (animation.generatedSpritesheet && animation.spritesheetLayout) {
    const framesDir = storagePath("animations", id, "generated", "frames");
    const recomposedName = `spritesheet_${Date.now()}_recomposed.png`;
    const recomposedPath = storagePath("animations", id, "generated", recomposedName);
    try {
      await composeSpritesheet({
        framesDir,
        outputPath: recomposedPath,
        layout: animation.spritesheetLayout as SpritesheetLayout,
      });
      updatedAnimation.generatedSpritesheet = `/api/storage/animations/${id}/generated/${recomposedName}`;
    } catch {
      // If recomposition fails, keep existing spritesheet.
    }
  }

  await writeJson(animationPath, updatedAnimation);

  return Response.json({ animation: updatedAnimation, removed: removed ?? null });
}
