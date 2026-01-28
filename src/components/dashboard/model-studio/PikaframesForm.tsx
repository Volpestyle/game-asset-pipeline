"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Xmark } from "iconoir-react";
import {
  getVideoSecondsOptions,
  getVideoSizeOptions,
} from "@/lib/ai/soraConstraints";
import {
  buildModelStudioKey,
  readStoredNumber,
  readStoredString,
  writeStoredNumber,
  writeStoredString,
} from "@/lib/modelStudioStorage";
import type { PikaframesParameters } from "@/types/studio";

type PikaframesFormProps = {
  modelId: string;
  onSubmit: (parameters: PikaframesParameters) => void;
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
      reject(new Error("Failed to read keyframe image."));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read keyframe image."));
    };
    reader.readAsDataURL(file);
  });
}

export function PikaframesForm({
  modelId,
  onSubmit,
  isLoading,
}: PikaframesFormProps) {
  const sizeOptions = getVideoSizeOptions(modelId);
  const secondsOptions = getVideoSecondsOptions(modelId);

  const storageScope = "pikaframes";
  const promptKey = buildModelStudioKey(storageScope, modelId, "prompt");
  const negativeKey = buildModelStudioKey(storageScope, modelId, "negativePrompt");
  const seedKey = buildModelStudioKey(storageScope, modelId, "seed");
  const sizeKey = buildModelStudioKey(storageScope, modelId, "size");
  const secondsKey = buildModelStudioKey(storageScope, modelId, "seconds");

  const defaultSize = sizeOptions[0] ?? "1280x720";
  const defaultSeconds = secondsOptions[0] ?? 4;

  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState<number | "">("");
  const [size, setSize] = useState(defaultSize);
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [keyframes, setKeyframes] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const errors: string[] = [];

    const promptResult = readStoredString(promptKey);
    if (promptResult.error) errors.push(promptResult.error);

    const negativeResult = readStoredString(negativeKey);
    if (negativeResult.error) errors.push(negativeResult.error);

    const seedResult = readStoredNumber(seedKey);
    if (seedResult.error) errors.push(seedResult.error);

    const sizeResult = readStoredString(sizeKey);
    if (sizeResult.error) errors.push(sizeResult.error);

    const secondsResult = readStoredNumber(secondsKey);
    if (secondsResult.error) errors.push(secondsResult.error);

    const resolvedSize =
      sizeResult.value && sizeOptions.includes(sizeResult.value)
        ? sizeResult.value
        : defaultSize;

    const resolvedSeconds =
      typeof secondsResult.value === "number" &&
      secondsOptions.includes(secondsResult.value)
        ? secondsResult.value
        : defaultSeconds;

    setPrompt(promptResult.value ?? "");
    setNegativePrompt(negativeResult.value ?? "");
    setSeed(typeof seedResult.value === "number" ? seedResult.value : "");
    setSize(resolvedSize);
    setSeconds(resolvedSeconds);
    setStorageError(errors[0] ?? null);
    setStorageLoaded(true);
  }, [
    promptKey,
    negativeKey,
    seedKey,
    sizeKey,
    secondsKey,
    sizeOptions,
    secondsOptions,
    defaultSize,
    defaultSeconds,
  ]);

  useEffect(() => {
    if (!storageLoaded) return;
    const errors = [
      writeStoredString(promptKey, prompt),
      writeStoredString(negativeKey, negativePrompt),
      writeStoredNumber(seedKey, typeof seed === "number" ? seed : null),
      writeStoredString(sizeKey, size),
      writeStoredNumber(secondsKey, seconds),
    ].filter((value): value is string => typeof value === "string");

    setStorageError(errors[0] ?? null);
  }, [
    prompt,
    negativePrompt,
    seed,
    size,
    seconds,
    promptKey,
    negativeKey,
    seedKey,
    sizeKey,
    secondsKey,
    storageLoaded,
  ]);

  const handleKeyframeUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const nextFrames: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        if (keyframes.length + nextFrames.length >= 5) break;
        const base64 = await fileToBase64(files[i]);
        nextFrames.push(base64);
      }

      setKeyframes((prev) => [...prev, ...nextFrames].slice(0, 5));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [keyframes.length]
  );

  const removeKeyframe = useCallback((index: number) => {
    setKeyframes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (keyframes.length < 2) return;

      const parameters: PikaframesParameters = {
        keyframes,
        size,
        seconds,
      };

      const trimmedPrompt = prompt.trim();
      if (trimmedPrompt) {
        parameters.prompt = trimmedPrompt;
      }

      const trimmedNegative = negativePrompt.trim();
      if (trimmedNegative) {
        parameters.negativePrompt = trimmedNegative;
      }

      if (typeof seed === "number" && Number.isFinite(seed)) {
        parameters.seed = seed;
      }

      onSubmit(parameters);
    },
    [keyframes, size, seconds, prompt, negativePrompt, seed, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {storageError && (
        <div className="p-2 bg-destructive/10 border border-destructive/30 rounded">
          <p className="text-[10px] text-destructive">{storageError}</p>
        </div>
      )}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Prompt (optional)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the transitions (optional)..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">
            Keyframes ({keyframes.length}/5)
          </label>
          {keyframes.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-primary hover:underline"
            >
              Add
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleKeyframeUpload}
          className="hidden"
        />

        {keyframes.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-3 py-4 text-xs border border-dashed border-border rounded flex flex-col items-center justify-center gap-2 transition-colors hover:bg-secondary"
          >
            <Upload className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-muted-foreground">
              Upload 2-5 keyframe images
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {keyframes.map((frame, index) => (
              <div key={index} className="relative group">
                <img
                  src={frame}
                  alt={`Keyframe ${index + 1}`}
                  className="w-full aspect-square object-cover border border-border rounded"
                />
                <button
                  type="button"
                  onClick={() => removeKeyframe(index)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Xmark className="w-3 h-3" strokeWidth={2} />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/50 py-0.5">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        )}
        {keyframes.length > 0 && keyframes.length < 2 && (
          <p className="text-[10px] text-destructive mt-1">
            Minimum 2 keyframes required
          </p>
        )}
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
            Total Duration
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
          <p className="text-[10px] text-muted-foreground mt-1">
            Duration is split evenly across transitions.
          </p>
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
        type="submit"
        disabled={isLoading || keyframes.length < 2}
        className="w-full px-4 py-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "GENERATING..." : "GENERATE VIDEO"}
      </button>
    </form>
  );
}
