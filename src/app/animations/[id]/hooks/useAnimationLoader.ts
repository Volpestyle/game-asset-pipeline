import { useCallback, useEffect, useState } from "react";
import {
  coerceVideoSecondsForModel,
  coerceVideoSizeForModel,
  getExpectedFrameCount,
  getVideoAspectRatio,
  getVideoModelReferenceConstraints,
  getVideoModelSupportsReferenceImages,
  getVideoSizeOptions,
} from "@/components/animation";
import { requestJson } from "@/lib/api/client";
import type { Animation, Character } from "@/types";

type AnimationResponse = { animation: Animation };
type CharacterResponse = { character: Character };

export function useAnimationLoader(animationId: string) {
  const [animation, setAnimation] = useState<Animation | null>(null);
  const [savedAnimation, setSavedAnimation] = useState<Animation | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateAnimationState = useCallback((newAnim: Animation | null) => {
    setAnimation(newAnim);
    setSavedAnimation(newAnim);
  }, []);

  const loadAnimation = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!animationId) return;
      if (!options?.silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const data = await requestJson<AnimationResponse>(
          `/api/animations/${animationId}`,
          { cache: "no-store", errorMessage: "Animation not found." }
        );
        let nextAnimation = data.animation;
        const model = String(nextAnimation.generationModel ?? "sora-2");
        const currentSize = String(nextAnimation.generationSize ?? "");
        const coercedSize = coerceVideoSizeForModel(currentSize || undefined, model);
        if (coercedSize !== currentSize) {
          nextAnimation = { ...nextAnimation, generationSize: coercedSize };
          if (String(nextAnimation.generationNote ?? "").includes("Invalid size")) {
            nextAnimation = {
              ...nextAnimation,
              generationNote: `Adjusted video size to ${coercedSize} for ${model}.`,
            };
          }
        }
        const currentSeconds = Number(nextAnimation.generationSeconds ?? Number.NaN);
        const coercedSeconds = coerceVideoSecondsForModel(currentSeconds, model);
        if (coercedSeconds !== currentSeconds) {
          const fpsValue = Number(nextAnimation.extractFps ?? nextAnimation.fps ?? 12);
          const frameCount = getExpectedFrameCount(coercedSeconds, fpsValue);
          nextAnimation = {
            ...nextAnimation,
            generationSeconds: coercedSeconds,
            frameCount,
          };
        }

        const referenceImages = Array.isArray(
          nextAnimation.generationReferenceImageUrls
        )
          ? nextAnimation.generationReferenceImageUrls
          : [];
        const supportsReferenceImages = getVideoModelSupportsReferenceImages(model);
        const referenceConstraints = getVideoModelReferenceConstraints(model);
        if (
          supportsReferenceImages &&
          referenceImages.length > 0 &&
          referenceConstraints
        ) {
          const sizeOptions = getVideoSizeOptions(model);
          let nextSize = String(nextAnimation.generationSize ?? "");
          let nextSeconds = Number(nextAnimation.generationSeconds ?? Number.NaN);
          let didAdjust = false;

          if (
            referenceConstraints.seconds &&
            Number.isFinite(referenceConstraints.seconds) &&
            nextSeconds !== referenceConstraints.seconds
          ) {
            nextSeconds = referenceConstraints.seconds;
            didAdjust = true;
          }

          if (
            referenceConstraints.aspectRatio &&
            getVideoAspectRatio(nextSize) !== referenceConstraints.aspectRatio
          ) {
            const fallback = sizeOptions.find(
              (size) =>
                getVideoAspectRatio(size) === referenceConstraints.aspectRatio
            );
            if (fallback) {
              nextSize = fallback;
              didAdjust = true;
            }
          }

          if (didAdjust) {
            const fpsValue = Number(nextAnimation.extractFps ?? nextAnimation.fps ?? 12);
            const frameCount = getExpectedFrameCount(nextSeconds, fpsValue);
            const note =
              `Adjusted for reference images (${referenceConstraints.aspectRatio}, ${referenceConstraints.seconds}s).`;
            nextAnimation = {
              ...nextAnimation,
              generationSize: nextSize,
              generationSeconds: nextSeconds,
              frameCount,
              generationNote: note,
            };
          }
        }
        updateAnimationState(nextAnimation);

        const characterId = data.animation.characterId;
        if (characterId) {
          try {
            const characterData = await requestJson<CharacterResponse>(
              `/api/characters/${characterId}`,
              { cache: "no-store", errorMessage: "Failed to load character." }
            );
            setCharacter(characterData.character);
          } catch {
            // Keep animation loaded even if character lookup fails.
          }
        }
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Failed to load animation.");
        }
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [animationId, updateAnimationState]
  );

  useEffect(() => {
    void loadAnimation();
  }, [loadAnimation]);

  useEffect(() => {
    if (!animationId || !animation || animation.status !== "generating") {
      return;
    }
    const interval = setInterval(() => {
      void loadAnimation({ silent: true });
    }, 2000);
    return () => clearInterval(interval);
  }, [animationId, animation, loadAnimation]);

  return {
    animation,
    setAnimation,
    savedAnimation,
    character,
    isLoading,
    error,
    setError,
    loadAnimation,
    updateAnimationState,
  };
}
