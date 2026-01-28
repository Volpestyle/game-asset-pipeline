"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import { buildVideoPrompt } from "@/lib/ai/promptBuilder";
import { buildPikaframesPlan } from "@/lib/ai/pikaframes";
import {
  TimelineEditor,
  FramePreview,
  AdvancedKeyframePanel,
  ExportPanel,
  ModelConstraints,
  EXTRACT_FPS_OPTIONS,
  coerceVideoSizeForModel,
  coerceVideoSecondsForModel,
  getExpectedFrameCount,
  isSizeValidForModel,
  getVideoModelOptions,
  getVideoSecondsOptions,
  getVideoModelSupportsStartEnd,
  getVideoModelSupportsLoop,
  getVideoModelSupportsNegativePrompt,
  getVideoModelSupportsSeed,
  getVideoModelPromptProfile,
  getVideoModelLabel,
  getVideoModelSupportsReferenceImages,
  getVideoModelReferenceImageLimit,
  getVideoModelReferenceConstraints,
  getVideoModelSupportsConcepts,
  getVideoModelConceptOptions,
  getVideoModelSupportsEffect,
  getVideoModelSupportsAudio,
  getVideoAspectRatio,
  getVideoSizeOptions,
} from "@/components/animation";
import type { KeyframeFormData } from "@/components/animation";
import { requestJson, requestFormData } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import type {
  Animation,
  AnimationStyle,
  BackgroundRemovalMode,
  GenerationProvider,
  PromptProfile,
  KeyframeGeneration,
} from "@/types";
import { ImportPanel } from "./components/ImportPanel";
import { VersionManager } from "./components/VersionManager";
import { useAnimationLoader } from "./hooks/useAnimationLoader";
import { useGenerationPlan } from "./hooks/useGenerationPlan";

const STYLE_OPTIONS: { value: AnimationStyle; label: string; code: string }[] = [
  { value: "idle", label: "Idle", code: "IDL" },
  { value: "walk", label: "Walk", code: "WLK" },
  { value: "run", label: "Run", code: "RUN" },
  { value: "attack", label: "Attack", code: "ATK" },
  { value: "jump", label: "Jump", code: "JMP" },
  { value: "custom", label: "Custom", code: "CST" },
];

const PROMPT_PROFILE_OPTIONS: { value: PromptProfile; label: string }[] = [
  { value: "concise", label: "Concise" },
  { value: "verbose", label: "Verbose" },
];

const PROVIDER_OPTIONS: { value: GenerationProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "replicate", label: "Replicate" },
  { value: "fal", label: "Fal" },
  { value: "vertex", label: "Vertex AI" },
];

