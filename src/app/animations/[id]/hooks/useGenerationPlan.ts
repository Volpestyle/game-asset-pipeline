import { useMemo } from "react";
import {
  getVideoAspectRatio,
  getVideoModelLabel,
  getVideoModelReferenceConstraints,
  getVideoModelSupportsReferenceImages,
} from "@/components/animation";
import { buildPikaframesPlan } from "@/lib/ai/pikaframes";
import type { Animation } from "@/types";
import type { GenerationPlan, GenerationPlanSegment, PlanAnchor } from "../types";

type GenerationPlanOptions = {
  animation: Animation | null;
  expectedFrameCount: number;
  activeReferenceUrl: string | null;
  supportsStartEnd: boolean;
  durationOptions: number[];
  isToonCrafter: boolean;
  isPikaframes: boolean;
  isWan: boolean;
};

export function useGenerationPlan(options: GenerationPlanOptions): GenerationPlan {
  const {
    animation,
    expectedFrameCount,
    activeReferenceUrl,
    supportsStartEnd,
    durationOptions,
    isToonCrafter,
    isPikaframes,
    isWan,
  } = options;

  return useMemo(() => {
    if (!animation || isToonCrafter) {
      return { mode: "single", segments: [], errors: [], warnings: [] };
    }

    if (isPikaframes) {
      const fpsRaw = Number(animation.extractFps ?? animation.fps ?? 6);
      const plan = buildPikaframesPlan({
        keyframes: Array.isArray(animation.keyframes) ? animation.keyframes : [],
        fps: fpsRaw,
      });
      return {
        mode: "single",
        segments: [],
        errors: plan.errors,
        warnings: plan.warnings,
      };
    }

    if (isWan) {
      const errors: string[] = [];
      const warnings: string[] = [];
      const fpsRaw = Number(animation.extractFps ?? animation.fps ?? 6);
      if (!Number.isFinite(fpsRaw) || fpsRaw <= 0) {
        errors.push("Invalid FPS value. Select a valid extract FPS.");
      }
      const frameCount = Math.max(
        1,
        Number(animation.frameCount ?? expectedFrameCount)
      );
      const lastFrameIndex = Math.max(0, frameCount - 1);
      const keyframes = Array.isArray(animation.keyframes) ? animation.keyframes : [];
      const keyframesWithImages = keyframes.filter(
        (kf) => typeof kf.image === "string" && kf.image.trim().length > 0
      );
      const intermediateKeyframes = keyframesWithImages.filter(
        (kf) => kf.frameIndex !== 0 && kf.frameIndex !== lastFrameIndex
      );
      if (intermediateKeyframes.length > 0) {
        warnings.push(
          "Wan 2.2 only uses start/end frames. Intermediate keyframes are ignored."
        );
      }
      return { mode: "single", segments: [], errors, warnings };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const fpsRaw = Number(animation.extractFps ?? animation.fps ?? 6);
    const fpsValue = Number.isFinite(fpsRaw) && fpsRaw > 0 ? fpsRaw : 6;
    if (!Number.isFinite(fpsRaw) || fpsRaw <= 0) {
      errors.push("Invalid FPS value. Select a valid extract FPS.");
    }

    const frameCount = Math.max(1, Number(animation.frameCount ?? expectedFrameCount));
    const lastFrameIndex = Math.max(0, frameCount - 1);
    const modelId = String(animation.generationModel ?? "sora-2");
    const modelLabel = getVideoModelLabel(modelId);
    const supportsReferenceImages = getVideoModelSupportsReferenceImages(modelId);
    const referenceConstraints = getVideoModelReferenceConstraints(modelId);
    const referenceImages = Array.isArray(animation.generationReferenceImageUrls)
      ? animation.generationReferenceImageUrls
      : [];
    const hasReferenceImages =
      supportsReferenceImages && referenceImages.length > 0;
    if (hasReferenceImages && referenceConstraints) {
      const generationSeconds = Number(animation.generationSeconds ?? 0);
      if (
        Number.isFinite(referenceConstraints.seconds) &&
        generationSeconds !== referenceConstraints.seconds
      ) {
        errors.push(
          `${modelLabel} reference images require ${referenceConstraints.seconds}s duration.`
        );
      }
      const generationSize = String(animation.generationSize ?? "");
      if (
        referenceConstraints.aspectRatio &&
        getVideoAspectRatio(generationSize) !== referenceConstraints.aspectRatio
      ) {
        errors.push(
          `${modelLabel} reference images require ${referenceConstraints.aspectRatio} aspect ratio.`
        );
      }
    }

    const keyframes = Array.isArray(animation.keyframes) ? animation.keyframes : [];
    const keyframesWithImages = keyframes
      .filter((kf) => typeof kf.image === "string" && kf.image.trim().length > 0)
      .sort((a, b) => a.frameIndex - b.frameIndex);

    const startKeyframe = keyframesWithImages.find((kf) => kf.frameIndex === 0);
    const endKeyframe = keyframesWithImages.find((kf) => kf.frameIndex === lastFrameIndex);
    const startOverrideUrl =
      typeof animation.generationStartImageUrl === "string"
        ? animation.generationStartImageUrl
        : null;
    const endOverrideUrl =
      typeof animation.generationEndImageUrl === "string"
        ? animation.generationEndImageUrl
        : null;

    const startImageUrl =
      startKeyframe?.image ?? startOverrideUrl ?? activeReferenceUrl ?? "";
    const startLabel = startKeyframe
      ? "Keyframe 0"
      : startOverrideUrl
      ? "Start override"
      : "Reference";
    if (!startImageUrl) {
      errors.push("Missing reference image for the first frame.");
    }

    const middleKeyframes = keyframesWithImages.filter(
      (kf) => kf.frameIndex > 0 && kf.frameIndex < lastFrameIndex
    );
    const endImageUrl = endOverrideUrl ?? endKeyframe?.image ?? null;
    const endLabel = endOverrideUrl
      ? "End override"
      : endKeyframe
      ? `Keyframe ${lastFrameIndex}`
      : "Auto";

    const hasKeyframeAnchors =
      middleKeyframes.length > 0 || (Boolean(endKeyframe) && !endOverrideUrl);
    if ((hasKeyframeAnchors || endImageUrl) && !supportsStartEnd) {
      errors.push(
        `${modelLabel} does not support explicit end frames. Choose a start/end-capable model or clear keyframes/end frame.`
      );
    }

    if (hasReferenceImages && (endImageUrl || hasKeyframeAnchors)) {
      warnings.push(
        `${modelLabel} ignores end frames when reference images are used.`
      );
    }

    if (hasKeyframeAnchors && String(animation.loopMode ?? "loop") === "pingpong") {
      warnings.push(
        "Ping-pong output is disabled for keyframe segments to keep frame timing aligned."
      );
    }
    const anchors: PlanAnchor[] = [];
    if (startImageUrl) {
      anchors.push({
        frameIndex: 0,
        imageUrl: startImageUrl,
        label: startLabel,
      });
    }
    for (const kf of middleKeyframes) {
      if (kf.image) {
        anchors.push({
          frameIndex: kf.frameIndex,
          imageUrl: kf.image,
          label: `Keyframe ${kf.frameIndex}`,
        });
      }
    }
    if (endImageUrl) {
      anchors.push({
        frameIndex: lastFrameIndex,
        imageUrl: endImageUrl,
        label: endLabel,
      });
    }

    const anchorMap = new Map<number, PlanAnchor>();
    for (const anchor of anchors) {
      if (!anchorMap.has(anchor.frameIndex)) {
        anchorMap.set(anchor.frameIndex, anchor);
      }
    }
    const sortedAnchors = Array.from(anchorMap.values()).sort(
      (a, b) => a.frameIndex - b.frameIndex
    );

    const segments: GenerationPlanSegment[] = [];
    if (sortedAnchors.length <= 1) {
      if (startImageUrl) {
        const durationSeconds = Number(animation.generationSeconds ?? 4);
        segments.push({
          id: "segment-1",
          startFrame: 0,
          endFrame: lastFrameIndex,
          targetFrameCount: frameCount,
          durationSeconds,
          startImageUrl,
          endImageUrl,
          startLabel,
          endLabel,
        });
      }
      return {
        mode: hasKeyframeAnchors ? "segments" : "single",
        segments,
        errors,
        warnings,
      };
    }

    if (durationOptions.length === 0) {
      errors.push("No duration options available for the selected model.");
      return { mode: "segments", segments, errors, warnings };
    }

    const sortedOptions = [...durationOptions].sort((a, b) => a - b);
    const minSeconds = sortedOptions[0];
    const maxSeconds = sortedOptions[sortedOptions.length - 1];
    const pickDuration = (desired: number) =>
      sortedOptions.find((option) => option >= desired) ?? null;

    for (let index = 0; index < sortedAnchors.length - 1; index += 1) {
      const start = sortedAnchors[index];
      const end = sortedAnchors[index + 1];
      if (end.frameIndex <= start.frameIndex) {
        errors.push(
          `Invalid keyframe order at frame ${start.frameIndex} -> ${end.frameIndex}.`
        );
        continue;
      }
      const targetFrameCount = end.frameIndex - start.frameIndex + 1;
      const desiredSeconds = targetFrameCount / fpsValue;
      if (desiredSeconds < minSeconds) {
        errors.push(
          `Segment ${start.frameIndex}-${end.frameIndex} requires ${desiredSeconds.toFixed(
            2
          )}s, but ${modelLabel} minimum is ${minSeconds}s.`
        );
        continue;
      }
      if (desiredSeconds > maxSeconds) {
        errors.push(
          `Segment ${start.frameIndex}-${end.frameIndex} requires ${desiredSeconds.toFixed(
            2
          )}s, but ${modelLabel} maximum is ${maxSeconds}s.`
        );
        continue;
      }
      const durationSeconds = pickDuration(desiredSeconds);
      if (!durationSeconds) {
        errors.push(
          `No valid duration for segment ${start.frameIndex}-${end.frameIndex}.`
        );
        continue;
      }
      if (Math.abs(durationSeconds - desiredSeconds) > 0.01) {
        warnings.push(
          `Segment ${start.frameIndex}-${end.frameIndex} will use ${durationSeconds}s and sample frames to match timing.`
        );
      }
      segments.push({
        id: `segment-${index + 1}`,
        startFrame: start.frameIndex,
        endFrame: end.frameIndex,
        targetFrameCount,
        durationSeconds,
        startImageUrl: start.imageUrl,
        endImageUrl: end.imageUrl,
        startLabel: start.label,
        endLabel: end.label,
      });
    }

    return { mode: "segments", segments, errors, warnings };
  }, [
    animation,
    expectedFrameCount,
    activeReferenceUrl,
    supportsStartEnd,
    durationOptions,
    isToonCrafter,
    isPikaframes,
    isWan,
  ]);
}
