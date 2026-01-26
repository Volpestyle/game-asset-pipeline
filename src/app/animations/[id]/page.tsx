"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import { CloudUpload } from "iconoir-react";
import { cn } from "@/lib/utils";
import { buildVideoPrompt } from "@/lib/ai/promptBuilder";
import {
  TimelineEditor,
  FramePreview,
  FrameStrip,
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
  getVideoProviderForModel,
  getVideoModelSupportsStartEnd,
  getVideoModelSupportsLoop,
  getVideoModelPromptProfile,
  getVideoModelLabel,
} from "@/components/animation";
import type { KeyframeFormData } from "@/components/animation";
import type { Animation, AnimationStyle, Character, PromptProfile } from "@/types";

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

export default function AnimationDetailPage() {
  const params = useParams();
  const animationId = String(params.id ?? "");

  const [animation, setAnimation] = useState<Animation | null>(null);
  const [savedAnimation, setSavedAnimation] = useState<Animation | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isKeyframeWorking, setIsKeyframeWorking] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "settings">("timeline");
  const [isInterpolating, setIsInterpolating] = useState(false);
  const [interpolationModel, setInterpolationModel] = useState<
    "rd-fast" | "rd-plus"
  >("rd-plus");
  const [isRefSaving, setIsRefSaving] = useState(false);
  const [isVersionWorking, setIsVersionWorking] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSkipRoi, setImportSkipRoi] = useState(true);
  const modelOptions = useMemo(() => getVideoModelOptions(), []);
  const [importDragOver, setImportDragOver] = useState(false);
  const [isGenerationFrameSaving, setIsGenerationFrameSaving] = useState(false);
  const [importVideoMeta, setImportVideoMeta] = useState<{
    duration: number;
    width: number;
    height: number;
  } | null>(null);
  const [spritesheetExpanded, setSpritesheetExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("spritesheet-panel-expanded");
    return stored === null ? true : stored === "true";
  });
  const [isPromptEditing, setIsPromptEditing] = useState(false);
  const [draftPromptConcise, setDraftPromptConcise] = useState("");
  const [draftPromptVerbose, setDraftPromptVerbose] = useState("");

  const updateAnimationState = useCallback((newAnim: Animation | null) => {
    setAnimation(newAnim);
    setSavedAnimation(newAnim);
  }, []);

  const loadAnimation = useCallback(async (options?: { silent?: boolean }) => {
    if (!animationId) return;
    if (!options?.silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const response = await fetch(`/api/animations/${animationId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Animation not found.");
      }
      const data = await response.json();
      let nextAnimation = data.animation as Animation;
      const model = String(nextAnimation.generationModel ?? "sora-2");
      const currentSize = String(nextAnimation.generationSize ?? "");
      const coercedSize = coerceVideoSizeForModel(
        currentSize || undefined,
        model
      );
      if (coercedSize !== currentSize) {
        nextAnimation = { ...nextAnimation, generationSize: coercedSize };
        if (String(nextAnimation.generationNote ?? "").includes("Invalid size")) {
          nextAnimation = {
            ...nextAnimation,
            generationNote: `Adjusted video size to ${coercedSize} for ${model}.`,
          };
        }
      }
      const currentSeconds = Number(nextAnimation.generationSeconds ?? NaN);
      const coercedSeconds = coerceVideoSecondsForModel(currentSeconds, model);
      if (coercedSeconds !== currentSeconds) {
        const fpsValue = Number(nextAnimation.extractFps ?? nextAnimation.fps ?? 6);
        const frameCount = getExpectedFrameCount(coercedSeconds, fpsValue);
        nextAnimation = {
          ...nextAnimation,
          generationSeconds: coercedSeconds,
          frameCount,
        };
      }
      setAnimation(nextAnimation);
      // setSavedAnimation should only be called if we trust the server state as "clean"
      // If we are polling, we might overwrite local changes.
      // But standard behavior for this app seems to be "server wins" on poll.
      updateAnimationState(nextAnimation);

      const characterResponse = await fetch(`/api/characters/${data.animation.characterId}`, { cache: "no-store" });
      if (characterResponse.ok) {
        const characterData = await characterResponse.json();
        setCharacter(characterData.character);
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
  }, [animationId, updateAnimationState]);

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

  const handleSave = async () => {
    if (!animation) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/animations/${animationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(animation),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to save.");
      }
      const data = await response.json();
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

    // Validate size before generating
    const currentSize = String(animation.generationSize ?? "1024x1792");
    const currentModel = String(animation.generationModel ?? "sora-2");
    const sizeValid = isSizeValidForModel(currentSize, currentModel);
    let adjustedSize: string | null = null;
    let nextAnimation = { ...animation };

    if (!sizeValid) {
      adjustedSize = coerceVideoSizeForModel(currentSize, currentModel);
      nextAnimation = { ...nextAnimation, generationSize: adjustedSize };
      setAnimation(nextAnimation);
    }

    setIsGenerating(true);
    setMessage(null);
    setError(null);
    try {
      // Auto-save before generating to ensure latest settings (like description) are used
      const saveResponse = await fetch(`/api/animations/${animationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextAnimation),
      });
      if (!saveResponse.ok) {
        throw new Error("Failed to auto-save settings before generation.");
      }
      // Update local state with saved version
      const savedData = await saveResponse.json();
      // Since we just auto-saved, the returned animation is the clean state
      updateAnimationState(savedData.animation);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animationId, async: true }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Generation failed.");
      }
      const data = await response.json();
      updateAnimationState(data.animation ?? savedData.animation);
      if (adjustedSize) {
        setMessage(
          `Generation started. Adjusted video size to ${adjustedSize} for ${currentModel}.`
        );
      } else {
        setMessage("Generation started.");
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
      const response = await fetch(`/api/animations/${animationId}/rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loopMode: animation.loopMode,
          sheetColumns: animation.sheetColumns,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Rebuild failed.");
      }
      const data = await response.json();
      updateAnimationState(data.animation);
      setMessage("Spritesheet rebuilt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed.");
    } finally {
      setIsRebuilding(false);
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
        if (data.seed.trim()) {
          formData.append("seed", data.seed.trim());
        }
        if (data.file) {
          formData.append("image", data.file, data.file.name);
        }
        if (data.inputPalette) {
          formData.append("inputPalette", data.inputPalette);
        }

        const response = await fetch(`/api/animations/${animationId}/keyframes`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const respData = await response.json();
          throw new Error(respData?.error || "Keyframe update failed.");
        }
        const respData = await response.json();
        updateAnimationState(respData.animation);
        setMessage(`Keyframe updated at frame ${data.frameIndex}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Keyframe update failed.");
      } finally {
        setIsKeyframeWorking(false);
      }
    },
    [animationId, updateAnimationState]
  );

  const clearKeyframe = useCallback(
    async (frameIndex: number) => {
      setError(null);
      setMessage(null);
      try {
        const response = await fetch(
          `/api/animations/${animationId}/keyframes/${frameIndex}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data?.error || "Failed to clear keyframe.");
        }
        const data = await response.json();
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
    alphaThreshold: number;
  }) => {
    if (!animationId) return;
    setIsExporting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animationId,
          normalize: options.normalize,
          removeBackground: options.removeBackground,
          alphaThreshold: options.alphaThreshold,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Export failed.");
      }
      const notes = [
        options.normalize ? "normalized" : null,
        options.removeBackground ? "background cleaned" : null,
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
        const response = await fetch(`/api/animations/${animationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceImageId }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data?.error || "Failed to save reference selection.");
        }
        const data = await response.json();
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

  const handleClearKeyframes = async () => {
    if (!animationId) return;
    const ok = window.confirm("Clear all keyframes? This removes keyframe images but keeps generated frames.");
    if (!ok) return;
    setMessage(null);
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/animations/${animationId}/keyframes/clear`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to clear keyframes.");
      }
      const data = await response.json();
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
      const response = await fetch(`/api/animations/${animationId}/clear`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to clear generation.");
      }
      const data = await response.json();
      updateAnimationState(data.animation);
      setMessage("Cleared generated output.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear generation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInterpolate = async () => {
    if (!animationId || !animation) return;
    const keyframeCount = animation.keyframes?.length ?? 0;
    if (keyframeCount < 2) {
      setError("Add at least two keyframes with images to interpolate.");
      return;
    }
    setIsInterpolating(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/animations/${animationId}/interpolate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: interpolationModel }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Interpolation failed.");
      }
      setMessage("Interpolation complete.");
      await loadAnimation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Interpolation failed.");
    } finally {
      setIsInterpolating(false);
    }
  };

  const applyAnimationPatch = useCallback(
    async (patch: Partial<Animation>, options?: { success?: string }) => {
      if (!animationId) return;
      setIsGenerationFrameSaving(true);
      setMessage(null);
      setError(null);
      try {
        const response = await fetch(`/api/animations/${animationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data?.error || "Failed to update animation.");
        }
        const data = await response.json();
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
      setIsGenerationFrameSaving(true);
      setMessage(null);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("kind", kind);
        formData.append("image", file, file.name);
        const response = await fetch(
          `/api/animations/${animationId}/generation-frames`,
          { method: "POST", body: formData }
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data?.error || "Failed to upload frame.");
        }
        const data = await response.json();
        updateAnimationState(data.animation);
        setMessage(`${kind === "start" ? "Start" : "End"} frame updated.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload frame.");
      } finally {
        setIsGenerationFrameSaving(false);
      }
    },
    [animationId, updateAnimationState]
  );

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

  const handleImportVideo = async () => {
    if (!animationId || !importFile) return;
    const ok = window.confirm(
      "Import this video? This will replace generated frames, spritesheet, and exports."
    );
    if (!ok) return;
    setIsImporting(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("video", importFile, importFile.name);
      if (importSkipRoi) {
        formData.append("skipRoi", "true");
      }

      const response = await fetch(`/api/animations/${animationId}/import-video`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Import failed.");
      }
      const data = await response.json();
      updateAnimationState(data.animation);
      setImportFile(null);
      setImportVideoMeta(null);
      setMessage("Video imported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFileSelect = useCallback((file: File | null) => {
    setImportFile(file);
    setImportVideoMeta(null);
    if (!file) return;

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setImportVideoMeta({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  }, []);

  const handleImportDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setImportDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "video/mp4") {
        handleImportFileSelect(file);
      }
    },
    [handleImportFileSelect]
  );

  const handleImportDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(true);
  }, []);

  const handleImportDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
  }, []);

  const formatVersionTimestamp = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const handleCreateVersion = async () => {
    if (!animationId) return;
    setIsVersionWorking(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/animations/${animationId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: versionName.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to create version.");
      }
      const data = await response.json();
      updateAnimationState(data.animation);
      setVersionName("");
      setMessage(`Version saved (${data.version?.name ?? "new version"}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create version.");
    } finally {
      setIsVersionWorking(false);
    }
  };

  const handleSaveVersion = async (versionId: string) => {
    if (!animationId) return;
    const ok = window.confirm("Overwrite this version with the current state?");
    if (!ok) return;
    setIsVersionWorking(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/animations/${animationId}/versions/${versionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to save version.");
      }
      const data = await response.json();
      updateAnimationState(data.animation);
      setMessage(`Version updated (${data.version?.name ?? "version"}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save version.");
    } finally {
      setIsVersionWorking(false);
    }
  };

  const handleLoadVersion = async (versionId: string) => {
    if (!animationId) return;
    const ok = window.confirm(
      "Load this version? Current keyframes and generated output will be replaced."
    );
    if (!ok) return;
    setIsVersionWorking(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/animations/${animationId}/versions/${versionId}/load`,
        { method: "POST" }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to load version.");
      }
      const data = await response.json();
      updateAnimationState(data.animation);
      setMessage("Version loaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load version.");
    } finally {
      setIsVersionWorking(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!animationId) return;
    const ok = window.confirm("Delete this version? This cannot be undone.");
    if (!ok) return;
    setIsVersionWorking(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/animations/${animationId}/versions/${versionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to delete version.");
      }
      const data = await response.json();
      updateAnimationState(data.animation);
      setMessage("Version deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete version.");
    } finally {
      setIsVersionWorking(false);
    }
  };

  const hasChanges = useMemo(() => {
    if (!animation || !savedAnimation) return false;
    return JSON.stringify(animation) !== JSON.stringify(savedAnimation);
  }, [animation, savedAnimation]);

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

  const expectedFrameCount = getExpectedFrameCount(
    Number(animation.generationSeconds ?? 4),
    Number(animation.extractFps ?? animation.fps ?? 6)
  );
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
    String(animation.generationModel ?? "sora-2")
  );
  const durationOptions = getVideoSecondsOptions(
    String(animation.generationModel ?? "sora-2")
  );
  const supportsStartEnd = getVideoModelSupportsStartEnd(
    String(animation.generationModel ?? "sora-2")
  );
  const supportsLoop = getVideoModelSupportsLoop(
    String(animation.generationModel ?? "sora-2")
  );
  const isToonCrafter =
    String(animation.generationModel ?? "sora-2") === "tooncrafter";
  const generationLoop = Boolean(animation.generationLoop);
  const tooncrafterInterpolate = animation.tooncrafterInterpolate === true;
  const tooncrafterColorCorrection =
    typeof animation.tooncrafterColorCorrection === "boolean"
      ? animation.tooncrafterColorCorrection
      : true;
  const tooncrafterSeed = animation.tooncrafterSeed ?? "";
  const promptProfile =
    animation.promptProfile ??
    getVideoModelPromptProfile(String(animation.generationModel ?? "sora-2"));
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
  const promptPreview = isPromptEditing
    ? promptProfile === "concise"
      ? draftPromptConcise
      : draftPromptVerbose
    : promptProfile === "concise"
    ? effectivePromptConcise
    : effectivePromptVerbose;

  const activeReference =
    character?.referenceImages?.find((img) => img.id === animation.referenceImageId) ??
    character?.referenceImages?.find((img) => img.isPrimary) ??
    character?.referenceImages?.[0] ??
    null;
  const generationInProgress = animation.status === "generating";
  const progressValue = animation.generationJob?.progress;
  const progressPercent =
    typeof progressValue === "number"
      ? Math.round(progressValue > 1 ? progressValue : progressValue * 100)
      : null;
  const canRebuild =
    (animation.generatedFrames?.length ?? 0) > 0 &&
    animation.status === "complete";
  const versions = animation.versions ?? [];
  const activeVersionId = animation.activeVersionId ?? null;
  


  return (
    <div className="min-h-screen grid-bg">
      <Header backHref="/animations" breadcrumb={`animations : ${animation.name}`}>
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
          disabled={!canRebuild || isRebuilding || generationInProgress}
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
          disabled={isGenerating || generationInProgress || !sizeValid}
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
                <span className="text-[10px] text-muted-foreground">
                  {animation.generationProvider === "openai" ? "OpenAI" : "Replicate"}
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

              {/* Frame Strip Gallery */}
              <FrameStrip
                animation={animation}
                currentFrame={currentFrame}
                onFrameChange={handleFrameChange}
              />

              <section className="grid lg:grid-cols-[1fr,380px] gap-6">
                {/* Left: Frame Preview & Spritesheet */}
                <div className="space-y-6">
                  <FramePreview
                    animation={animation}
                    currentFrame={currentFrame}
                    showComparison={true}
                  />

                  {animation.generatedSpritesheet && (
                    <div className="tech-border bg-card">
                      <button
                        onClick={() => {
                          const next = !spritesheetExpanded;
                          setSpritesheetExpanded(next);
                          localStorage.setItem("spritesheet-panel-expanded", String(next));
                        }}
                        className="w-full px-4 py-3 border-b border-border flex items-center justify-between hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-xs text-muted-foreground tracking-wider">GENERATED SPRITESHEET</span>
                        <span className="text-xs text-muted-foreground">
                          {spritesheetExpanded ? "−" : "+"}
                        </span>
                      </button>
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
                  />

                  {/* Import Video Panel */}
                  <div className="tech-border bg-card">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground tracking-wider">IMPORT VIDEO</span>
                      <div className="flex gap-2 text-[10px]">
                        <a
                          href="https://sora.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          sora
                        </a>
                        <span className="text-muted-foreground">·</span>
                        <a
                          href="https://aistudio.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          gemini
                        </a>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Drop zone */}
                      <div
                        className={cn(
                          "drop-zone p-4 cursor-pointer transition-all duration-150",
                          importDragOver && "drag-over",
                          isImporting && "opacity-50 pointer-events-none"
                        )}
                        onDrop={handleImportDrop}
                        onDragOver={handleImportDragOver}
                        onDragLeave={handleImportDragLeave}
                        onClick={() => document.getElementById("import-video-input")?.click()}
                      >
                        <input
                          id="import-video-input"
                          type="file"
                          accept="video/mp4"
                          className="hidden"
                          onChange={(e) => handleImportFileSelect(e.target.files?.[0] ?? null)}
                          disabled={isImporting}
                        />
                        <div className="text-center space-y-2">
                          <div className="w-10 h-10 mx-auto border border-border flex items-center justify-center">
                            <CloudUpload className="w-5 h-5 text-primary" strokeWidth={1.5} />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-foreground">Drop MP4 here</p>
                            <p className="text-[10px] text-muted-foreground">or click to browse</p>
                          </div>
                        </div>
                      </div>

                      {/* Video info after selection */}
                      {importFile && (
                        <div className="border border-border p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium truncate flex-1 mr-2">{importFile.name}</p>
                            <button
                              onClick={() => {
                                setImportFile(null);
                                setImportVideoMeta(null);
                              }}
                              className="text-[10px] text-muted-foreground hover:text-destructive"
                            >
                              CLEAR
                            </button>
                          </div>
                          {importVideoMeta && (
                            <div className="flex gap-3 text-[10px] text-muted-foreground">
                              <span>{importVideoMeta.duration.toFixed(1)}s</span>
                              <span>{importVideoMeta.width}×{importVideoMeta.height}</span>
                              <span>~{Math.ceil(importVideoMeta.duration * Number(animation.extractFps ?? animation.fps ?? 6))} frames</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Current settings display */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span>FPS: {animation.extractFps ?? animation.fps ?? 6}</span>
                        <span>Loop: {animation.loopMode ?? "pingpong"}</span>
                        <span>Size: {displayFrameWidth}×{displayFrameHeight}</span>
                      </div>

                      {/* Skip ROI option */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={importSkipRoi}
                          onChange={(e) => setImportSkipRoi(e.target.checked)}
                          className="w-3.5 h-3.5 accent-primary"
                        />
                        <span className="text-[10px] text-muted-foreground">
                          Use full frame (skip ROI crop)
                        </span>
                      </label>

                      {/* Import button */}
                      <Button
                        onClick={handleImportVideo}
                        disabled={!importFile || isImporting}
                        className="w-full h-9 bg-primary hover:bg-primary/80 text-primary-foreground text-[10px] tracking-wider"
                      >
                        {isImporting ? "IMPORTING..." : "IMPORT MP4"}
                      </Button>

                      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                        Generate with Sora or Gemini, download, and import here. Aspect ratio is
                        preserved; video is centered with transparent padding if needed.
                      </p>
                    </div>
                  </div>

                  {/* Version Manager */}
                  <div className="tech-border bg-card">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground tracking-wider">VERSIONS</span>
                      <span className="text-[10px] text-muted-foreground">{versions.length} SAVES</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={versionName}
                          onChange={(event) => setVersionName(event.target.value)}
                          placeholder="Version name (optional)"
                          className="terminal-input w-full h-9 px-3 text-sm bg-card"
                        />
                        <Button
                          onClick={handleCreateVersion}
                          disabled={isVersionWorking}
                          className="h-9 px-3 bg-primary hover:bg-primary/80 text-primary-foreground text-[10px] tracking-wider"
                        >
                          {isVersionWorking ? "SAVING" : "ADD"}
                        </Button>
                      </div>
                      {versions.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">
                          No versions saved yet. Creating a version snapshots keyframes and generated output.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {[...versions]
                            .sort((a, b) => {
                              const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
                              const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
                              return bTime - aTime;
                            })
                            .map((version) => {
                              const isActive = activeVersionId === version.id;
                              const label = version.updatedAt
                                ? `Updated ${formatVersionTimestamp(version.updatedAt)}`
                                : `Created ${formatVersionTimestamp(version.createdAt)}`;
                              return (
                                <div
                                  key={version.id}
                                  className={`border p-3 flex items-center justify-between gap-3 ${
                                    isActive ? "border-primary/70 bg-primary/5" : "border-border"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">{version.name}</span>
                                      {isActive && (
                                        <span className="text-[9px] px-1.5 py-0.5 border border-primary text-primary">
                                          ACTIVE
                                        </span>
                                      )}
                                      {version.source === "generation" && (
                                        <span className="text-[9px] px-1.5 py-0.5 border border-border text-muted-foreground">
                                          AUTO
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{label}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleLoadVersion(version.id)}
                                      className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                                      disabled={isVersionWorking}
                                    >
                                      LOAD
                                    </button>
                                    <button
                                      onClick={() => handleSaveVersion(version.id)}
                                      className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                                      disabled={isVersionWorking}
                                    >
                                      SAVE
                                    </button>
                                    <button
                                      onClick={() => handleDeleteVersion(version.id)}
                                      className="px-2 py-1 text-[10px] border border-destructive/60 text-destructive hover:border-destructive"
                                      disabled={isVersionWorking}
                                    >
                                      DEL
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Export Panel */}
                  <ExportPanel animation={animation} onExport={handleExport} isExporting={isExporting} />
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
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Video Model</p>
                <select
                  value={animation.generationModel ?? "sora-2"}
                  onChange={(event) => {
                    const nextModel = event.target.value;
                    const currentSize = String(animation.generationSize ?? "1024x1792");
                    const nextSize = isSizeValidForModel(currentSize, nextModel)
                      ? currentSize
                      : coerceVideoSizeForModel(currentSize, nextModel);
                    const currentSeconds = Number(animation.generationSeconds ?? 4);
                    const nextSeconds = coerceVideoSecondsForModel(currentSeconds, nextModel);
                    const fpsValue = Number(animation.extractFps ?? animation.fps ?? 6);
                    const frameCount = getExpectedFrameCount(nextSeconds, fpsValue);
                    const nextPromptProfile =
                      animation.promptProfile ?? getVideoModelPromptProfile(nextModel);
                    setAnimation({
                      ...animation,
                      generationProvider: getVideoProviderForModel(nextModel),
                      generationModel: nextModel,
                      generationSize: nextSize,
                      generationSeconds: nextSeconds,
                      promptProfile: nextPromptProfile,
                      frameCount,
                    });
                  }}
                  className="terminal-input w-full h-9 px-3 text-sm bg-card"
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {isToonCrafter && (
                  <p className="text-[10px] text-muted-foreground">
                    Uses 2-10 keyframes to generate a full video, then extracts sprite frames.
                    If you provide more than 10, we sample evenly. "Native" size uses your
                    keyframe dimensions.
                  </p>
                )}
              </div>

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
                        const fpsValue = Number(animation.extractFps ?? animation.fps ?? 6);
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
                </div>
              )}

              {!isToonCrafter && (
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
                        {animation.generationStartImageUrl ? (
                          <img
                            src={animation.generationStartImageUrl}
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
                        {generationLoop ? (
                          <p className="text-[10px] text-muted-foreground">
                            Using start frame.
                          </p>
                        ) : animation.generationEndImageUrl ? (
                          <img
                            src={animation.generationEndImageUrl}
                            alt="End frame"
                            className="w-full h-24 object-contain border border-border bg-muted/20"
                          />
                        ) : (
                          <p className="text-[10px] text-muted-foreground">
                            Optional end frame for interpolation.
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          {activeReference && !generationLoop && (
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
                          {animation.generationEndImageUrl && !generationLoop && (
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
                          disabled={isGenerationFrameSaving || generationLoop}
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
                        Number(animation.extractFps ?? animation.fps ?? 6) === value
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
                  {Math.round(1000 / Number(animation.extractFps ?? animation.fps ?? 6))}ms
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
                      {mode === "pingpong" ? "Ping-pong (safe loop)" : "Loop (start/end match)"}
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
                      Video generation uses a single reference image. Choose which ref to send.
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
                onSizeChange={(size) =>
                  setAnimation({ ...animation, generationSize: size })
                }
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
                  Base frames come from {animation.generationSeconds ?? 4}s × {animation.extractFps ?? animation.fps ?? 6}fps. Ping-pong output: {loopedFrameCount} frames.
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
            </div>
          </section>
          )}
        </div>
      </main>
    </div>
  );
}
