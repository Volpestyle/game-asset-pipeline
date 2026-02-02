import { promises as fs } from "fs";
import { resolveSpritesheetLayoutForFrames } from "@/lib/frameSizing";
import { logger } from "@/lib/logger";
import { composeSpritesheet } from "@/lib/spritesheet";
import {
  fileExists,
  readJson,
  storagePath,
  storagePathFromUrl,
  writeJson,
} from "@/lib/storage";
import type { Animation as AnimationModel, GeneratedFrame } from "@/types";

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

  const animation = await readJson<AnimationModel>(animationPath);
  const parsedIndex = Number(frameIndex);

  if (!Number.isFinite(parsedIndex) || parsedIndex < 0) {
    return Response.json({ error: "Invalid frame index." }, { status: 400 });
  }

  const keyframes = animation.keyframes ?? [];
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

  let updatedFrames: GeneratedFrame[] | undefined;
  if (Array.isArray(animation.generatedFrames)) {
    updatedFrames = animation.generatedFrames.map((frame) => {
      if (frame.frameIndex !== parsedIndex) return frame;
      return {
        ...frame,
        isKeyframe: false,
        generatedAt: new Date().toISOString(),
      };
    });
    updatedAnimation.generatedFrames = updatedFrames;
  }

  const frameCount =
    updatedFrames?.length ??
    Number(animation.actualFrameCount ?? animation.frameCount ?? 0) ||
    1;
  const columns = Math.max(
    1,
    Number(animation.sheetColumns ?? animation.spritesheetLayout?.columns ?? 6)
  );
  const fallbackFrameWidth = Number(
    animation.spritesheetLayout?.frameWidth ??
      animation.frameWidth ??
      animation.spriteSize ??
      0
  );
  const fallbackFrameHeight = Number(
    animation.spritesheetLayout?.frameHeight ??
      animation.frameHeight ??
      animation.spriteSize ??
      0
  );

  if (animation.generatedSpritesheet) {
    const framesDir = storagePath("animations", id, "generated", "frames");
    const recomposedName = `spritesheet_${Date.now()}_recomposed.png`;
    const recomposedPath = storagePath("animations", id, "generated", recomposedName);
    let resolvedLayout = animation.spritesheetLayout;
    let resolvedFrameWidth = fallbackFrameWidth;
    let resolvedFrameHeight = fallbackFrameHeight;

    try {
      const sizing = await resolveSpritesheetLayoutForFrames({
        framesDir,
        fallbackFrameWidth,
        fallbackFrameHeight,
        columns,
        frameCount,
        animationId: id,
        context: "keyframe-delete",
      });
      resolvedLayout = sizing.layout;
      resolvedFrameWidth = sizing.frameWidth;
      resolvedFrameHeight = sizing.frameHeight;
    } catch (error) {
      logger.warn("Keyframe delete: failed to resolve spritesheet layout from frames", {
        animationId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!resolvedLayout) {
        const safeCount = Math.max(1, frameCount);
        const rows = Math.max(1, Math.ceil(safeCount / columns));
        resolvedLayout = {
          frameSize:
            fallbackFrameWidth === fallbackFrameHeight
              ? fallbackFrameWidth
              : undefined,
          frameWidth: fallbackFrameWidth,
          frameHeight: fallbackFrameHeight,
          columns,
          rows,
          width: columns * fallbackFrameWidth,
          height: rows * fallbackFrameHeight,
        };
      }
    }

    try {
      if (resolvedLayout) {
        await composeSpritesheet({
          framesDir,
          outputPath: recomposedPath,
          layout: resolvedLayout,
        });
        updatedAnimation.generatedSpritesheet = `/api/storage/animations/${id}/generated/${recomposedName}`;
        updatedAnimation.spritesheetLayout = resolvedLayout;
        updatedAnimation.frameWidth = resolvedFrameWidth;
        updatedAnimation.frameHeight = resolvedFrameHeight;
      }
    } catch (error) {
      logger.warn("Keyframe delete: spritesheet recomposition failed", {
        animationId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await writeJson(animationPath, updatedAnimation);

  return Response.json({ animation: updatedAnimation, removed: removed ?? null });
}
