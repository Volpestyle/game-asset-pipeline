import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_BG_KEY } from "@/lib/color";
import { runFfmpeg } from "@/lib/ffmpeg";
import { logger } from "@/lib/logger";

export type FrameRoi = { x: number; y: number; w: number; h: number };
export type ExtractVideoFramesMode = "crop" | "pad";

export type ExtractVideoFramesOptions = {
  videoPath: string;
  outputDir: string;
  fps: number;
  frameWidth: number;
  frameHeight: number;
  roi?: FrameRoi;
  padColor?: string;
  mode: ExtractVideoFramesMode;
};

function resolvePadColorHex(color?: string): string {
  const raw = (color ?? DEFAULT_BG_KEY).replace("#", "").trim();
  const hex = raw.length === 6 ? raw : "FF00FF";
  return `0x${hex}`;
}

export async function extractVideoFrames(options: ExtractVideoFramesOptions): Promise<void> {
  try {
    await fs.rm(options.outputDir, { recursive: true, force: true });
    await fs.mkdir(options.outputDir, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Video frames: failed to prepare output directory", {
      outputDir: options.outputDir,
      error: message,
    });
    throw new Error("Failed to prepare video frame output directory.");
  }

  const filters: string[] = [];
  if (options.roi && options.roi.w > 0 && options.roi.h > 0) {
    filters.push(
      `crop=${options.roi.w}:${options.roi.h}:${options.roi.x}:${options.roi.y}`
    );
  } else if (options.mode === "crop") {
    throw new Error("Frame extraction requires a crop ROI.");
  }

  if (options.mode === "pad") {
    const padColor = resolvePadColorHex(options.padColor);
    filters.push(
      `scale=${options.frameWidth}:${options.frameHeight}:flags=neighbor:force_original_aspect_ratio=decrease`
    );
    filters.push(
      `pad=${options.frameWidth}:${options.frameHeight}:(ow-iw)/2:(oh-ih)/2:color=${padColor}`
    );
    filters.push("setsar=1");
  } else {
    filters.push(
      `scale=${options.frameWidth}:${options.frameHeight}:flags=neighbor`
    );
  }

  filters.push(`fps=${options.fps}`);
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    options.videoPath,
    "-vf",
    filters.join(","),
    "-start_number",
    "0",
    path.join(options.outputDir, "frame_%03d.png"),
  ];

  logger.info("Video frames: extracting", {
    videoPath: options.videoPath,
    outputDir: options.outputDir,
    fps: options.fps,
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    mode: options.mode,
    roi: options.roi ?? null,
  });

  try {
    await runFfmpeg(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Video frames: ffmpeg failed", {
      videoPath: options.videoPath,
      outputDir: options.outputDir,
      error: message,
    });
    throw error;
  }
}
