"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "iconoir-react";
import {
  getVideoSecondsOptions,
  getVideoSizeOptions,
} from "@/lib/ai/soraConstraints";
import { clampWanFrames, WAN_DEFAULT_FPS } from "@/lib/ai/wan";
import { logger } from "@/lib/logger";
import type { WanParameters } from "@/types/studio";

type WanFormProps = {
  modelId: string;
  onSubmit: (parameters: WanParameters) => void;
  isLoading: boolean;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image file."));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read image file."));
    };
    reader.readAsDataURL(file);
  });
}

export function WanForm({ modelId, onSubmit, isLoading }: WanFormProps) {
  const sizeOptions = getVideoSizeOptions(modelId);
  const secondsOptions = getVideoSecondsOptions(modelId);

  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(sizeOptions[0] ?? "1280x720");
  const [seconds, setSeconds] = useState(secondsOptions[0] ?? 4);
  const [startImage, setStartImage] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [startImageError, setStartImageError] = useState<string | null>(null);
  const [endImageError, setEndImageError] = useState<string | null>(null);
  const [framesPerSecond, setFramesPerSecond] = useState(WAN_DEFAULT_FPS);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState<number | "">("");
  const [numInferenceSteps, setNumInferenceSteps] = useState<number | "">("");
  const [enableSafetyChecker, setEnableSafetyChecker] = useState(false);
  const [enableOutputSafetyChecker, setEnableOutputSafetyChecker] = useState(false);
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(false);
  const [acceleration, setAcceleration] = useState<"none" | "regular">("regular");
  const [guidanceScale, setGuidanceScale] = useState<number | "">(3.5);
  const [guidanceScale2, setGuidanceScale2] = useState<number | "">(3.5);
  const [shift, setShift] = useState<number | "">(5);
  const [interpolatorModel, setInterpolatorModel] = useState<"none" | "film" | "rife">("film");
  const [numInterpolatedFrames, setNumInterpolatedFrames] = useState<number | "">(1);
  const [adjustFpsForInterpolation, setAdjustFpsForInterpolation] = useState(true);
  const [videoQuality, setVideoQuality] = useState<"low" | "medium" | "high" | "maximum">("high");
  const [videoWriteMode, setVideoWriteMode] = useState<"fast" | "balanced" | "small">("balanced");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const startImageRef = useRef<HTMLInputElement>(null);
  const endImageRef = useRef<HTMLInputElement>(null);

  const handleStartImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        const message = "Unsupported file type. Please upload an image.";
        logger.warn("Wan start image rejected", {
          fileName: file.name,
          fileType: file.type,
        });
        setStartImageError(message);
        if (startImageRef.current) {
          startImageRef.current.value = "";
        }
        return;
      }
      setStartImageError(null);
      try {
        const base64 = await fileToBase64(file);
        setStartImage(base64);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to read start image.";
        logger.error("Wan start image upload failed", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          error: message,
        });
        setStartImageError("Failed to read start image.");
      } finally {
        if (startImageRef.current) {
          startImageRef.current.value = "";
        }
      }
    },
    [startImageRef]
  );

  const handleEndImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        const message = "Unsupported file type. Please upload an image.";
        logger.warn("Wan end image rejected", {
          fileName: file.name,
          fileType: file.type,
        });
        setEndImageError(message);
        if (endImageRef.current) {
          endImageRef.current.value = "";
        }
        return;
      }
      setEndImageError(null);
      try {
        const base64 = await fileToBase64(file);
        setEndImage(base64);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to read end image.";
        logger.error("Wan end image upload failed", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          error: message,
        });
        setEndImageError("Failed to read end image.");
      } finally {
        if (endImageRef.current) {
          endImageRef.current.value = "";
        }
      }
    },
    [endImageRef]
  );

  const promptValue = prompt.trim();
  const hasStartImage = Boolean(startImage);
  const canSubmit = Boolean(promptValue) && hasStartImage;

  const desiredFrames = Math.round(seconds * framesPerSecond);
  const frameClamp = clampWanFrames(desiredFrames);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!promptValue || !startImage) return;

      const parameters: WanParameters = {
        prompt: promptValue,
        size,
        seconds,
        startImage,
        framesPerSecond,
        acceleration,
        enableSafetyChecker,
        enableOutputSafetyChecker,
        enablePromptExpansion,
        interpolatorModel,
        adjustFpsForInterpolation,
        videoQuality,
        videoWriteMode,
      };

      if (endImage) parameters.endImage = endImage;
      if (negativePrompt.trim()) parameters.negativePrompt = negativePrompt.trim();
      if (typeof seed === "number") parameters.seed = seed;
      if (typeof numInferenceSteps === "number") {
        parameters.numInferenceSteps = numInferenceSteps;
      }
      if (typeof guidanceScale === "number") parameters.guidanceScale = guidanceScale;
      if (typeof guidanceScale2 === "number") parameters.guidanceScale2 = guidanceScale2;
      if (typeof shift === "number") parameters.shift = shift;
      if (typeof numInterpolatedFrames === "number") {
        parameters.numInterpolatedFrames = numInterpolatedFrames;
      }

      onSubmit(parameters);
    },
    [
      promptValue,
      size,
      seconds,
      startImage,
      endImage,
      framesPerSecond,
      negativePrompt,
      seed,
      numInferenceSteps,
      enableSafetyChecker,
      enableOutputSafetyChecker,
      enablePromptExpansion,
      acceleration,
      guidanceScale,
      guidanceScale2,
      shift,
      interpolatorModel,
      numInterpolatedFrames,
      adjustFpsForInterpolation,
      videoQuality,
      videoWriteMode,
      onSubmit,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to generate..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Size
          </label>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {sizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Duration
          </label>
          <select
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {secondsOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}s
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Start Image (required)
          </label>
          <input
            ref={startImageRef}
            type="file"
            accept="image/*"
            onChange={handleStartImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => startImageRef.current?.click()}
            className={`w-full px-3 py-2 text-xs border border-border rounded flex items-center justify-center gap-2 transition-colors ${
              startImage
                ? "bg-primary/10 border-primary text-primary"
                : "bg-background hover:bg-secondary"
            }`}
          >
            <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
            {startImage ? "Change" : "Upload"}
          </button>
          {startImage && (
            <div className="mt-2 space-y-1">
              <img
                src={startImage}
                alt="Start preview"
                className="w-full h-24 object-contain border border-border bg-muted/20 rounded"
              />
              <button
                type="button"
                onClick={() => {
                  setStartImage(null);
                  setStartImageError(null);
                  if (startImageRef.current) {
                    startImageRef.current.value = "";
                  }
                }}
                className="text-[10px] text-destructive hover:underline"
              >
                Clear
              </button>
            </div>
          )}
          {startImageError && (
            <p className="text-[10px] text-destructive mt-1">
              {startImageError}
            </p>
          )}
          {!hasStartImage && (
            <p className="text-[10px] text-destructive mt-1">
              Start image required for Wan 2.2.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            End Image (optional)
          </label>
          <input
            ref={endImageRef}
            type="file"
            accept="image/*"
            onChange={handleEndImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => endImageRef.current?.click()}
            className={`w-full px-3 py-2 text-xs border border-border rounded flex items-center justify-center gap-2 transition-colors ${
              endImage
                ? "bg-primary/10 border-primary text-primary"
                : "bg-background hover:bg-secondary"
            }`}
          >
            <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
            {endImage ? "Change" : "Upload"}
          </button>
          {endImage && (
            <div className="mt-2 space-y-1">
              <img
                src={endImage}
                alt="End preview"
                className="w-full h-24 object-contain border border-border bg-muted/20 rounded"
              />
              <button
                type="button"
                onClick={() => {
                  setEndImage(null);
                  setEndImageError(null);
                  if (endImageRef.current) {
                    endImageRef.current.value = "";
                  }
                }}
                className="text-[10px] text-destructive hover:underline"
              >
                Clear
              </button>
            </div>
          )}
          {endImageError && (
            <p className="text-[10px] text-destructive mt-1">
              {endImageError}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Frames per second
          </label>
          <input
            type="number"
            min={4}
            max={60}
            value={framesPerSecond}
            onChange={(e) => setFramesPerSecond(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="text-[10px] text-muted-foreground flex items-end">
          {frameClamp.clamped
            ? `Frames clamped to ${frameClamp.frames} (requested ${desiredFrames}).`
            : `Frames: ${desiredFrames}`}
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Negative Prompt (optional)
        </label>
        <input
          type="text"
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="Things to avoid..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Seed (optional)
        </label>
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : "")}
          placeholder="Random"
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((prev) => !prev)}
        className="text-[10px] text-primary hover:underline uppercase tracking-widest"
      >
        {showAdvanced ? "- Hide Advanced" : "+ Show Advanced"}
      </button>

      {showAdvanced && (
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
                value={numInferenceSteps}
                onChange={(e) =>
                  setNumInferenceSteps(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="Default 27"
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Acceleration
              </label>
              <select
                value={acceleration}
                onChange={(e) =>
                  setAcceleration(e.target.value === "none" ? "none" : "regular")
                }
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
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
                value={guidanceScale}
                onChange={(e) =>
                  setGuidanceScale(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
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
                value={guidanceScale2}
                onChange={(e) =>
                  setGuidanceScale2(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
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
                value={shift}
                onChange={(e) => setShift(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Interpolator Model
              </label>
              <select
                value={interpolatorModel}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "none" || value === "rife") {
                    setInterpolatorModel(value);
                  } else {
                    setInterpolatorModel("film");
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
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
                value={numInterpolatedFrames}
                onChange={(e) =>
                  setNumInterpolatedFrames(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2 text-xs mt-6">
              <input
                type="checkbox"
                checked={adjustFpsForInterpolation}
                onChange={(e) => setAdjustFpsForInterpolation(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Adjust FPS for interpolation
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={enableSafetyChecker}
                onChange={(e) => setEnableSafetyChecker(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Enable Safety Checker
            </div>
            <div className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={enableOutputSafetyChecker}
                onChange={(e) => setEnableOutputSafetyChecker(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Enable Output Safety Checker
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={enablePromptExpansion}
              onChange={(e) => setEnablePromptExpansion(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Enable Prompt Expansion
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Video Quality
              </label>
              <select
                value={videoQuality}
                onChange={(e) => {
                  const value = e.target.value;
                  if (
                    value === "low" ||
                    value === "medium" ||
                    value === "high" ||
                    value === "maximum"
                  ) {
                    setVideoQuality(value);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
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
                value={videoWriteMode}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "fast" || value === "balanced" || value === "small") {
                    setVideoWriteMode(value);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="fast">fast</option>
                <option value="balanced">balanced</option>
                <option value="small">small</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !canSubmit}
        className="w-full px-4 py-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "GENERATING..." : "GENERATE VIDEO"}
      </button>
    </form>
  );
}
