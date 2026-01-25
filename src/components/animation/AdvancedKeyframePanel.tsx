"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Animation, Character } from "@/types";

const RD_FAST_STYLES = [
  "game_asset",
  "default",
  "simple",
  "detailed",
  "retro",
  "portrait",
  "texture",
  "ui",
  "item_sheet",
  "character_turnaround",
  "1_bit",
  "low_res",
  "mc_item",
  "mc_texture",
  "no_style",
];

const RD_PLUS_STYLES = [
  "default",
  "retro",
  "watercolor",
  "textured",
  "cartoon",
  "ui_element",
  "item_sheet",
  "character_turnaround",
  "environment",
  "isometric",
  "isometric_asset",
  "topdown_map",
  "topdown_asset",
  "classic",
  "topdown_item",
  "low_res",
  "mc_item",
  "mc_texture",
  "skill_icon",
];

export interface KeyframeFormData {
  frameIndex: number;
  model: "rd-fast" | "rd-plus";
  prompt: string;
  style: string;
  strength: number;
  removeBg: boolean;
  file: File | null;
  // Advanced options
  inputPalette: string;
  tileX: boolean;
  tileY: boolean;
  seed: string;
  bypassPromptExpansion: boolean;
}

interface AdvancedKeyframePanelProps {
  animation: Animation;
  character?: Character | null;
  currentFrame: number;
  onFrameChange: (frame: number) => void;
  onKeyframeAction: (mode: "upload" | "generate" | "refine", data: KeyframeFormData) => Promise<void>;
  onClearKeyframe?: (frameIndex: number) => Promise<void>;
  onReferenceSelect?: (referenceImageId: string | null) => void;
  isWorking: boolean;
}

