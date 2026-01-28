import type { Keyframe } from "@/types";
import { sampleEvenly } from "@/lib/generationUtils";

export type PikaframesTransition = {
  startFrame: number;
  endFrame: number;
  durationSeconds: number;
};

export type PikaframesPlan = {
  keyframes: Keyframe[];
  transitions: PikaframesTransition[];
  totalDuration: number;
  errors: string[];
  warnings: string[];
};

const DEFAULT_MAX_KEYFRAMES = 5;
const DEFAULT_MAX_TOTAL_SECONDS = 25;

export function buildPikaframesPlan(options: {
  keyframes: Keyframe[];
  fps: number;
  maxKeyframes?: number;
  maxTotalSeconds?: number;
}): PikaframesPlan {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxKeyframes = options.maxKeyframes ?? DEFAULT_MAX_KEYFRAMES;
  const maxTotalSeconds = options.maxTotalSeconds ?? DEFAULT_MAX_TOTAL_SECONDS;

  const keyframesWithImages = options.keyframes
    .filter((kf) => typeof kf.image === "string" && kf.image.trim().length > 0)
    .sort((a, b) => a.frameIndex - b.frameIndex);

  if (keyframesWithImages.length < 2) {
    errors.push("Pikaframes requires at least two keyframes with images.");
  }

  let selectedKeyframes = keyframesWithImages;
  if (keyframesWithImages.length > maxKeyframes) {
    selectedKeyframes = sampleEvenly(keyframesWithImages, maxKeyframes);
    warnings.push(
      `Pikaframes supports up to ${maxKeyframes} keyframes; sampling ${selectedKeyframes.length} of ${keyframesWithImages.length}.`
    );
  }

  const fpsValue = Number(options.fps);
  if (!Number.isFinite(fpsValue) || fpsValue <= 0) {
    errors.push("Invalid FPS value for Pikaframes timing.");
  }

  const transitions: PikaframesTransition[] = [];
  let totalDuration = 0;

  if (errors.length === 0) {
    for (let index = 0; index < selectedKeyframes.length - 1; index += 1) {
      const start = selectedKeyframes[index];
      const end = selectedKeyframes[index + 1];
      const frameDelta = end.frameIndex - start.frameIndex;
      if (!Number.isFinite(frameDelta) || frameDelta <= 0) {
        errors.push(
          `Keyframes must increase in frame index (invalid ${start.frameIndex} -> ${end.frameIndex}).`
        );
        break;
      }
      const rawDuration = frameDelta / fpsValue;
      const durationSeconds = Number(rawDuration.toFixed(3));
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        errors.push(
          `Invalid duration for frames ${start.frameIndex}-${end.frameIndex}.`
        );
        break;
      }
      transitions.push({
        startFrame: start.frameIndex,
        endFrame: end.frameIndex,
        durationSeconds,
      });
      totalDuration += durationSeconds;
    }
  }

  if (errors.length === 0 && totalDuration > maxTotalSeconds) {
    errors.push(
      `Pikaframes total duration ${totalDuration.toFixed(2)}s exceeds ${maxTotalSeconds}s.`
    );
  }

  return {
    keyframes: selectedKeyframes,
    transitions,
    totalDuration,
    errors,
    warnings,
  };
}
