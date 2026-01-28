import { parseSize } from "@/lib/size";
import type { WanAspectRatio, WanResolution } from "@/lib/ai/fal";

export const WAN_DEFAULT_FPS = 16;
export const WAN_MIN_FRAMES = 17;
export const WAN_MAX_FRAMES = 161;

export function getWanResolution(size: string): WanResolution {
  const parsed = parseSize(size, { width: 1280, height: 720 });
  const maxDim = Math.max(parsed.width, parsed.height);
  if (maxDim <= 800) return "480p";
  if (maxDim <= 1000) return "580p";
  return "720p";
}

export function getWanAspectRatio(size: string): WanAspectRatio {
  const parsed = parseSize(size, { width: 1280, height: 720 });
  if (parsed.width === parsed.height) return "1:1";
  return parsed.width >= parsed.height ? "16:9" : "9:16";
}

export function clampWanFrames(frameCount: number): {
  frames: number;
  clamped: boolean;
} {
  if (!Number.isFinite(frameCount)) {
    return { frames: 81, clamped: true };
  }
  const clamped = Math.min(
    WAN_MAX_FRAMES,
    Math.max(WAN_MIN_FRAMES, Math.round(frameCount))
  );
  return { frames: clamped, clamped: clamped !== Math.round(frameCount) };
}