export function AdvancedKeyframePanel({
  animation,
  character,
  currentFrame,
  onFrameChange,
  onKeyframeAction,
  onClearKeyframe,
  onReferenceSelect,
  isWorking,
}: AdvancedKeyframePanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isFetchingRef, setIsFetchingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get existing keyframe data if present
  const existingKeyframe = animation.keyframes?.find((kf) => kf.frameIndex === currentFrame);

  const [formData, setFormData] = useState<KeyframeFormData>({
    frameIndex: currentFrame,
    model: existingKeyframe?.model ?? "rd-fast",
    prompt: existingKeyframe?.prompt ?? "",
    style: "game_asset",
    strength: existingKeyframe?.strength ?? 0.7,
    removeBg: existingKeyframe?.removeBg ?? false,
    file: null,
    // Advanced
    inputPalette: existingKeyframe?.inputPalette ?? "",
    tileX: existingKeyframe?.tileX ?? false,
    tileY: existingKeyframe?.tileY ?? false,
    seed: existingKeyframe?.seed?.toString() ?? "",
    bypassPromptExpansion: existingKeyframe?.bypassPromptExpansion ?? false,
  });

  const styleOptions = formData.model === "rd-plus" ? RD_PLUS_STYLES : RD_FAST_STYLES;

  const handleAction = async (mode: "upload" | "generate" | "refine") => {
    await onKeyframeAction(mode, { ...formData, frameIndex: currentFrame });
  };

  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleFile = (file: File | null) => {
    setFormData((prev) => ({ ...prev, file }));
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    if (file) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleReferenceSelect = async (
    ref?: Character["referenceImages"][number],
    options?: { autoGenerate?: boolean; updateSelection?: boolean }
  ) => {
    if (!ref?.url) return;
    if (onReferenceSelect && options?.updateSelection !== false) {
      onReferenceSelect(ref.id);
    }
    setIsFetchingRef(true);
    try {
      const response = await fetch(ref.url);
      if (!response.ok) {
        throw new Error("Failed to load reference.");
      }
      const blob = await response.blob();
      const filename = ref.filename ?? `reference_${ref.id}.png`;
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      handleFile(file);
      if (options?.autoGenerate) {
        await onKeyframeAction("generate", {
          ...formData,
          file,
          frameIndex: currentFrame,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingRef(false);
    }
  };

  const selectedReference =
    character?.referenceImages?.find((img) => img.id === animation.referenceImageId) ??
    character?.referenceImages?.find((img) => img.isPrimary) ??
    character?.referenceImages?.[0];

  const handlePaletteUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData((prev) => ({ ...prev, inputPalette: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">Keyframe Controls</span>
        <div className="flex items-center gap-2">
          {existingKeyframe && (
            <span className="text-[10px] text-success">Has Keyframe</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Frame selection row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground tracking-widest">
              Frame Index
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={Math.max(0, (animation.actualFrameCount ?? animation.frameCount) - 1)}
                value={currentFrame}
                onChange={(e) => onFrameChange(Number(e.target.value))}
                className="terminal-input flex-1 h-9 px-3 text-sm bg-card"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFrameChange((currentFrame - 1 + (animation.actualFrameCount ?? animation.frameCount)) % (animation.actualFrameCount ?? animation.frameCount))}
                className="h-9 px-2 text-[10px] border-border hover:border-primary"
              >
                -
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFrameChange((currentFrame + 1) % (animation.actualFrameCount ?? animation.frameCount))}
                className="h-9 px-2 text-[10px] border-border hover:border-primary"
              >
                +
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground tracking-widest">
              Model
            </label>
            <select
              value={formData.model}
              onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value as "rd-fast" | "rd-plus" }))}
              className="terminal-input w-full h-9 px-3 text-sm bg-card"
            >
              <option value="rd-fast">rd-fast (faster)</option>
              <option value="rd-plus">rd-plus (higher quality)</option>
            </select>
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground tracking-widest">
            Prompt Override
          </label>
          <input
            value={formData.prompt}
            onChange={(e) => setFormData((prev) => ({ ...prev, prompt: e.target.value }))}
            placeholder="Optional prompt for this keyframe..."
            className="terminal-input w-full h-9 px-3 text-sm bg-card"
          />
        </div>

        {/* Style and Strength row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground tracking-widest">
              Style Tag
            </label>
            <select
              value={formData.style}
              onChange={(e) => setFormData((prev) => ({ ...prev, style: e.target.value }))}
              className="terminal-input w-full h-9 px-3 text-sm bg-card"
            >
              {styleOptions.map((style) => (
                <option key={style} value={style}>
                  {style.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground tracking-widest">
              Strength ({formData.strength.toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={formData.strength}
              onChange={(e) => setFormData((prev) => ({ ...prev, strength: Number(e.target.value) }))}
              className="w-full h-9"
            />
          </div>
        </div>

        {/* Image upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground tracking-widest">
              Upload Image (for upload or refine)
            </label>
            {formData.file && (
              <button
                type="button"
                className="text-[10px] text-destructive hover:underline"
                onClick={() => handleFile(null)}
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick reference shortcuts */}
          {character?.referenceImages?.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Use character reference</span>
                {selectedReference && (
                  <button
                    type="button"
                    onClick={() => handleReferenceSelect(selectedReference, { updateSelection: false })}
                    disabled={isFetchingRef}
                    className="text-primary hover:underline disabled:opacity-50"
                  >
                    Use animation reference
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {character.referenceImages.map((ref) => {
                  const isSelected = selectedReference?.id === ref.id;
                  return (
                    <button
                      key={ref.id}
                      type="button"
                      onClick={() => handleReferenceSelect(ref)}
                      disabled={isFetchingRef}
                      className={`border p-1 transition-colors ${isSelected ? "border-primary" : "border-border hover:border-primary/50"}`}
                      title={`Use ${ref.type} reference`}
                    >
                      <div className="relative">
                        <img
                          src={ref.url}
                          alt={`${ref.type} reference`}
                          className="w-12 h-12 object-cover"
                        />
                        {isSelected && (
                          <span className="absolute top-0 left-0 bg-primary text-primary-foreground text-[7px] px-1">
                            ACTIVE REF
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>One-click action</span>
                <button
                  type="button"
                  onClick={() =>
                    handleReferenceSelect(selectedReference, {
                      autoGenerate: true,
                      updateSelection: false,
                    })
                  }
                  disabled={isFetchingRef || isWorking || !selectedReference}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  Use active ref + Generate
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              No character references available for shortcuts.
            </p>
          )}

          {/* Drag/drop upload */}
          <div
            className={`border border-dashed p-3 transition-colors ${
              isDragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0] ?? null;
              if (file && file.type.startsWith("image/")) {
                handleFile(file);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            {formData.file ? (
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 border border-border bg-card overflow-hidden flex items-center justify-center">
                  {filePreviewUrl ? (
                    <img
                      src={filePreviewUrl}
                      alt="Upload preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Preview</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  <div className="text-foreground">{formData.file.name}</div>
                  <div>{Math.round(formData.file.size / 1024)} KB</div>
                  <div>Click to replace</div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">
                Drag and drop an image here, or click to browse
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Generate uses prompt-only unless an image is loaded.
          </p>
        </div>

        {/* Remove BG toggle */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={formData.removeBg}
            onChange={(e) => setFormData((prev) => ({ ...prev, removeBg: e.target.checked }))}
            className="form-checkbox"
          />
          Remove background
        </label>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-primary hover:underline uppercase tracking-widest"
        >
          {showAdvanced ? "- HIDE ADVANCED" : "+ SHOW ADVANCED"}
        </button>

        {/* Advanced options */}
        {showAdvanced && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="text-[10px] text-muted-foreground tracking-wider">
              Advanced Options (rd-fast / rd-plus)
            </div>

            {/* Palette upload */}
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground tracking-widest">
                Input Palette (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePaletteUpload}
                className="text-xs text-muted-foreground"
              />
              {formData.inputPalette && (
                <div className="flex items-center gap-2">
                  <img
                    src={formData.inputPalette}
                    alt="Palette"
                    className="w-16 h-4 object-cover border border-border"
                  />
                  <button
                    onClick={() => setFormData((prev) => ({ ...prev, inputPalette: "" }))}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    CLEAR
                  </button>
                </div>
              )}
            </div>

            {/* Tile options */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.tileX}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tileX: e.target.checked }))}
                  className="form-checkbox"
                />
                Tile X (seamless horizontal)
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.tileY}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tileY: e.target.checked }))}
                  className="form-checkbox"
                />
                Tile Y (seamless vertical)
              </label>
            </div>

            {/* Seed */}
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground tracking-widest">
                Seed (optional, for reproducibility)
              </label>
              <input
                type="number"
                value={formData.seed}
                onChange={(e) => setFormData((prev) => ({ ...prev, seed: e.target.value }))}
                placeholder="Random if empty"
                className="terminal-input w-full h-9 px-3 text-sm bg-card"
              />
            </div>

            {/* Bypass prompt expansion */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={formData.bypassPromptExpansion}
                onChange={(e) => setFormData((prev) => ({ ...prev, bypassPromptExpansion: e.target.checked }))}
                className="form-checkbox"
              />
              Bypass prompt expansion (use prompt as-is)
            </label>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => handleAction("upload")}
            disabled={isWorking || !formData.file}
            className="h-8 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
          >
            {isWorking ? "WORKING" : "UPLOAD"}
          </Button>
          <Button
            onClick={() => handleAction("generate")}
            disabled={isWorking}
            className="bg-primary hover:bg-primary/80 text-primary-foreground h-8 px-3 text-[10px] tracking-wider"
          >
            GENERATE
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction("refine")}
            disabled={isWorking || (!formData.file && !existingKeyframe?.image)}
            className="h-8 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
          >
            REFINE
          </Button>
          <Button
            variant="outline"
            onClick={() => onClearKeyframe?.(currentFrame)}
            disabled={isWorking || !existingKeyframe}
            className="h-8 px-3 text-[10px] tracking-wider border-destructive/60 text-destructive hover:border-destructive"
          >
            CLEAR
          </Button>
        </div>
      </div>
    </div>
  );
}
