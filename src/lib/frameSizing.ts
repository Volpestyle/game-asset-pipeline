import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { sortFrameFiles } from "@/lib/frameUtils";
import { logger } from "@/lib/logger";
import type { SpritesheetLayout } from "@/lib/spritesheet";

type ResolveSpritesheetLayoutOptions = {
  framesDir: string;
  fallbackFrameWidth: number;
  fallbackFrameHeight: number;
  columns: number;
  frameCount: number;
  animationId?: string;
  context?: string;
};

export type ResolvedSpritesheetLayout = {
  frameWidth: number;
  frameHeight: number;
  layout: SpritesheetLayout;
  maxFrameWidth: number;
  maxFrameHeight: number;
  adjusted: boolean;
  frameFiles: number;
};

function normalizeDimension(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function resolveFrameCount(value: number, fallback: number): number {
  if (Number.isFinite(value) && value > 0) return Math.floor(value);
  if (Number.isFinite(fallback) && fallback > 0) return Math.floor(fallback);
  return 1;
}

export async function resolveSpritesheetLayoutForFrames(
  options: ResolveSpritesheetLayoutOptions
): Promise<ResolvedSpritesheetLayout> {
  const fallbackWidth = normalizeDimension(options.fallbackFrameWidth);
  const fallbackHeight = normalizeDimension(options.fallbackFrameHeight);
  const columns = Math.max(1, Math.floor(normalizeDimension(options.columns) || 1));

  let frameFiles: string[] = [];
  try {
    frameFiles = sortFrameFiles(await fs.readdir(options.framesDir));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Spritesheet sizing: failed to read frame directory", {
      animationId: options.animationId,
      context: options.context,
      framesDir: options.framesDir,
      error: message,
    });
    throw new Error("Failed to read frames for spritesheet.");
  }

  if (frameFiles.length === 0) {
    logger.error("Spritesheet sizing: no frame files found", {
      animationId: options.animationId,
      context: options.context,
      framesDir: options.framesDir,
    });
    throw new Error("No frames available to build spritesheet.");
  }

  let maxFrameWidth = 0;
  let maxFrameHeight = 0;
  let errorCount = 0;
  let invalidCount = 0;

  for (const filename of frameFiles) {
    const framePath = path.join(options.framesDir, filename);
    try {
      const metadata = await sharp(framePath).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (!width || !height) {
        invalidCount += 1;
        continue;
      }
      if (width > maxFrameWidth) maxFrameWidth = width;
      if (height > maxFrameHeight) maxFrameHeight = height;
    } catch (error) {
      errorCount += 1;
      logger.warn("Spritesheet sizing: failed to read frame metadata", {
        animationId: options.animationId,
        context: options.context,
        framePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!maxFrameWidth || !maxFrameHeight) {
    if (!fallbackWidth || !fallbackHeight) {
      logger.error("Spritesheet sizing: unable to determine frame dimensions", {
        animationId: options.animationId,
        context: options.context,
        framesDir: options.framesDir,
        fallbackWidth,
        fallbackHeight,
        maxFrameWidth,
        maxFrameHeight,
        errorCount,
        invalidCount,
      });
      throw new Error("Unable to determine frame dimensions for spritesheet.");
    }
    logger.warn("Spritesheet sizing: falling back to configured dimensions", {
      animationId: options.animationId,
      context: options.context,
      framesDir: options.framesDir,
      fallbackWidth,
      fallbackHeight,
      maxFrameWidth,
      maxFrameHeight,
      errorCount,
      invalidCount,
    });
  } else if (errorCount > 0 || invalidCount > 0) {
    logger.warn("Spritesheet sizing: frame scan incomplete", {
      animationId: options.animationId,
      context: options.context,
      framesDir: options.framesDir,
      errorCount,
      invalidCount,
    });
  }

  const frameWidth = Math.max(fallbackWidth, maxFrameWidth);
  const frameHeight = Math.max(fallbackHeight, maxFrameHeight);
  const adjusted = frameWidth !== fallbackWidth || frameHeight !== fallbackHeight;

  if (adjusted) {
    logger.info("Spritesheet sizing: expanded frame size to fit content", {
      animationId: options.animationId,
      context: options.context,
      fallback: { width: fallbackWidth, height: fallbackHeight },
      maxFrame: { width: maxFrameWidth, height: maxFrameHeight },
      resolved: { width: frameWidth, height: frameHeight },
    });
  }

  const frameCount = resolveFrameCount(options.frameCount, frameFiles.length);
  const rows = Math.max(1, Math.ceil(frameCount / columns));

  const layout: SpritesheetLayout = {
    frameSize: frameWidth === frameHeight ? frameWidth : undefined,
    frameWidth,
    frameHeight,
    columns,
    rows,
    width: columns * frameWidth,
    height: rows * frameHeight,
  };

  return {
    frameWidth,
    frameHeight,
    layout,
    maxFrameWidth,
    maxFrameHeight,
    adjusted,
    frameFiles: frameFiles.length,
  };
}
