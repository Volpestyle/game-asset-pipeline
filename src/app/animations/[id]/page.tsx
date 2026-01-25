"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import {
  TimelineEditor,
  FramePreview,
  FrameStrip,
  AdvancedKeyframePanel,
  ExportPanel,
  ModelConstraints,
  VIDEO_SECONDS_OPTIONS,
  EXTRACT_FPS_OPTIONS,
  coerceVideoSizeForModel,
  getExpectedFrameCount,
  isSizeValidForModel,
} from "@/components/animation";
import type { KeyframeFormData } from "@/components/animation";
import type { Animation, AnimationStyle, Character } from "@/types";

const STYLE_OPTIONS: { value: AnimationStyle; label: string; code: string }[] = [
  { value: "idle", label: "Idle", code: "IDL" },
  { value: "walk", label: "Walk", code: "WLK" },
  { value: "run", label: "Run", code: "RUN" },
  { value: "attack", label: "Attack", code: "ATK" },
  { value: "jump", label: "Jump", code: "JMP" },
  { value: "custom", label: "Custom", code: "CST" },
];

export default function AnimationDetailPage() {
  const params = useParams();
  const animationId = String(params.id ?? "");

  const [animation, setAnimation] = useState<Animation | null>(null);
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
  const [interpolationModel, setInterpolationModel] = useState<"rd-fast" | "rd-plus">("rd-plus");
  const [isRefSaving, setIsRefSaving] = useState(false);

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
      setAnimation(nextAnimation);

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
  }, [animationId]);

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
      setAnimation(data.animation);
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
    if (!sizeValid) {
      adjustedSize = coerceVideoSizeForModel(currentSize, currentModel);
      setAnimation({ ...animation, generationSize: adjustedSize });
    }

    setIsGenerating(true);
    setMessage(null);
    setError(null);
    try {
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
      setAnimation(data.animation ?? animation);
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
      setAnimation(data.animation);
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
        setAnimation(respData.animation);
        setMessage(`Keyframe updated at frame ${data.frameIndex}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Keyframe update failed.");
      } finally {
        setIsKeyframeWorking(false);
      }
    },
    [animationId]
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
        setAnimation(data.animation);
        setMessage(`Keyframe cleared at frame ${frameIndex}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear keyframe.");
      }
    },
    [animationId]
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

  const handleExport = async () => {
    if (!animationId) return;
    setIsExporting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animationId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Export failed.");
      }
      setMessage("Export ready.");
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
        await response.json().catch(() => null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save reference selection."
        );
      } finally {
        setIsRefSaving(false);
      }
    },
    [animationId]
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
      setAnimation(data.animation);
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
      setAnimation(data.animation);
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
  const generationInProgress = animation.status === "generating";
  const progressValue = animation.generationJob?.progress;
  const progressPercent =
    typeof progressValue === "number"
      ? Math.round(progressValue > 1 ? progressValue : progressValue * 100)
      : null;
  const canRebuild =
    (animation.generatedFrames?.length ?? 0) > 0 &&
    animation.status === "complete";

  return (
    <div className="min-h-screen grid-bg">
      <Header backHref="/animations" breadcrumb={`animations : ${animation.name}`}>
        <Button
          onClick={handleSave}
          disabled={isSaving}
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
                  {animation.name} <span className="text-primary">Control</span>
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
                    <div className="tech-border bg-card p-4 space-y-3">
                      <p className="text-xs text-muted-foreground tracking-widest">Generated Spritesheet</p>
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

                  {/* Interpolation Panel */}
                  <div className="tech-border bg-card">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground tracking-wider">INTERPOLATION</span>
                      <span className="text-[10px] text-muted-foreground">
                        {(animation.keyframes?.length ?? 0)} KEYFRAMES
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="space-y-2">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          Model
                        </label>
                        <select
                          value={interpolationModel}
                          onChange={(e) => setInterpolationModel(e.target.value as "rd-fast" | "rd-plus")}
                          className="terminal-input w-full h-9 px-3 text-sm bg-card"
                        >
                          <option value="rd-plus">rd-plus (higher quality)</option>
                          <option value="rd-fast">rd-fast (faster)</option>
                        </select>
                      </div>
                      <Button
                        onClick={handleInterpolate}
                        disabled={isInterpolating || (animation.keyframes?.length ?? 0) < 2}
                        className="w-full h-9 bg-primary hover:bg-primary/80 text-primary-foreground text-[10px] tracking-wider"
                      >
                        {isInterpolating ? "INTERPOLATING..." : "INTERPOLATE KEYFRAME GAPS"}
                      </Button>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Fills frames between adjacent keyframes using img2img. Existing in-between frames will be replaced.
                      </p>
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
                <p className="text-xs text-muted-foreground tracking-widest">Video Model</p>
                <select
                  value={animation.generationModel ?? "sora-2"}
                  onChange={(event) => {
                    const nextModel = event.target.value;
                    const currentSize = String(animation.generationSize ?? "1024x1792");
                    const nextSize = isSizeValidForModel(currentSize, nextModel)
                      ? currentSize
                      : coerceVideoSizeForModel(currentSize, nextModel);
                    setAnimation({
                      ...animation,
                      generationModel: nextModel,
                      generationSize: nextSize,
                    });
                  }}
                  className="terminal-input w-full h-9 px-3 text-sm bg-card"
                >
                  <option value="sora-2">sora-2 (draft)</option>
                  <option value="sora-2-pro">sora-2-pro (final)</option>
                </select>
              </div>

              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">Clip Duration</p>
                <div className="flex flex-wrap gap-2">
                  {VIDEO_SECONDS_OPTIONS.map((value) => (
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
                          className="w-16 h-16 object-cover border border-border"
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
                              className="w-full aspect-square object-cover"
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
