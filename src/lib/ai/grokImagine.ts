import { parseSize } from "@/lib/size";
import type {
  GrokImagineAspectRatio,
  GrokImagineResolution,
  GrokImagineEditResolution,
} from "@/lib/ai/fal";

export const GROK_IMAGINE_MIN_DURATION = 1;
export const GROK_IMAGINE_MAX_DURATION = 15;
export const GROK_IMAGINE_DEFAULT_DURATION = 6;

export function clampGrokImagineDuration(seconds: number): {
  seconds: number;
  clamped: boolean;
} {
  if (!Number.isFinite(seconds)) {
    return { seconds: GROK_IMAGINE_DEFAULT_DURATION, clamped: true };
  }
  const rounded = Math.round(seconds);
  const clamped = Math.min(
    GROK_IMAGINE_MAX_DURATION,
    Math.max(GROK_IMAGINE_MIN_DURATION, rounded)
  );
  return { seconds: clamped, clamped: clamped !== rounded };
}

export function getGrokImagineResolution(size: string): GrokImagineResolution {
  const parsed = parseSize(size, { width: 1280, height: 720 });
  const maxDim = Math.max(parsed.width, parsed.height);
  return maxDim <= 800 ? "480p" : "720p";
}

export function getGrokImagineEditResolution(
  size: string
): GrokImagineEditResolution {
  const parsed = parseSize(size, { width: 1280, height: 720 });
  const maxDim = Math.max(parsed.width, parsed.height);
  const minDim = Math.min(parsed.width, parsed.height);
  if (maxDim <= 900 || minDim <= 500) {
    return "480p";
  }
  return "720p";
}

export function getGrokImagineAspectRatio(size: string): GrokImagineAspectRatio {
  const parsed = parseSize(size, { width: 1280, height: 720 });
  if (parsed.width === parsed.height) return "1:1";
  return parsed.width >= parsed.height ? "16:9" : "9:16";
}