export default function AnimationDetailPage() {
  const params = useParams();
  const animationId = String(params.id ?? "");

  const {
    animation,
    setAnimation,
    savedAnimation,
    character,
    isLoading,
    error,
    setError,
    loadAnimation,
    updateAnimationState,
  } = useAnimationLoader(animationId);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isKeyframeWorking, setIsKeyframeWorking] = useState(false);
  const [keyframeGenerations, setKeyframeGenerations] = useState<
    Record<number, KeyframeGeneration[]>
  >({});
  const [generationActionId, setGenerationActionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "settings">("timeline");
  const [isRefSaving, setIsRefSaving] = useState(false);
  const allModelOptions = useMemo(() => getVideoModelOptions(), []);
  const [isGenerationFrameSaving, setIsGenerationFrameSaving] = useState(false);
  const [generationStartPreview, setGenerationStartPreview] = useState<string | null>(null);
  const [generationEndPreview, setGenerationEndPreview] = useState<string | null>(null);
  const [isContinuationVideoSaving, setIsContinuationVideoSaving] = useState(false);
  const [spritesheetExpanded, setSpritesheetExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("spritesheet-panel-expanded");
    return stored === null ? true : stored === "true";
  });
  const [isPromptEditing, setIsPromptEditing] = useState(false);
  const [showWanAdvanced, setShowWanAdvanced] = useState(false);
  const [draftPromptConcise, setDraftPromptConcise] = useState("");
  const [draftPromptVerbose, setDraftPromptVerbose] = useState("");
  const selectedProvider =
    animation?.generationProvider === "openai" ||
    animation?.generationProvider === "replicate" ||
    animation?.generationProvider === "fal" ||
    animation?.generationProvider === "vertex"
      ? animation.generationProvider
      : "";
  const modelOptions = useMemo(() => {
    if (!selectedProvider) return [];
    return allModelOptions.filter((option) => option.provider === selectedProvider);
  }, [allModelOptions, selectedProvider]);

  const savedGenerations = useMemo(() => {
    const keyframe = animation?.keyframes?.find((kf) => kf.frameIndex === currentFrame);
    const generations = Array.isArray(keyframe?.generations) ? keyframe.generations : [];
    return generations.filter((generation) => generation.saved !== false);
  }, [animation, currentFrame]);

  const recentGenerations = useMemo(() => {
    const recent = keyframeGenerations[currentFrame] ?? [];
    if (savedGenerations.length === 0) return recent;
    const savedImages = new Set(savedGenerations.map((generation) => generation.image));
    return recent.filter((generation) => !savedImages.has(generation.image));
  }, [currentFrame, keyframeGenerations, savedGenerations]);

  const pushKeyframeGeneration = useCallback(
    (frameIndex: number, generation: KeyframeGeneration) => {
      setKeyframeGenerations((prev) => {
        const existing = prev[frameIndex] ?? [];
        const filtered = existing.filter(
          (item) => item.id !== generation.id && item.image !== generation.image
        );
        const next = [generation, ...filtered].slice(0, 12);
        return { ...prev, [frameIndex]: next };
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      if (generationStartPreview) {
        URL.revokeObjectURL(generationStartPreview);
      }
    };
  }, [generationStartPreview]);

  useEffect(() => {
    return () => {
      if (generationEndPreview) {
        URL.revokeObjectURL(generationEndPreview);
      }
    };
  }, [generationEndPreview]);

  useEffect(() => {
    if (!animation) return;
    setCurrentFrame((current) => {
      const generatedCount =
        animation.generatedFrames && animation.generatedFrames.length > 0
          ? animation.generatedFrames.length
          : undefined;
      const maxFrames =
        animation.actualFrameCount ?? generatedCount ?? animation.frameCount ?? 1;
      const safeMaxFrames = Math.max(1, maxFrames);
      if (current >= 0 && current < safeMaxFrames) {
        return current;
      }
      return 0;
    });
  }, [animation]);

  useEffect(() => {
    if (isPromptEditing) return;
    const description = String(animation?.description ?? "");
    const style = String(animation?.style ?? "");
    const artStyle = character?.style ?? "pixel-art";
    const bgKeyColor = character?.workingSpec?.bgKeyColor;
    const autoConcise = buildVideoPrompt({
      description,
      style,
      artStyle,
      bgKeyColor,
      promptProfile: "concise",
    });
    const autoVerbose = buildVideoPrompt({
      description,
      style,
      artStyle,
      bgKeyColor,
      promptProfile: "verbose",
    });
    const effectiveConcise =
      animation?.promptConcise?.trim() ? animation.promptConcise : autoConcise;
    const effectiveVerbose =
      animation?.promptVerbose?.trim() ? animation.promptVerbose : autoVerbose;
    setDraftPromptConcise(effectiveConcise);
    setDraftPromptVerbose(effectiveVerbose);
  }, [animation, character, isPromptEditing]);

  useEffect(() => {
    if (!animation) return;
    if (!supportsReferenceImages || !referenceConstraints) return;
    if (generationReferenceImageUrls.length === 0) return;

    setAnimation((prev) => {
      if (!prev) return prev;
      let nextSize = String(prev.generationSize ?? "");
      let nextSeconds = Number(prev.generationSeconds ?? Number.NaN);
      let didUpdate = false;

      if (
        Number.isFinite(referenceConstraints.seconds) &&
        nextSeconds !== referenceConstraints.seconds
      ) {
        nextSeconds = referenceConstraints.seconds;
        didUpdate = true;
      }

      if (
        referenceConstraints.aspectRatio &&
        getVideoAspectRatio(nextSize) !== referenceConstraints.aspectRatio
      ) {
        const sizeOptions = getVideoSizeOptions(generationModel);
        const fallback = sizeOptions.find(
          (size) => getVideoAspectRatio(size) === referenceConstraints.aspectRatio
        );
        if (fallback && fallback !== nextSize) {
          nextSize = fallback;
          didUpdate = true;
        }
      }

      if (!didUpdate) return prev;

      const fpsValue = Number(prev.extractFps ?? prev.fps ?? 12);
      const frameCount = getExpectedFrameCount(nextSeconds, fpsValue);
      return {
        ...prev,
        generationSize: nextSize,
        generationSeconds: nextSeconds,
        frameCount,
      };
    });
  }, [
    animation,
    supportsReferenceImages,
    referenceConstraints,
    generationReferenceImageUrls.length,
    generationModel,
    setAnimation,
  ]);

  const handleSave = async () => {
    if (!animationId || !animation) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const data = await requestJson<{ animation: Animation }>(
        `/api/animations/${animationId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(animation),
          errorMessage: "Failed to save.",
        }
      );
      updateAnimationState(data.animation);
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!animationId || !animation) return;
    if (generationPlan.errors.length > 0) {
      setError(generationPlan.errors[0] ?? "Generation plan has errors.");
      return;
    }

    const currentModel = String(animation.generationModel ?? "sora-2");
    const providerValue = animation.generationProvider;
    if (
      providerValue !== "openai" &&
      providerValue !== "replicate" &&
      providerValue !== "fal" &&
      providerValue !== "vertex"
    ) {
      setError("Select a generation provider before starting.");
      return;
    }
    const expectedProvider = allModelOptions.find(
      (option) => option.value === currentModel
    )?.provider;
    if (expectedProvider && expectedProvider !== providerValue) {
      setError(
        `Selected provider (${providerValue}) does not match model provider (${expectedProvider}).`
      );
      return;
    }
    if (providerValue === "vertex") {
      if (animation.generationContinuationEnabled !== true) {
        setError("Enable continuation before running Vertex generation.");
        return;
      }
      const continuationVideoUrl =
        typeof animation.generationContinuationVideoUrl === "string"
          ? animation.generationContinuationVideoUrl.trim()
          : "";
      if (!continuationVideoUrl) {
        setError("Upload a continuation video before generating.");
        return;
      }
    }

    // Validate size before generating
    const currentSize = String(animation.generationSize ?? "1024x1792");
    const sizeValid = isSizeValidForModel(currentSize, currentModel);
    let adjustedSize: string | null = null;
    let nextAnimation = { ...animation };

    if (!sizeValid) {
      adjustedSize = coerceVideoSizeForModel(currentSize, currentModel);
      nextAnimation = { ...nextAnimation, generationSize: adjustedSize };
      setAnimation(nextAnimation);
    }

    const useQueue =
      providerValue !== "vertex" &&
      !isPikaframes &&
      generationPlan.mode === "segments" &&
      generationPlan.segments.length > 0;
    if (
      !isPikaframes &&
      generationPlan.mode === "segments" &&
      generationPlan.segments.length === 0
    ) {
      setError("No valid keyframe segments to generate.");
      return;
    }

    setIsGenerating(true);
    setMessage(null);
    setError(null);
    try {
      // Auto-save before generating to ensure latest settings (like description) are used
      const savedData = await requestJson<{ animation: Animation }>(
        `/api/animations/${animationId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextAnimation),
          errorMessage: "Failed to auto-save settings before generation.",
        }
      );
      // Since we just auto-saved, the returned animation is the clean state
      updateAnimationState(savedData.animation);

      const segmentsPayload = useQueue
        ? generationPlan.segments.map((segment) => ({
            id: segment.id,
            startFrame: segment.startFrame,
            endFrame: segment.endFrame,
            durationSeconds: segment.durationSeconds,
            startImageUrl: segment.startImageUrl,
            endImageUrl: segment.endImageUrl ?? null,
          }))
        : undefined;

      const data = await requestJson<{ animation?: Animation }>(
        "/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            animationId,
            async: true,
            segments: segmentsPayload,
          }),
          errorMessage: "Generation failed.",
        }
      );
      updateAnimationState(data.animation ?? savedData.animation);
      if (adjustedSize) {
        setMessage(
          `${useQueue ? "Queue started" : "Generation started"}. Adjusted video size to ${adjustedSize} for ${currentModel}.`
        );
      } else {
        setMessage(
          useQueue
            ? `Queue started (${generationPlan.segments.length} segment${generationPlan.segments.length === 1 ? "" : "s"}).`
            : "Generation started."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRebuildSpritesheet = async () => {
    if (!animationId || !animation) return;
    setIsRebuilding(true);
    setMessage(null);
    setError(null);
    try {
      const data = await requestJson<{ animation: Animation }>(
        `/api/animations/${animationId}/rebuild`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loopMode: animation.loopMode,
            sheetColumns: animation.sheetColumns,
          }),
          errorMessage: "Rebuild failed.",
        }
      );
      updateAnimationState(data.animation);
      setMessage("Spritesheet rebuilt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed.");
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleRemoveSpritesheetBackground = async () => {
    if (!animationId || !animation) return;
    const ok = window.confirm(
      "Apply AI background removal to the generated frames and rebuild the spritesheet? This overwrites the current frames."
    );
    if (!ok) return;
    setIsRemovingBackground(true);
    setMessage(null);
    setError(null);
    try {
      const data = await requestJson<{ animation: Animation }>(
        `/api/animations/${animationId}/rebuild`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loopMode: animation.loopMode,
            sheetColumns: animation.sheetColumns,
            applyBackgroundRemoval: true,
          }),
          errorMessage: "Background removal failed.",
        }
      );
      updateAnimationState(data.animation);
      setMessage("Background removed and spritesheet rebuilt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Background removal failed.");
    } finally {
      setIsRemovingBackground(false);
    }
  };

  const handleFrameChange = useCallback((frame: number) => {
    setCurrentFrame(frame);
  }, []);

  const handleKeyframeAction = useCallback(
    async (mode: "upload" | "generate" | "refine", data: KeyframeFormData) => {
      if (!animationId) return;
      setIsKeyframeWorking(true);
      setError(null);
      setMessage(null);
      try {
        const formData = new FormData();
        formData.append("mode", mode);
        formData.append("frameIndex", String(data.frameIndex));
        formData.append("model", data.model);
        formData.append("style", data.style);
        formData.append("strength", String(data.strength));
        formData.append("prompt", data.prompt);
        formData.append("removeBg", String(data.removeBg));
        formData.append("tileX", String(data.tileX));
        formData.append("tileY", String(data.tileY));
        formData.append("bypassPromptExpansion", String(data.bypassPromptExpansion));
        formData.append("numImages", String(data.numImages));
        formData.append("outputFormat", data.outputFormat);
        formData.append("safetyFilterLevel", data.safetyFilterLevel);
        if (data.seed.trim()) {
          formData.append("seed", data.seed.trim());
        }
        if (data.file) {
          formData.append("image", data.file, data.file.name);
        }
        if (data.inputPalette) {
          formData.append("inputPalette", data.inputPalette);
        }
        if (data.referenceImages && data.referenceImages.length > 0) {
          formData.append("referenceImages", JSON.stringify(data.referenceImages));
        }

        const respData = await requestFormData<{
          animation: Animation;
          generation?: KeyframeGeneration;
          generations?: KeyframeGeneration[];
        }>(`/api/animations/${animationId}/keyframes`, formData, {
          errorMessage: "Keyframe update failed.",
        });
        updateAnimationState(respData.animation);
        if (Array.isArray(respData.generations) && respData.generations.length > 0) {
          respData.generations.forEach((generation) =>
            pushKeyframeGeneration(data.frameIndex, generation)
          );
        } else if (respData.generation) {
          pushKeyframeGeneration(data.frameIndex, respData.generation);
        }
        setMessage(`Keyframe updated at frame ${data.frameIndex}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Keyframe update failed.");
      } finally {
        setIsKeyframeWorking(false);
      }
    },
    [animationId, updateAnimationState]
  );

  const saveKeyframeGeneration = useCallback(
    async (generation: KeyframeGeneration) => {
      if (!animationId) return;
      if (!generation.image || !generation.id) {
        setError("Generation data is incomplete.");
        return;
      }
      setError(null);
      setMessage(null);
      setGenerationActionId(generation.id);
      try {
        const data = await requestJson<{ animation: Animation }>(
          `/api/animations/${animationId}/keyframes/generations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              frameIndex: currentFrame,
              generation: { ...generation, saved: true },
            }),
            errorMessage: "Failed to save generation.",
          }
        );
        updateAnimationState(data.animation);
        setMessage("Generation saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save generation.");
      } finally {
        setGenerationActionId(null);
      }
    },
    [animationId, currentFrame, updateAnimationState]
  );

  const useKeyframeGeneration = useCallback(
    async (generation: KeyframeGeneration) => {
      if (!animationId) return;
      if (!generation.image) {
        setError("Generation image is missing.");
        return;
      }
      setIsKeyframeWorking(true);
      setError(null);
      setMessage(null);
      try {
        const formData = new FormData();
        formData.append("mode", "select");
        formData.append("frameIndex", String(currentFrame));
        formData.append("imageUrl", generation.image);
        if (generation.model) formData.append("model", generation.model);
        if (generation.prompt) formData.append("prompt", generation.prompt);
        if (generation.style) formData.append("style", generation.style);
        if (typeof generation.strength === "number") {
          formData.append("strength", String(generation.strength));
        }
        if (typeof generation.removeBg === "boolean") {
          formData.append("removeBg", String(generation.removeBg));
        }
        if (typeof generation.tileX === "boolean") {
          formData.append("tileX", String(generation.tileX));
        }
        if (typeof generation.tileY === "boolean") {
          formData.append("tileY", String(generation.tileY));
        }
        if (typeof generation.bypassPromptExpansion === "boolean") {
          formData.append(
            "bypassPromptExpansion",
            String(generation.bypassPromptExpansion)
          );
        }
        if (typeof generation.numImages === "number") {
          formData.append("numImages", String(generation.numImages));
        }
        if (generation.outputFormat) {
          formData.append("outputFormat", generation.outputFormat);
        }
        if (generation.safetyFilterLevel) {
          formData.append("safetyFilterLevel", generation.safetyFilterLevel);
        }
        if (typeof generation.seed === "number") {
          formData.append("seed", String(generation.seed));
        }
        if (generation.inputPalette) {
          formData.append("inputPalette", generation.inputPalette);
        }

        const data = await requestFormData<{ animation: Animation }>(
          `/api/animations/${animationId}/keyframes`,
          formData,
          { errorMessage: "Failed to apply generation." }
        );
        updateAnimationState(data.animation);
        setMessage(`Keyframe updated at frame ${currentFrame}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to apply generation.");
      } finally {
        setIsKeyframeWorking(false);
      }
    },
    [animationId, currentFrame, updateAnimationState]
  );

  const downloadKeyframeGeneration = useCallback(
    (generation: KeyframeGeneration) => {
      if (!generation.image) {
        setError("No generation image available to download.");
        return;
      }
      const filename = generation.image.split("/").pop() ?? "";
      const link = document.createElement("a");
      link.href = generation.image;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    []
  );

  const clearKeyframe = useCallback(
    async (frameIndex: number) => {
      setError(null);
      setMessage(null);
      try {
        const data = await requestJson<{ animation: Animation }>(
          `/api/animations/${animationId}/keyframes/${frameIndex}`,
          { method: "DELETE", errorMessage: "Failed to clear keyframe." }
        );
        updateAnimationState(data.animation);
        setMessage(`Keyframe cleared at frame ${frameIndex}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear keyframe.");
      }
    },
    [animationId, updateAnimationState]
  );

  const handleTimelineKeyframeAction = useCallback(
    async (frameIndex: number, action: "set" | "regenerate" | "refine" | "clear") => {
      setCurrentFrame(frameIndex);
      if (action === "clear") {
        await clearKeyframe(frameIndex);
        return;
      }

      setMessage("Use the Keyframe panel to generate/refine this frame.");
    },
    [clearKeyframe]
  );

  const handleExport = async (options: {
    normalize: boolean;
    removeBackground: boolean;
    backgroundRemovalMode: BackgroundRemovalMode;
    alphaThreshold: number;
  }) => {
    if (!animationId) return;
    setIsExporting(true);
    setMessage(null);
    setError(null);
    try {
      await requestJson<{ animation: Animation }>(
        "/api/export",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            animationId,
            normalize: options.normalize,
            removeBackground: options.removeBackground,
            backgroundRemovalMode: options.backgroundRemovalMode,
            alphaThreshold: options.alphaThreshold,
          }),
          errorMessage: "Export failed.",
        }
      );
      const notes = [
        options.normalize ? "normalized" : null,
        options.removeBackground
          ? `background removed (${options.backgroundRemovalMode})`
          : null,
        options.alphaThreshold > 0 ? `alpha ${options.alphaThreshold}` : null,
      ].filter(Boolean);
      setMessage(notes.length ? `Export ready (${notes.join(", ")}).` : "Export ready.");
      await loadAnimation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const saveReferenceSelection = useCallback(
    async (referenceImageId: string | null) => {
      if (!animationId) return;
      setAnimation((prev) => (prev ? { ...prev, referenceImageId } : prev));
      setError(null);
      setIsRefSaving(true);
      try {
        const data = await requestJson<{ animation: Animation }>(
          `/api/animations/${animationId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referenceImageId }),
            errorMessage: "Failed to save reference selection.",
          }
        );
        updateAnimationState(data.animation);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save reference selection."
        );
      } finally {
        setIsRefSaving(false);
      }
    },
    [animationId, updateAnimationState]
  );

  const handleAnimationRefUpload = useCallback(
    async (file: File) => {
      if (!animationId) return null;
      try {
        const formData = new FormData();
        formData.append("image", file, file.name);
        const data = await requestFormData<{
          reference: { id: string; url: string; filename: string; createdAt: string };
          animation: Animation;
        }>(`/api/animations/${animationId}/references`, formData, {
          errorMessage: "Failed to upload animation reference.",
        });
        updateAnimationState(data.animation);
        return data.reference;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload animation reference.");
        return null;
      }
    },
    [animationId, updateAnimationState]
  );

  const handleAnimationRefDelete = useCallback(
    async (referenceId: string) => {
      if (!animationId) return;
      try {
        const data = await requestJson<{ animation: Animation }>(
          `/api/animations/${animationId}/references`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referenceId }),
            errorMessage: "Failed to delete animation reference.",
          }
        );
        updateAnimationState(data.animation);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete animation reference.");
      }
    },
    [animationId, updateAnimationState]
  );

  const handleClearKeyframes = async () => {
    if (!animationId) return;
    const ok = window.confirm("Clear all keyframes? This removes keyframe images but keeps generated frames.");
    if (!ok) return;
    setMessage(null);
    setError(null);
    setIsSaving(true);
    try {
      const data = await requestJson<{ animation: Animation }>(
        `/api/animations/${animationId}/keyframes/clear`,
        { method: "POST", errorMessage: "Failed to clear keyframes." }
      );
      updateAnimationState(data.animation);
      setMessage("Cleared keyframes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear keyframes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearGeneration = async () => {
    if (!animationId || !animation) return;
    const ok = window.confirm("Clear generated frames, spritesheet, and exports? This cannot be undone.");
    if (!ok) return;
    setMessage(null);
    setError(null);
    setIsSaving(true);
    try {
      const data = await requestJson<{ animation: Animation }>(
        `/api/animations/${animationId}/clear`,
        { method: "POST", errorMessage: "Failed to clear generation." }
      );
      updateAnimationState(data.animation);
      setMessage("Cleared generated output.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear generation.");
    } finally {
      setIsSaving(false);
    }
  };


  const applyAnimationPatch = useCallback(
    async (patch: Partial<Animation>, options?: { success?: string }) => {
      if (!animationId) return;
      setIsGenerationFrameSaving(true);
      setMessage(null);
      setError(null);
      try {
        const data = await requestJson<{ animation: Animation }>(
          `/api/animations/${animationId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
            errorMessage: "Failed to update animation.",
          }
        );
        updateAnimationState(data.animation);
        if (options?.success) {
          setMessage(options.success);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update animation.");
      } finally {
        setIsGenerationFrameSaving(false);
      }
    },
    [animationId, updateAnimationState]
  );

  const handleGenerationFrameUpload = useCallback(
    async (kind: "start" | "end", file: File | null) => {
      if (!animationId || !file) return;
      if (!file.type.startsWith("image/")) {
        setError("Unsupported file type. Please upload an image.");
        logger.warn("Generation frame rejected", {
          kind,
          fileName: file.name,
          fileType: file.type,
        });
        return;
      }
      setIsGenerationFrameSaving(true);
      setMessage(null);
      setError(null);
      try {
        const previewUrl = URL.createObjectURL(file);
        if (kind === "start") {
          setGenerationStartPreview(previewUrl);
        } else {
          setGenerationEndPreview(previewUrl);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to preview frame.";
        logger.error("Generation frame preview failed", {
          kind,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          error: message,
        });
      }
      try {
        const formData = new FormData();
        formData.append("kind", kind);
        formData.append("image", file, file.name);
        const data = await requestFormData<{ animation: Animation }>(
          `/api/animations/${animationId}/generation-frames`,
          formData,
          { errorMessage: "Failed to upload frame." }
        );
        updateAnimationState(data.animation);
        setMessage(`${kind === "start" ? "Start" : "End"} frame updated.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload frame.");
      } finally {
        setIsGenerationFrameSaving(false);
        if (kind === "start") {
          setGenerationStartPreview(null);
        } else {
          setGenerationEndPreview(null);
        }
      }
    },
    [animationId, updateAnimationState, setError]
  );

  const handleContinuationVideoUpload = useCallback(
    async (file: File | null) => {
      if (!animationId || !file) return;
      setIsContinuationVideoSaving(true);
      setMessage(null);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("video", file, file.name);
        const data = await requestFormData<{ animation: Animation }>(
          `/api/animations/${animationId}/continuation-video`,
          formData,
          { errorMessage: "Failed to upload continuation video." }
        );
        updateAnimationState(data.animation);
        setMessage("Continuation video uploaded.");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to upload continuation video."
        );
      } finally {
        setIsContinuationVideoSaving(false);
      }
    },
    [animationId, updateAnimationState, setError]
  );

  const handleContinuationVideoClear = useCallback(async () => {
    if (!animation) return;
    await applyAnimationPatch(
      {
        generationContinuationVideoUrl: null,
        generationContinuationEnabled: false,
      },
      { success: "Continuation video cleared." }
    );
  }, [animation, applyAnimationPatch]);

  const handleGenerationLoopToggle = useCallback(
    async (nextValue: boolean) => {
      const patch: Partial<Animation> = { generationLoop: nextValue };
      if (nextValue) {
        patch.generationEndImageUrl = null;
      }
      await applyAnimationPatch(patch, {
        success: nextValue ? "Loop enabled." : "Loop disabled.",
      });
    },
    [applyAnimationPatch]
  );

  const hasChanges = useMemo(() => {
    if (!animation || !savedAnimation) return false;
    return JSON.stringify(animation) !== JSON.stringify(savedAnimation);
  }, [animation, savedAnimation]);

  const generationModel = String(animation?.generationModel ?? "sora-2");
  const expectedFrameCount = getExpectedFrameCount(
    Number(animation?.generationSeconds ?? 4),
    Number(animation?.extractFps ?? animation?.fps ?? 12)
  );
  const durationOptions = getVideoSecondsOptions(generationModel);
  const supportsStartEnd = getVideoModelSupportsStartEnd(generationModel);
  const supportsLoop = getVideoModelSupportsLoop(generationModel);
  const supportsNegativePrompt = getVideoModelSupportsNegativePrompt(generationModel);
  const supportsSeed = getVideoModelSupportsSeed(generationModel);
  const supportsReferenceImages =
    getVideoModelSupportsReferenceImages(generationModel);
  const referenceImageLimit = getVideoModelReferenceImageLimit(generationModel);
  const referenceConstraints =
    getVideoModelReferenceConstraints(generationModel);
  const supportsConcepts = getVideoModelSupportsConcepts(generationModel);
  const conceptOptions = getVideoModelConceptOptions(generationModel);
  const supportsEffect = getVideoModelSupportsEffect(generationModel);
  const supportsAudio = getVideoModelSupportsAudio(generationModel);
  const continuationEnabled = animation?.generationContinuationEnabled === true;
  const isToonCrafter = generationModel === "tooncrafter";
  const isPikaframes = generationModel === "pikaframes";
  const isWan = generationModel === "wan2.2";
  const isVertexProvider = selectedProvider === "vertex";
  const continuationVideoUrl =
    typeof animation?.generationContinuationVideoUrl === "string"
      ? animation.generationContinuationVideoUrl
      : "";
  const generationNegativePrompt =
    typeof animation?.generationNegativePrompt === "string"
      ? animation.generationNegativePrompt
      : "";
  const generationSeed =
    typeof animation?.generationSeed === "number" ? animation.generationSeed : "";
  const generationReferenceImageUrls = Array.isArray(
    animation?.generationReferenceImageUrls
  )
    ? animation.generationReferenceImageUrls
    : [];
  const generationConcepts = Array.isArray(animation?.generationConcepts)
    ? animation.generationConcepts
    : [];
  const generationEffect =
    typeof animation?.generationEffect === "string"
      ? animation.generationEffect
      : "";
  const effectActive = supportsEffect && generationEffect.trim().length > 0;
  const activeReference =
    character?.referenceImages?.find((img) => img.id === animation?.referenceImageId) ??
    character?.referenceImages?.find((img) => img.isPrimary) ??
    character?.referenceImages?.[0] ??
    null;
  const generationPlan = useGenerationPlan({
    animation,
    expectedFrameCount,
    activeReferenceUrl: activeReference?.url ?? null,
    supportsStartEnd,
    durationOptions,
    isToonCrafter,
    isPikaframes,
    isWan,
  });
  const pikaframesPlan = useMemo(() => {
    if (!animation || !isPikaframes) return null;
    const fpsValue = Number(animation.extractFps ?? animation.fps ?? 12);
    return buildPikaframesPlan({
      keyframes: Array.isArray(animation.keyframes) ? animation.keyframes : [],
      fps: fpsValue,
    });
  }, [animation, isPikaframes]);

  if (isLoading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center text-xs text-muted-foreground">
        Loading animation...
      </div>
    );
  }

  if (!animation) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center text-xs text-muted-foreground">
        Animation not found.
      </div>
    );
  }

  const displayFrameWidth = Number(animation.frameWidth ?? animation.spriteSize ?? 0);
  const displayFrameHeight = Number(animation.frameHeight ?? animation.spriteSize ?? 0);
  const loopedFrameCount =
    String(animation.loopMode ?? "pingpong") === "pingpong"
      ? Math.max(1, expectedFrameCount * 2 - 2)
      : expectedFrameCount;
  const generatedCount =
    animation.generatedFrames && animation.generatedFrames.length > 0
      ? animation.generatedFrames.length
      : undefined;
  const resolvedFrameCount =
    animation.actualFrameCount ?? generatedCount ?? animation.frameCount ?? expectedFrameCount;
  const safeResolvedFrameCount = Math.max(1, resolvedFrameCount);
  const sizeValid = isSizeValidForModel(
    String(animation.generationSize ?? "1024x1792"),
    generationModel
  );
  const modelProvider = allModelOptions.find(
    (option) => option.value === generationModel
  )?.provider;
  const providerValid = selectedProvider !== "";
  const providerMatchesModel =
    providerValid && Boolean(modelProvider) && modelProvider === selectedProvider;
  const generationLoop = Boolean(animation.generationLoop);
  const referenceImagesActive =
    supportsReferenceImages && generationReferenceImageUrls.length > 0;
  const endImageDisabled = generationLoop || referenceImagesActive || effectActive;
  const tooncrafterInterpolate = animation.tooncrafterInterpolate === true;
  const tooncrafterColorCorrection =
    typeof animation.tooncrafterColorCorrection === "boolean"
      ? animation.tooncrafterColorCorrection
      : true;
  const tooncrafterSeed = animation.tooncrafterSeed ?? "";
  const tooncrafterNegativePrompt =
    typeof animation.tooncrafterNegativePrompt === "string"
      ? animation.tooncrafterNegativePrompt
      : "";
  const tooncrafterEmptyPrompt = animation.tooncrafterEmptyPrompt === true;
  const wanSeed = animation.wanSeed ?? "";
  const wanNumInferenceSteps = animation.wanNumInferenceSteps ?? "";
  const wanEnableSafetyChecker = animation.wanEnableSafetyChecker === true;
  const wanEnableOutputSafetyChecker =
    animation.wanEnableOutputSafetyChecker === true;
  const wanEnablePromptExpansion = animation.wanEnablePromptExpansion === true;
  const wanAcceleration = animation.wanAcceleration ?? "regular";
  const wanGuidanceScale = animation.wanGuidanceScale ?? "";
  const wanGuidanceScale2 = animation.wanGuidanceScale2 ?? "";
  const wanShift = animation.wanShift ?? "";
  const wanInterpolatorModel = animation.wanInterpolatorModel ?? "film";
  const wanNumInterpolatedFrames = animation.wanNumInterpolatedFrames ?? "";
  const wanAdjustFpsForInterpolation =
    typeof animation.wanAdjustFpsForInterpolation === "boolean"
      ? animation.wanAdjustFpsForInterpolation
      : true;
  const wanVideoQuality = animation.wanVideoQuality ?? "high";
  const wanVideoWriteMode = animation.wanVideoWriteMode ?? "balanced";
  const promptProfile =
    animation.promptProfile ??
    getVideoModelPromptProfile(generationModel);
  const autoPromptConcise = buildVideoPrompt({
    description: String(animation.description ?? ""),
    style: String(animation.style ?? ""),
    artStyle: character?.style ?? "pixel-art",
    bgKeyColor: character?.workingSpec?.bgKeyColor,
    promptProfile: "concise",
  });
  const autoPromptVerbose = buildVideoPrompt({
    description: String(animation.description ?? ""),
    style: String(animation.style ?? ""),
    artStyle: character?.style ?? "pixel-art",
    bgKeyColor: character?.workingSpec?.bgKeyColor,
    promptProfile: "verbose",
  });
  const effectivePromptConcise =
    animation.promptConcise?.trim() ? animation.promptConcise : autoPromptConcise;
  const effectivePromptVerbose =
    animation.promptVerbose?.trim() ? animation.promptVerbose : autoPromptVerbose;
  const usesEmptyPrompt = isToonCrafter && tooncrafterEmptyPrompt;
  const promptPreview = usesEmptyPrompt
    ? "Empty prompt enabled."
    : isPromptEditing
    ? promptProfile === "concise"
      ? draftPromptConcise
      : draftPromptVerbose
    : promptProfile === "concise"
    ? effectivePromptConcise
    : effectivePromptVerbose;

  const canGenerate =
    sizeValid && providerMatchesModel && generationPlan.errors.length === 0;
  const generationInProgress = animation.status === "generating";
  const queueProgressPercent = (() => {
    const queue = Array.isArray(animation.generationQueue)
      ? animation.generationQueue
      : [];
    if (queue.length === 0) return null;
    const completed = queue.filter((item) => item.status === "completed").length;
    const inProgress = queue.find((item) => item.status === "in_progress");
    const inProgressPct =
      typeof inProgress?.progress === "number" ? inProgress.progress : 0;
    const percent = Math.round(
      ((completed + inProgressPct / 100) / queue.length) * 100
    );
    return Number.isFinite(percent) ? percent : null;
  })();
  const progressValue = animation.generationJob?.progress;
  const progressPercentFromJob =
    typeof progressValue === "number"
      ? Math.round(progressValue > 1 ? progressValue : progressValue * 100)
      : null;
  const progressPercent = queueProgressPercent ?? progressPercentFromJob;
  const hasGeneratedFrames = (animation.generatedFrames?.length ?? 0) > 0;
  const canRebuild = hasGeneratedFrames;
  const generationQueue = Array.isArray(animation.generationQueue)
    ? animation.generationQueue
    : [];
  const versions = animation.versions ?? [];
  const activeVersionId = animation.activeVersionId ?? null;
  


  return (
    <div className="min-h-screen grid-bg">
      <Header
        breadcrumb={[
          { label: "Dashboard", href: "/" },
          { label: "Animations", href: "/animations" },
          { label: animation.name },
        ]}
      >
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          variant="outline"
          className="h-7 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
        >
          {isSaving ? "SAVING" : "SAVE"}
        </Button>
        <Button
          onClick={handleClearGeneration}
          disabled={isSaving}
          variant="outline"
          className="h-7 px-3 text-[10px] tracking-wider border-destructive/60 text-destructive hover:border-destructive"
        >
          CLEAR OUTPUT
        </Button>
        <Button
          onClick={handleRebuildSpritesheet}
          disabled={!canRebuild || isRebuilding || isRemovingBackground || generationInProgress}
          variant="outline"
          className="h-7 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
          title="Rebuild spritesheet from extracted frames using current loop mode"
        >
          {isRebuilding ? "REBUILDING" : "REBUILD SHEET"}
        </Button>
        <Button
          onClick={handleClearKeyframes}
          disabled={isSaving}
          variant="outline"
          className="h-7 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
        >
          CLEAR KEYFRAMES
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || generationInProgress || !canGenerate}
          className="bg-primary hover:bg-primary/80 text-primary-foreground h-7 px-3 text-[10px] tracking-wider"
          title="Uses the selected reference image"
        >
          {isGenerating || generationInProgress ? "GENERATING" : "GENERATE"}
        </Button>
      </Header>

      <main className="pt-16 pb-12 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <section className="py-6 border-b border-border">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs text-muted-foreground tracking-widest">
                  Animation Editor
                </p>
                <h1 className="text-2xl font-bold tracking-tight">
                  {animation.name}
                </h1>
                <p className="text-sm text-muted-foreground max-w-lg">
                  {character ? `Target: ${character.name}` : "No character loaded."}
                </p>
              </div>
              <div className="tech-border bg-card min-w-[200px]">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground tracking-wider">Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`status-dot ${
                      animation.status === "complete" ? "status-dot-online" :
                      animation.status === "generating" ? "status-dot-warning" :
                      animation.status === "failed" ? "status-dot-error" :
                      "status-dot-online"
                    }`} />
                    <span className={`text-[10px] capitalize ${
                      animation.status === "complete" ? "text-success" :
                      animation.status === "generating" ? "text-warning" :
                      animation.status === "failed" ? "text-destructive" :
                      "text-primary"
                    }`}>
                      {animation.status.replace("-", " ")}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frames</span>
                    <span>{safeResolvedFrameCount} @ {animation.fps}fps</span>
                  </div>
                  {generationInProgress && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Progress</span>
                      <span>{progressPercent !== null ? `${progressPercent}%` : "..."}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Video</span>
                    <span className={sizeValid ? "" : "text-destructive"}>
                      {String(animation.generationSize ?? "1024x1792")} {!sizeValid && "(invalid)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frame</span>
                    <span>
                      {displayFrameWidth}×{displayFrameHeight}px
                    </span>
                  </div>
                  {animation.generationNote && (
                    <div
                      className={`pt-1 text-[10px] ${
                        animation.status === "failed"
                          ? "text-destructive"
                          : "text-warning"
                      }`}
                    >
                      {animation.generationNote}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Generation Details Panel - shown when generation has been attempted */}
          {animation.generationModel && (animation.status === "generating" || animation.status === "complete" || animation.status === "failed") && (
            <section className="tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground tracking-wider">GENERATION DETAILS</span>
                <span
                  className={`text-[10px] ${
                    providerMatchesModel ? "text-muted-foreground" : "text-destructive"
                  }`}
                >
                  {providerValid
                    ? selectedProvider === "openai"
                      ? "OpenAI"
                      : selectedProvider === "replicate"
                      ? "Replicate"
                      : selectedProvider === "fal"
                      ? "Fal"
                      : "Vertex AI"
                    : "Provider required"}
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1">Model</span>
                  <span className="font-medium">{getVideoModelLabel(animation.generationModel)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Duration</span>
                  <span className="font-medium">{animation.generationSeconds ?? "—"}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Prompt Profile</span>
                  <span className="font-medium capitalize">{animation.promptProfile ?? "verbose"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Loop Mode</span>
                  <span className="font-medium capitalize">{animation.loopMode ?? "loop"}</span>
                </div>
              </div>
              <div className="px-4 pb-4">
                <span className="text-muted-foreground block mb-2 text-xs">Prompt</span>
                <div className="tech-border bg-background p-3 text-xs text-muted-foreground leading-relaxed max-h-24 overflow-y-auto">
                  {character ? buildVideoPrompt({
                    description: animation.description ?? "",
                    style: animation.style,
                    artStyle: character.style ?? "pixel-art",
                    promptProfile: animation.promptProfile ?? "verbose",
                  }) : animation.description ?? "No prompt available"}
                </div>
              </div>
            </section>
          )}

          {/* Tab navigation */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-4 py-2 text-xs tracking-wider border-b-2 transition-colors ${
                activeTab === "timeline"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Timeline Editor
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 text-xs tracking-wider border-b-2 transition-colors ${
                activeTab === "settings"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Animation Settings
            </button>
          </div>

          {/* Messages */}
          {(message || error) && (
            <div className={`tech-border bg-card p-3 text-xs ${error ? "text-destructive border-destructive/30" : "text-success border-success/30"}`}>
              {error ?? message}
            </div>
          )}

          {activeTab === "timeline" ? (
            <>
              {/* Timeline Editor */}
              <TimelineEditor
                animation={animation}
                currentFrame={currentFrame}
                onFrameChange={handleFrameChange}
                onKeyframeAction={handleTimelineKeyframeAction}
              />

              <section className="grid lg:grid-cols-[1fr,380px] gap-6">
                {/* Left: Frame Preview & Spritesheet */}
                <div className="space-y-6">
                  <FramePreview
                    animation={animation}
                    currentFrame={currentFrame}
                    showComparison={true}
                    referenceImageUrl={activeReference?.url ?? null}
                  />

                  {animation.generatedSpritesheet && (
                    <div className="tech-border bg-card">
                      <div className="w-full px-4 py-3 border-b border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground tracking-wider">GENERATED SPRITESHEET</span>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={handleRemoveSpritesheetBackground}
                            disabled={
                              !canRebuild ||
                              isRebuilding ||
                              isRemovingBackground ||
                              generationInProgress
                            }
                            variant="outline"
                            className="h-7 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
                          >
                            {isRemovingBackground ? "REMOVING BG" : "REMOVE BG"}
                          </Button>
                          <button
                            onClick={() => {
                              const next = !spritesheetExpanded;
                              setSpritesheetExpanded(next);
                              localStorage.setItem("spritesheet-panel-expanded", String(next));
                            }}
                            className="h-7 w-7 text-xs text-muted-foreground border border-border hover:border-primary hover:text-primary transition-colors"
                            aria-label={
                              spritesheetExpanded ? "Collapse spritesheet" : "Expand spritesheet"
                            }
                          >
                            {spritesheetExpanded ? "−" : "+"}
                          </button>
                        </div>
                      </div>
                      {spritesheetExpanded && (
                        <div className="p-4">
                          <div className="overflow-auto border border-border">
                            <img
                              src={animation.generatedSpritesheet}
                              alt="Generated spritesheet"
                              className="max-w-full"
                              style={{ imageRendering: "pixelated" }}
                            />
                          </div>
                          <div className="mt-3 text-[10px] text-muted-foreground">
                            Applies AI background removal to frames and rebuilds the sheet.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Keyframe Controls & Export */}
                <div className="space-y-6">
                  {/* Keyframe Controls Panel - Using AdvancedKeyframePanel */}
                  <AdvancedKeyframePanel
                    key={currentFrame}
                    animation={animation}
                    character={character}
                    currentFrame={currentFrame}
                    onFrameChange={handleFrameChange}
                    onKeyframeAction={handleKeyframeAction}
                    onClearKeyframe={clearKeyframe}
                    onReferenceSelect={(referenceImageId) => {
                      void saveReferenceSelection(referenceImageId);
                    }}
                    isWorking={isKeyframeWorking}
                    generationHistory={recentGenerations}
                    savedGenerations={savedGenerations}
                    onGenerationSave={saveKeyframeGeneration}
                    onGenerationUse={useKeyframeGeneration}
                    onGenerationDownload={downloadKeyframeGeneration}
                    generationActionId={generationActionId}
                    onAnimationRefUpload={handleAnimationRefUpload}
                    onAnimationRefDelete={handleAnimationRefDelete}
                  />

                  <ImportPanel
                    animationId={animationId}
                    animation={animation}
                    onAnimationUpdate={updateAnimationState}
                    onMessage={setMessage}
                    onError={setError}
                  />

                  <VersionManager
                    animationId={animationId}
                    versions={versions}
                    activeVersionId={activeVersionId}
                    onAnimationUpdate={updateAnimationState}
                    onMessage={setMessage}
                    onError={setError}
                  />

                  {/* Export Panel */}
                  <ExportPanel
                    animation={animation}
                    onExport={handleExport}
                    isExporting={isExporting}
                  />
                </div>
              </section>
            </>
          ) : (
            /* Settings Tab */
            <section className="grid lg:grid-cols-[1fr,360px] gap-6">
            <div className="space-y-6">
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Name</p>
                <input
                  value={animation.name}
                  onChange={(event) => setAnimation({ ...animation, name: event.target.value })}
                  className="terminal-input w-full h-10 px-3 text-sm bg-card"
                />
              </div>
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Description</p>
                <textarea
                  value={animation.description}
                  onChange={(event) => setAnimation({ ...animation, description: event.target.value })}
                  rows={4}
                  className="terminal-input w-full p-3 text-sm bg-card resize-none"
                />
              </div>
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Style Preset</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAnimation({ ...animation, style: option.value })}
                      className={`tech-border p-3 text-left transition-all duration-150 ${
                        animation.style === option.value
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={animation.style === option.value ? "text-primary text-xs font-medium" : "text-xs font-medium"}>
                          {option.label}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 border ${
                            animation.style === option.value
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {option.code}
                        </span>
                      </div>
                      <div className={animation.style === option.value ? "h-1 w-full bg-primary" : "h-1 w-full bg-border"} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Prompt Preview</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="tracking-widest">Profile</span>
                  <span className="text-primary">{promptProfile}</span>
                </div>
                <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                  {promptPreview}
                </div>
              </div>
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Prompt Overrides</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPromptConcise(effectivePromptConcise);
                      setDraftPromptVerbose(effectivePromptVerbose);
                      setIsPromptEditing(true);
                    }}
                    disabled={isPromptEditing}
                    className="px-3 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void applyAnimationPatch(
                        {
                          promptConcise: draftPromptConcise,
                          promptVerbose: draftPromptVerbose,
                        },
                        { success: "Prompts saved." }
                      );
                      setIsPromptEditing(false);
                    }}
                    disabled={!isPromptEditing}
                    className="px-3 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void applyAnimationPatch(
                        { promptConcise: "", promptVerbose: "" },
                        { success: "Prompts reset." }
                      );
                      setDraftPromptConcise(autoPromptConcise);
                      setDraftPromptVerbose(autoPromptVerbose);
                      setIsPromptEditing(false);
                    }}
                    className="px-3 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                  >
                    Reset
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground tracking-widest">Concise</p>
                    <textarea
                      value={isPromptEditing ? draftPromptConcise : effectivePromptConcise}
                      onChange={(event) => setDraftPromptConcise(event.target.value)}
                      rows={4}
                      placeholder={autoPromptConcise}
                      disabled={!isPromptEditing}
                      className="terminal-input w-full p-3 text-xs bg-card resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Leave blank to auto-generate from description + preset.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground tracking-widest">Verbose</p>
                    <textarea
                      value={isPromptEditing ? draftPromptVerbose : effectivePromptVerbose}
                      onChange={(event) => setDraftPromptVerbose(event.target.value)}
                      rows={4}
                      placeholder={autoPromptVerbose}
                      disabled={!isPromptEditing}
                      className="terminal-input w-full p-3 text-xs bg-card resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Leave blank to auto-generate with full constraints.
                    </p>
                  </div>
                </div>
              </div>
              {supportsNegativePrompt && !isToonCrafter && (
                <div className="tech-border bg-card p-4 space-y-2">
                  <p className="text-xs text-muted-foreground tracking-widest">
                    Negative Prompt
                  </p>
                  <textarea
                    value={generationNegativePrompt}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setAnimation({
                        ...animation,
                        generationNegativePrompt: raw.trim() ? raw : null,
                      });
                    }}
                    rows={3}
                    placeholder="Optional: avoid artifacts, extra limbs, blur..."
                    className="terminal-input w-full p-3 text-xs bg-card resize-none"
                    disabled={isGenerationFrameSaving}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Optional. Sent as negative_prompt for supported models.
                  </p>
                </div>
              )}

              {supportsSeed && !isWan && !isToonCrafter && (
                <div className="tech-border bg-card p-4 space-y-2">
                  <p className="text-xs text-muted-foreground tracking-widest">Seed</p>
                  <input
                    type="number"
                    value={generationSeed}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const nextSeed =
                        raw.trim() === "" ? null : Number(raw);
                      setAnimation({
                        ...animation,
                        generationSeed:
                          typeof nextSeed === "number" && Number.isFinite(nextSeed)
                            ? nextSeed
                            : null,
                      });
                    }}
                    placeholder="Random"
                    className="terminal-input w-full h-9 px-3 text-sm bg-card"
                    disabled={isGenerationFrameSaving}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Leave blank for random.
                  </p>
                </div>
              )}

              {supportsReferenceImages && (
                <div className="tech-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground tracking-widest">
                      Reference Images
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {generationReferenceImageUrls.length}/
                      {referenceImageLimit ?? 0}
                    </span>
                  </div>
                  {referenceConstraints && (
                    <p className="text-[10px] text-muted-foreground">
                      Requires {referenceConstraints.aspectRatio} and{" "}
                      {referenceConstraints.seconds}s. End frame is ignored.
                    </p>
                  )}
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground tracking-widest">
                      Character References
                    </p>
                    {character?.referenceImages?.length ? (
                      <div className="grid grid-cols-4 gap-2">
                        {character.referenceImages.map((ref) => {
                          const isSelected =
                            generationReferenceImageUrls.includes(ref.url);
                          return (
                            <button
                              key={ref.id}
                              type="button"
                              onClick={() => {
                                const selected = new Set(
                                  generationReferenceImageUrls
                                );
                                if (selected.has(ref.url)) {
                                  selected.delete(ref.url);
                                } else {
                                  if (
                                    referenceImageLimit &&
                                    selected.size >= referenceImageLimit
                                  ) {
                                    setError(
                                      `Select up to ${referenceImageLimit} reference images.`
                                    );
                                    return;
                                  }
                                  selected.add(ref.url);
                                }
                                setAnimation({
                                  ...animation,
                                  generationReferenceImageUrls: Array.from(selected),
                                });
                              }}
                              className={`border p-1 transition-colors ${
                                isSelected
                                  ? "border-primary"
                                  : "border-border hover:border-primary/50"
                              }`}
                              disabled={isGenerationFrameSaving}
                              title="Toggle reference"
                            >
                              <img
                                src={ref.url}
                                alt="Character reference"
                                className="w-full aspect-square object-contain bg-muted/20"
                              />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        No character references available.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground tracking-widest">
                      Animation References
                    </p>
                    {animation.references?.length ? (
                      <div className="grid grid-cols-4 gap-2">
                        {animation.references.map((ref) => {
                          const isSelected =
                            generationReferenceImageUrls.includes(ref.url);
                          return (
                            <button
                              key={ref.id}
                              type="button"
                              onClick={() => {
                                const selected = new Set(
                                  generationReferenceImageUrls
                                );
                                if (selected.has(ref.url)) {
                                  selected.delete(ref.url);
                                } else {
                                  if (
                                    referenceImageLimit &&
                                    selected.size >= referenceImageLimit
                                  ) {
                                    setError(
                                      `Select up to ${referenceImageLimit} reference images.`
                                    );
                                    return;
                                  }
                                  selected.add(ref.url);
                                }
                                setAnimation({
                                  ...animation,
                                  generationReferenceImageUrls: Array.from(selected),
                                });
                              }}
                              className={`border p-1 transition-colors ${
                                isSelected
                                  ? "border-primary"
                                  : "border-border hover:border-primary/50"
                              }`}
                              disabled={isGenerationFrameSaving}
                              title="Toggle reference"
                            >
                              <img
                                src={ref.url}
                                alt="Animation reference"
                                className="w-full aspect-square object-contain bg-muted/20"
                              />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        No animation references uploaded.
                      </p>
                    )}
                  </div>

                  {generationReferenceImageUrls.length > 0 && (
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                      onClick={() =>
                        setAnimation({
                          ...animation,
                          generationReferenceImageUrls: [],
                        })
                      }
                      disabled={isGenerationFrameSaving}
                    >
                      Clear references
                    </button>
                  )}
                </div>
              )}

              {supportsConcepts && conceptOptions.length > 0 && (
                <div className="tech-border bg-card p-4 space-y-2">
                  <p className="text-xs text-muted-foreground tracking-widest">
                    Camera Concepts
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {conceptOptions.map((concept) => {
                      const selected = generationConcepts.includes(concept);
                      return (
                        <label
                          key={concept}
                          className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const next = selected
                                ? generationConcepts.filter(
                                    (item) => item !== concept
                                  )
                                : [...generationConcepts, concept];
                              setAnimation({
                                ...animation,
                                generationConcepts: next,
                              });
                            }}
                            className="w-3.5 h-3.5"
                          />
                          {concept.replace(/_/g, " ")}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {supportsEffect && (
                <div className="tech-border bg-card p-4 space-y-2">
                  <p className="text-xs text-muted-foreground tracking-widest">
                    Effect
                  </p>
                  <input
                    value={generationEffect}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setAnimation({
                        ...animation,
                        generationEffect: raw.trim() ? raw : null,
                      });
                    }}
                    placeholder="Effect name (optional)"
                    className="terminal-input w-full h-9 px-3 text-sm bg-card"
                    disabled={isGenerationFrameSaving}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    PixVerse effects disable the end frame.
                  </p>
                </div>
              )}

              {supportsAudio && (
                <div className="tech-border bg-card p-4 space-y-2">
                  <p className="text-xs text-muted-foreground tracking-widest">
                    Audio
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Audio generation is disabled for character animation.
                  </p>
                </div>
              )}
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Provider</p>
                <select
                  value={selectedProvider}
                  onChange={(event) => {
                    if (!animation) return;
                    const rawProvider = event.target.value;
                    const provider =
                      rawProvider === "openai" ||
                      rawProvider === "replicate" ||
                      rawProvider === "fal" ||
                      rawProvider === "vertex"
                        ? rawProvider
                        : undefined;
                    if (!provider) {
                      setAnimation({ ...animation, generationProvider: undefined });
                      return;
                    }

                    const currentModel = String(animation.generationModel ?? "sora-2");
                    const providerModels = allModelOptions.filter(
                      (option) => option.provider === provider
                    );
                    const nextModel = providerModels.some(
                      (option) => option.value === currentModel
                    )
                      ? currentModel
                      : providerModels[0]?.value ?? currentModel;

                    const currentSize = String(animation.generationSize ?? "1024x1792");
                    const nextSize = isSizeValidForModel(currentSize, nextModel)
                      ? currentSize
                      : coerceVideoSizeForModel(currentSize, nextModel);
                    const currentSeconds = Number(animation.generationSeconds ?? 4);
                    const nextSeconds = coerceVideoSecondsForModel(currentSeconds, nextModel);
                    const fpsValue = Number(animation.extractFps ?? animation.fps ?? 12);
                    const frameCount = getExpectedFrameCount(nextSeconds, fpsValue);
                    const nextPromptProfile =
                      animation.promptProfile ?? getVideoModelPromptProfile(nextModel);

                    setAnimation({
                      ...animation,
                      generationProvider: provider,
                      generationModel: nextModel,
                      generationSize: nextSize,
                      generationSeconds: nextSeconds,
                      promptProfile: nextPromptProfile,
                      frameCount,
                    });
                  }}
                  className="terminal-input w-full h-9 px-3 text-sm bg-card"
                >
                  <option value="">Select provider</option>
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {!providerValid && (
                  <p className="text-[10px] text-destructive">
                    Provider selection is required before generating.
                  </p>
                )}
              </div>

              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Video Model</p>
                <select
                  value={animation.generationModel ?? "sora-2"}
                  onChange={(event) => {
                    if (!animation) return;
                    const nextModel = event.target.value;
                    const currentSize = String(animation.generationSize ?? "1024x1792");
                    const nextSize = isSizeValidForModel(currentSize, nextModel)
                      ? currentSize
                      : coerceVideoSizeForModel(currentSize, nextModel);
                    const currentSeconds = Number(animation.generationSeconds ?? 4);
                    const nextSeconds = coerceVideoSecondsForModel(currentSeconds, nextModel);
                    const fpsValue = Number(animation.extractFps ?? animation.fps ?? 12);
                    const frameCount = getExpectedFrameCount(nextSeconds, fpsValue);
                    const nextPromptProfile =
                      animation.promptProfile ?? getVideoModelPromptProfile(nextModel);
                    setAnimation({
                      ...animation,
                      generationModel: nextModel,
                      generationSize: nextSize,
                      generationSeconds: nextSeconds,
                      promptProfile: nextPromptProfile,
                      frameCount,
                    });
                  }}
                  className="terminal-input w-full h-9 px-3 text-sm bg-card"
                  disabled={!providerValid}
                >
                  {modelOptions.length === 0 ? (
                    <option value="">Select provider to view models</option>
                  ) : (
                    modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
                {!providerMatchesModel && providerValid && (
                  <p className="text-[10px] text-destructive">
                    Provider does not match the selected model.
                  </p>
                )}
                {isToonCrafter && (
                  <p className="text-[10px] text-muted-foreground">
                    Uses 2-10 keyframes to generate a full video, then extracts sprite frames.
                    If you provide more than 10, we sample evenly. &quot;Native&quot; size uses your
                    keyframe dimensions.
                  </p>
                )}
                {isPikaframes && (
                  <p className="text-[10px] text-muted-foreground">
                    Uses 2-5 timeline keyframes and derives transition timing from frame spacing.
                    Total transition time must stay under 25s.
                  </p>
                )}
                {isWan && (
                  <p className="text-[10px] text-muted-foreground">
                    Uses the start/end frames panel. Intermediate timeline keyframes are ignored.
                  </p>
                )}
              </div>

              {isVertexProvider && (
                <div className="tech-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground tracking-widest">
                      Vertex Continuation
                    </p>
                    <span
                      className={`text-[10px] ${
                        continuationEnabled ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {continuationEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={continuationEnabled}
                      onChange={(e) => {
                        if (!animation) return;
                        setAnimation({
                          ...animation,
                          generationContinuationEnabled: e.target.checked,
                        });
                      }}
                      className="form-checkbox"
                      disabled={isContinuationVideoSaving}
                    />
                    Continue from uploaded video
                  </label>
                  <p className="text-[10px] text-muted-foreground">
                    Upload an MP4 clip (1-30s, 24 FPS, 720p or 1080p). The input
                    is normalized before sending to Vertex.
                  </p>
                  {continuationEnabled && (
                    <div className="space-y-2">
                      {continuationVideoUrl ? (
                        <video
                          src={continuationVideoUrl}
                          controls
                          className="w-full h-28 object-contain border border-border bg-muted/20"
                        />
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          No continuation video uploaded yet.
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="video/mp4"
                          className="text-[10px] text-muted-foreground"
                          disabled={isContinuationVideoSaving}
                          onChange={(e) =>
                            void handleContinuationVideoUpload(
                              e.target.files?.[0] ?? null
                            )
                          }
                        />
                        {continuationVideoUrl && (
                          <button
                            type="button"
                            className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                            disabled={isContinuationVideoSaving}
                            onClick={() => void handleContinuationVideoClear()}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {!continuationVideoUrl && (
                        <p className="text-[10px] text-destructive">
                          Upload an MP4 to enable generation.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Prompt Profile</p>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_PROFILE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAnimation({ ...animation, promptProfile: option.value })}
                      className={`px-3 py-1 text-xs border ${
                        promptProfile === option.value
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Concise keeps prompts short. Verbose adds stricter constraints.
                </p>
              </div>

              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Clip Duration</p>
                <div className="flex flex-wrap gap-2">
                  {durationOptions.map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        const fpsValue = Number(animation.extractFps ?? animation.fps ?? 12);
                        const frameCount = getExpectedFrameCount(value, fpsValue);
                        setAnimation({
                          ...animation,
                          generationSeconds: value,
                          frameCount,
                        });
                      }}
                      className={`px-3 py-1 text-xs border ${
                        Number(animation.generationSeconds ?? 4) === value
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {value}s
                    </button>
                  ))}
                </div>
              </div>

              {isToonCrafter && (
                <div className="tech-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground tracking-widest">
                      ToonCrafter Options
                    </p>
                    <span className="text-[10px] text-primary">Keyframes</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generationLoop}
                      onChange={(e) =>
                        setAnimation({ ...animation, generationLoop: e.target.checked })
                      }
                      className="form-checkbox"
                      disabled={isGenerationFrameSaving}
                    />
                    Loop output
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tooncrafterInterpolate}
                      onChange={(e) =>
                        setAnimation({
                          ...animation,
                          tooncrafterInterpolate: e.target.checked,
                        })
                      }
                      className="form-checkbox"
                      disabled={isGenerationFrameSaving}
                    />
                    Interpolate (2x)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tooncrafterColorCorrection}
                      onChange={(e) =>
                        setAnimation({
                          ...animation,
                          tooncrafterColorCorrection: e.target.checked,
                        })
                      }
                      className="form-checkbox"
                      disabled={isGenerationFrameSaving}
                    />
                    Color correction
                  </label>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground tracking-widest">Seed</p>
                    <input
                      type="number"
                      value={tooncrafterSeed}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const nextSeed =
                          raw.trim() === "" ? null : Number(raw);
                        setAnimation({
                          ...animation,
                          tooncrafterSeed:
                            typeof nextSeed === "number" &&
                            Number.isFinite(nextSeed)
                              ? nextSeed
                              : null,
                        });
                      }}
                      placeholder="Random"
                      className="terminal-input w-full h-9 px-3 text-sm bg-card"
                      disabled={isGenerationFrameSaving}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Leave blank for random.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground tracking-widest">
                      Negative Prompt
                    </p>
                    <textarea
                      value={tooncrafterNegativePrompt}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setAnimation({
                          ...animation,
                          tooncrafterNegativePrompt: raw.trim() ? raw : null,
                        });
                      }}
                      rows={3}
                      placeholder="Optional: avoid artifacts, extra limbs, blur..."
                      className="terminal-input w-full p-3 text-xs bg-card resize-none"
                      disabled={isGenerationFrameSaving}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Optional. Leave blank to skip.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tooncrafterEmptyPrompt}
                      onChange={(e) =>
                        setAnimation({
                          ...animation,
                          tooncrafterEmptyPrompt: e.target.checked,
                        })
                      }
                      className="form-checkbox"
                      disabled={isGenerationFrameSaving}
                    />
                    Send empty prompt (ignore auto + overrides)
                  </label>
                </div>
              )}

              {isWan && (
                <div className="tech-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground tracking-widest">
                      Wan 2.2 Options
                    </p>
                    <span className="text-[10px] text-primary">Fal</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground tracking-widest">
                      Seed
                    </p>
                    <input
                      type="number"
                      value={wanSeed}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const nextSeed =
                          raw.trim() === "" ? null : Number(raw);
                        setAnimation({
                          ...animation,
                          wanSeed:
                            typeof nextSeed === "number" &&
                            Number.isFinite(nextSeed)
                              ? nextSeed
                              : null,
                        });
                      }}
                      placeholder="Random"
                      className="terminal-input w-full h-9 px-3 text-sm bg-card"
                      disabled={isGenerationFrameSaving}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Leave blank for random.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowWanAdvanced((prev) => !prev)}
                    className="text-[10px] text-primary hover:underline uppercase tracking-widest"
                  >
                    {showWanAdvanced ? "- Hide Advanced" : "+ Show Advanced"}
                  </button>

                  {showWanAdvanced && (
                    <div className="space-y-4 pt-2 border-t border-border">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Num Inference Steps
                          </label>
                          <input
                            type="number"
                            min={2}
                            max={40}
                            value={wanNumInferenceSteps}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next =
                                raw.trim() === "" ? null : Number(raw);
                              setAnimation({
                                ...animation,
                                wanNumInferenceSteps:
                                  typeof next === "number" && Number.isFinite(next)
                                    ? next
                                    : null,
                              });
                            }}
                            placeholder="Default 27"
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Acceleration
                          </label>
                          <select
                            value={wanAcceleration}
                            onChange={(e) => {
                              const value =
                                e.target.value === "none" ? "none" : "regular";
                              setAnimation({
                                ...animation,
                                wanAcceleration: value,
                              });
                            }}
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          >
                            <option value="regular">regular</option>
                            <option value="none">none</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Guidance Scale
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            step={0.1}
                            value={wanGuidanceScale}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next =
                                raw.trim() === "" ? null : Number(raw);
                              setAnimation({
                                ...animation,
                                wanGuidanceScale:
                                  typeof next === "number" && Number.isFinite(next)
                                    ? next
                                    : null,
                              });
                            }}
                            placeholder="Default 3.5"
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Guidance Scale 2
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            step={0.1}
                            value={wanGuidanceScale2}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next =
                                raw.trim() === "" ? null : Number(raw);
                              setAnimation({
                                ...animation,
                                wanGuidanceScale2:
                                  typeof next === "number" && Number.isFinite(next)
                                    ? next
                                    : null,
                              });
                            }}
                            placeholder="Default 3.5"
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Shift
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            step={0.1}
                            value={wanShift}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next =
                                raw.trim() === "" ? null : Number(raw);
                              setAnimation({
                                ...animation,
                                wanShift:
                                  typeof next === "number" && Number.isFinite(next)
                                    ? next
                                    : null,
                              });
                            }}
                            placeholder="Default 5"
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Interpolator Model
                          </label>
                          <select
                            value={wanInterpolatorModel}
                            onChange={(e) => {
                              const value = e.target.value;
                              const next =
                                value === "none" || value === "rife"
                                  ? value
                                  : "film";
                              setAnimation({
                                ...animation,
                                wanInterpolatorModel: next,
                              });
                            }}
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          >
                            <option value="film">film</option>
                            <option value="none">none</option>
                            <option value="rife">rife</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Num Interpolated Frames
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={4}
                            value={wanNumInterpolatedFrames}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next =
                                raw.trim() === "" ? null : Number(raw);
                              setAnimation({
                                ...animation,
                                wanNumInterpolatedFrames:
                                  typeof next === "number" && Number.isFinite(next)
                                    ? next
                                    : null,
                              });
                            }}
                            placeholder="Default 1"
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs mt-6">
                          <input
                            type="checkbox"
                            checked={wanAdjustFpsForInterpolation}
                            onChange={(e) =>
                              setAnimation({
                                ...animation,
                                wanAdjustFpsForInterpolation: e.target.checked,
                              })
                            }
                            className="form-checkbox"
                            disabled={isGenerationFrameSaving}
                          />
                          Adjust FPS for interpolation
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={wanEnableSafetyChecker}
                            onChange={(e) =>
                              setAnimation({
                                ...animation,
                                wanEnableSafetyChecker: e.target.checked,
                              })
                            }
                            className="form-checkbox"
                            disabled={isGenerationFrameSaving}
                          />
                          Enable Safety Checker
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={wanEnableOutputSafetyChecker}
                            onChange={(e) =>
                              setAnimation({
                                ...animation,
                                wanEnableOutputSafetyChecker: e.target.checked,
                              })
                            }
                            className="form-checkbox"
                            disabled={isGenerationFrameSaving}
                          />
                          Enable Output Safety Checker
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={wanEnablePromptExpansion}
                          onChange={(e) =>
                            setAnimation({
                              ...animation,
                              wanEnablePromptExpansion: e.target.checked,
                            })
                          }
                          className="form-checkbox"
                          disabled={isGenerationFrameSaving}
                        />
                        Enable Prompt Expansion
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Video Quality
                          </label>
                          <select
                            value={wanVideoQuality}
                            onChange={(e) =>
                              setAnimation({
                                ...animation,
                                wanVideoQuality:
                                  e.target.value === "low" ||
                                  e.target.value === "medium" ||
                                  e.target.value === "maximum"
                                    ? e.target.value
                                    : "high",
                              })
                            }
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                            <option value="maximum">maximum</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Video Write Mode
                          </label>
                          <select
                            value={wanVideoWriteMode}
                            onChange={(e) =>
                              setAnimation({
                                ...animation,
                                wanVideoWriteMode:
                                  e.target.value === "fast" ||
                                  e.target.value === "small"
                                    ? e.target.value
                                    : "balanced",
                              })
                            }
                            className="terminal-input w-full h-9 px-3 text-sm bg-card"
                            disabled={isGenerationFrameSaving}
                          >
                            <option value="fast">fast</option>
                            <option value="balanced">balanced</option>
                            <option value="small">small</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isToonCrafter && !isPikaframes && (
                <div className="tech-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground tracking-widest">
                    Start / End Frames
                  </p>
                  <span
                    className={`text-[10px] ${
                      supportsStartEnd || supportsLoop
                        ? "text-success"
                        : "text-muted-foreground"
                    }`}
                  >
                    {supportsStartEnd || supportsLoop ? "Supported" : "Not supported"}
                  </span>
                </div>
                {!supportsStartEnd && !supportsLoop ? (
                  <p className="text-[10px] text-muted-foreground">
                    This model does not support explicit start/end frame controls.
                  </p>
                ) : (
                  <>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={generationLoop}
                        onChange={(e) => void handleGenerationLoopToggle(e.target.checked)}
                        className="form-checkbox"
                        disabled={isGenerationFrameSaving}
                      />
                      Match first/last frame (loop)
                    </label>
                    {!supportsLoop && generationLoop && (
                      <p className="text-[10px] text-muted-foreground">
                        This model doesn’t support a loop flag; end frame will reuse the start frame.
                      </p>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-[10px] text-muted-foreground tracking-widest">
                          Start Frame
                        </p>
                        {generationStartPreview || animation.generationStartImageUrl ? (
                          <img
                            src={generationStartPreview ?? animation.generationStartImageUrl}
                            alt="Start frame"
                            className="w-full h-24 object-contain border border-border bg-muted/20"
                          />
                        ) : (
                          <p className="text-[10px] text-muted-foreground">
                            Default: character reference
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          {activeReference && (
                            <button
                              type="button"
                              className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                              disabled={isGenerationFrameSaving}
                              onClick={() =>
                                void applyAnimationPatch(
                                  { generationStartImageUrl: activeReference.url },
                                  { success: "Start frame set." }
                                )
                              }
                            >
                              Use active reference
                            </button>
                          )}
                          {animation.generationStartImageUrl && (
                            <button
                              type="button"
                              className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                              disabled={isGenerationFrameSaving}
                              onClick={() =>
                                void applyAnimationPatch(
                                  { generationStartImageUrl: null },
                                  { success: "Start frame cleared." }
                                )
                              }
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="text-[10px] text-muted-foreground"
                          disabled={isGenerationFrameSaving}
                          onChange={(e) =>
                            void handleGenerationFrameUpload(
                              "start",
                              e.target.files?.[0] ?? null
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] text-muted-foreground tracking-widest">
                          End Frame
                        </p>
                        {!endImageDisabled && (generationEndPreview || animation.generationEndImageUrl) ? (
                          <img
                            src={generationEndPreview ?? animation.generationEndImageUrl}
                            alt="End frame"
                            className="w-full h-24 object-contain border border-border bg-muted/20"
                          />
                        ) : (
                          <p className="text-[10px] text-muted-foreground">
                            {generationLoop
                              ? "Using start frame."
                              : referenceImagesActive
                              ? "End frame ignored when reference images are used."
                              : effectActive
                              ? "End frame disabled when effect is set."
                              : "Optional end frame for interpolation."}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          {activeReference && !endImageDisabled && (
                            <button
                              type="button"
                              className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                              disabled={isGenerationFrameSaving}
                              onClick={() =>
                                void applyAnimationPatch(
                                  {
                                    generationEndImageUrl: activeReference.url,
                                    generationLoop: false,
                                  },
                                  { success: "End frame set." }
                                )
                              }
                            >
                              Use active reference
                            </button>
                          )}
                          {animation.generationEndImageUrl && !endImageDisabled && (
                            <button
                              type="button"
                              className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                              disabled={isGenerationFrameSaving}
                              onClick={() =>
                                void applyAnimationPatch(
                                  { generationEndImageUrl: null },
                                  { success: "End frame cleared." }
                                )
                              }
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="text-[10px] text-muted-foreground"
                          disabled={isGenerationFrameSaving || endImageDisabled}
                          onChange={(e) =>
                            void handleGenerationFrameUpload(
                              "end",
                              e.target.files?.[0] ?? null
                            )
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
                </div>
              )}

              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Extract FPS</p>
                <div className="flex flex-wrap gap-2">
                  {EXTRACT_FPS_OPTIONS.map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        const secondsValue = Number(animation.generationSeconds ?? 4);
                        const frameCount = getExpectedFrameCount(secondsValue, value);
                        setAnimation({
                          ...animation,
                          extractFps: value,
                          fps: value,
                          frameCount,
                        });
                      }}
                      className={`px-3 py-1 text-xs border ${
                        Number(animation.extractFps ?? animation.fps ?? 12) === value
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {value} fps
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Frame duration:{" "}
                  {Math.round(1000 / Number(animation.extractFps ?? animation.fps ?? 12))}ms
                </p>
              </div>

              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Loop Mode</p>
                <div className="flex flex-col gap-2">
                  {["pingpong", "loop"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() =>
                        setAnimation({
                          ...animation,
                          loopMode: mode as "pingpong" | "loop",
                        })
                      }
                      className={`px-3 py-1 text-xs border text-left ${
                        String(animation.loopMode ?? "pingpong") === mode
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {mode === "pingpong"
                        ? "Ping-pong (safe loop)"
                        : "Loop (end frame = start frame)"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Spritesheet Columns</p>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={Number(animation.sheetColumns ?? 6)}
                  onChange={(event) =>
                    setAnimation({
                      ...animation,
                      sheetColumns: Number(event.target.value) || 6,
                    })
                  }
                  className="terminal-input w-full h-9 px-3 text-sm bg-card"
                />
              </div>

              {/* Reference info */}
              <div className="tech-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground tracking-widest">Character Reference</p>
                  {animation.referenceImageId && (
                    <button
                      onClick={() => void saveReferenceSelection(null)}
                      className="text-[10px] text-primary hover:underline"
                      type="button"
                      disabled={isRefSaving}
                    >
                      Use Primary
                    </button>
                  )}
                </div>
                {character ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      {character.referenceImages[0] && (
                        <img
                          src={
                            character.referenceImages.find((img) => img.id === animation.referenceImageId)?.url ??
                            character.referenceImages.find((img) => img.isPrimary)?.url ??
                            character.referenceImages[0].url
                          }
                          alt={character.name}
                          className="w-16 h-16 object-contain border border-border bg-muted/20"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium">{character.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {character.referenceImages.length} reference images
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Using: {animation.referenceImageId ? "Selected reference" : "Primary reference"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {character.referenceImages.map((ref) => {
                        const isSelected = animation.referenceImageId
                          ? animation.referenceImageId === ref.id
                          : ref.isPrimary;
                        return (
                          <button
                            key={ref.id}
                            type="button"
                            onClick={() => void saveReferenceSelection(ref.id)}
                            className={`border p-1 transition-colors ${
                              isSelected
                                ? "border-primary"
                                : "border-border hover:border-primary/50"
                            }`}
                            title={`Use ${ref.type} reference`}
                            disabled={isRefSaving}
                          >
                            <img
                              src={ref.url}
                              alt={`${ref.type} reference`}
                              className="w-full aspect-square object-contain bg-muted/20"
                            />
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Video generation uses a single reference image unless reference image mode is active.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No character loaded</p>
                )}
              </div>
            </div>

            {/* Right: Model constraints */}
            <div className="space-y-6">
              <ModelConstraints
                generationSize={String(animation.generationSize ?? "1024x1792")}
                generationModel={String(animation.generationModel ?? "sora-2")}
                onSizeChange={(size) => {
                  if (referenceImagesActive && referenceConstraints) {
                    setError(
                      `Reference images require ${referenceConstraints.aspectRatio} and ${referenceConstraints.seconds}s.`
                    );
                    return;
                  }
                  setAnimation({ ...animation, generationSize: size });
                }}
                frameWidth={Number(animation.frameWidth ?? animation.spriteSize ?? 253)}
                frameHeight={Number(animation.frameHeight ?? animation.spriteSize ?? 504)}
              />

              {/* Frame count notice */}
              <div className="tech-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground tracking-widest">Frame Count</p>
                  <span className="text-[10px] text-warning">Derived</span>
                </div>
                <p className="text-2xl font-bold metric-value">{expectedFrameCount}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Base frames come from {animation.generationSeconds ?? 4}s ×{" "}
                  {animation.extractFps ?? animation.fps ?? 12}fps.{" "}
                  {String(animation.loopMode ?? "loop") === "pingpong"
                    ? `Ping-pong output: ${loopedFrameCount} frames.`
                    : `Loop output: ${loopedFrameCount} frames (end frame = start frame).`}
                </p>
              </div>

              {/* Keyframes summary */}
              <div className="tech-border bg-card p-4 space-y-3">
                <p className="text-xs text-muted-foreground tracking-widest">Keyframes</p>
                {animation.keyframes?.length ? (
                  <>
                    <p className="text-sm">{animation.keyframes.length} keyframe{animation.keyframes.length !== 1 ? "s" : ""} defined</p>
                    <div className="grid grid-cols-4 gap-2">
                      {animation.keyframes.slice(0, 8).map((frame) => (
                        <button
                          key={`${frame.frameIndex}-${frame.image}`}
                          onClick={() => {
                            handleFrameChange(frame.frameIndex);
                            setActiveTab("timeline");
                          }}
                          className="border border-border bg-card p-1 hover:border-primary/60 transition-colors"
                        >
                          {frame.image ? (
                            <img src={frame.image} alt={`Keyframe ${frame.frameIndex}`} className="w-full aspect-square object-cover" />
                          ) : (
                            <div className="w-full aspect-square flex items-center justify-center text-[9px] text-muted-foreground">{frame.frameIndex}</div>
                          )}
                        </button>
                      ))}
                    </div>
                    {animation.keyframes.length > 8 && (
                      <p className="text-[10px] text-muted-foreground">+{animation.keyframes.length - 8} more</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No keyframes defined. Use the Timeline Editor to add keyframes.</p>
                )}
              </div>

              {isPikaframes ? (
                <div className="tech-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground tracking-widest">Pikaframes Plan</p>
                    <span className="text-[10px] text-muted-foreground">
                      {pikaframesPlan?.keyframes.length ?? 0} keyframe{(pikaframesPlan?.keyframes.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  {pikaframesPlan && pikaframesPlan.keyframes.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {pikaframesPlan.keyframes.map((frame) => (
                          <div
                            key={`${frame.frameIndex}-${frame.image}`}
                            className="border border-border bg-card p-1"
                          >
                            {frame.image ? (
                              <img
                                src={frame.image}
                                alt={`Keyframe ${frame.frameIndex}`}
                                className="w-12 h-12 object-contain"
                              />
                            ) : (
                              <div className="w-12 h-12 flex items-center justify-center text-[9px] text-muted-foreground">
                                {frame.frameIndex}
                              </div>
                            )}
                            <div className="text-[9px] text-muted-foreground text-center mt-1">
                              Frame {frame.frameIndex}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {pikaframesPlan.transitions.map((transition) => (
                          <div
                            key={`${transition.startFrame}-${transition.endFrame}`}
                            className="border border-border/60 bg-background/40 p-2 text-[10px] flex items-center justify-between"
                          >
                            <span>
                              Frames {transition.startFrame} &rarr; {transition.endFrame}
                            </span>
                            <span>{transition.durationSeconds.toFixed(2)}s</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Total duration: {pikaframesPlan.totalDuration.toFixed(2)}s (max 25s).
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Add at least two keyframes with images to build transitions.
                    </p>
                  )}
                </div>
              ) : (
                <div className="tech-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground tracking-widest">Generation Queue</p>
                    <span className="text-[10px] text-muted-foreground">
                      {generationQueue.length
                        ? `${generationQueue.length} segment${generationQueue.length === 1 ? "" : "s"}`
                        : "Idle"}
                    </span>
                  </div>
                  {generationQueue.length > 0 ? (
                    <div className="space-y-2">
                      {generationQueue.map((item, index) => (
                        <div
                          key={item.id}
                          className="border border-border/60 bg-background/40 p-2 text-[10px] space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Segment {index + 1}
                            </span>
                            <span
                              className={
                                item.status === "completed"
                                  ? "text-success"
                                  : item.status === "failed"
                                  ? "text-destructive"
                                  : item.status === "in_progress"
                                  ? "text-warning"
                                  : "text-muted-foreground"
                              }
                            >
                              {item.status.replace("_", " ")}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-muted-foreground">Frames</span>{" "}
                              {item.startFrame}-{item.endFrame} ({item.targetFrameCount})
                            </div>
                            <div>
                              <span className="text-muted-foreground">Duration</span>{" "}
                              {item.durationSeconds}s
                            </div>
                            <div>
                              <span className="text-muted-foreground">Model</span>{" "}
                              {getVideoModelLabel(item.model)}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Provider</span>{" "}
                              {item.provider}
                            </div>
                          </div>
                          {(item.startImageUrl || item.endImageUrl) && (
                            <div className="flex gap-3">
                              {item.startImageUrl && (
                                <div className="space-y-1">
                                  <p className="text-[9px] text-muted-foreground">Start</p>
                                  <img
                                    src={item.startImageUrl}
                                    alt="Start frame"
                                    className="w-12 h-12 object-contain border border-border bg-muted/20"
                                  />
                                </div>
                              )}
                              {item.endImageUrl && (
                                <div className="space-y-1">
                                  <p className="text-[9px] text-muted-foreground">End</p>
                                  <img
                                    src={item.endImageUrl}
                                    alt="End frame"
                                    className="w-12 h-12 object-contain border border-border bg-muted/20"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          {item.error && (
                            <p className="text-[10px] text-destructive">{item.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No queued segments. Add keyframes to generate in chunks.
                    </p>
                  )}
                </div>
              )}
              {generationPlan.errors.length > 0 && (
                <div className="border border-destructive/40 bg-destructive/5 p-2 text-[10px] text-destructive space-y-1">
                  {generationPlan.errors.map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                </div>
              )}
              {generationPlan.warnings.length > 0 && (
                <div className="border border-border bg-muted/20 p-2 text-[10px] text-warning space-y-1">
                  {generationPlan.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
            </div>
          </section>
          )}
        </div>
      </main>
    </div>
  );
}
