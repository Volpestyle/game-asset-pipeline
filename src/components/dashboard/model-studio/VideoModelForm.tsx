"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload } from "iconoir-react";
import {
  getVideoModelConfig,
  getVideoSizeOptions,
  getVideoSecondsOptions,
} from "@/lib/ai/soraConstraints";
import { logger } from "@/lib/logger";
import {
  buildModelStudioKey,
  readStoredBoolean,
  readStoredNumber,
  readStoredString,
  writeStoredBoolean,
  writeStoredNumber,
  writeStoredString,
} from "@/lib/modelStudioStorage";
import type { StudioVideoParameters } from "@/types/studio";

type VideoModelFormProps = {
  modelId: string;
  onSubmit: (parameters: StudioVideoParameters) => void;
  isLoading: boolean;
};

type MultiRefImage = {
  id: string;
  base64: string;
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

export function VideoModelForm({
  modelId,
  onSubmit,
  isLoading,
}: VideoModelFormProps) {
  const config = getVideoModelConfig(modelId);
  const sizeOptions = getVideoSizeOptions(modelId);
  const secondsOptions = getVideoSecondsOptions(modelId);
  const requiresStartImage = modelId === "wan2.2";

  const storageScope = "video";
  const promptKey = buildModelStudioKey(storageScope, modelId, "prompt");
  const sizeKey = buildModelStudioKey(storageScope, modelId, "size");
  const secondsKey = buildModelStudioKey(storageScope, modelId, "seconds");
  const loopKey = buildModelStudioKey(storageScope, modelId, "loop");
  const audioKey = buildModelStudioKey(storageScope, modelId, "generateAudio");

  const defaultSize = sizeOptions[0] ?? "1280x720";
  const defaultSeconds = secondsOptions[0] ?? 4;

  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(defaultSize);
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [startImage, setStartImage] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [startImageError, setStartImageError] = useState<string | null>(null);
  const [endImageError, setEndImageError] = useState<string | null>(null);
  const [referenceImageError, setReferenceImageError] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState<number | "">("");
  const [effect, setEffect] = useState("");
  const [concepts, setConcepts] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<MultiRefImage[]>([]);
  const promptValue = prompt.trim();
  const canSubmit = Boolean(promptValue) && (!requiresStartImage || Boolean(startImage));

  const startImageRef = useRef<HTMLInputElement>(null);
  const endImageRef = useRef<HTMLInputElement>(null);
  const referenceImageRef = useRef<HTMLInputElement>(null);

  const supportsReferenceImages = Boolean(config.supportsReferenceImages);
  const referenceImageLimit = config.referenceImageLimit ?? 0;
  const referenceConstraints = config.referenceImageConstraints;
  const referenceImagesActive = supportsReferenceImages && referenceImages.length > 0;
  const supportsConcepts = Boolean(config.supportsConcepts);
  const supportsEffect = Boolean(config.supportsEffect);
  const effectActive = supportsEffect && effect.trim().length > 0;
  const supportsSeed = Boolean(config.supportsSeed);
  const endImageDisabled = referenceImagesActive || effectActive;

  const getLandscapeSizeOption = useCallback(() => {
    const options = sizeOptions.filter((opt) => {
      const [w, h] = opt.split("x").map((value) => Number(value));
      return Number.isFinite(w) && Number.isFinite(h) && w >= h;
    });
    return options[0] ?? sizeOptions[0] ?? "1280x720";
  }, [sizeOptions]);

  useEffect(() => {
    const errors: string[] = [];

    const promptResult = readStoredString(promptKey);
    if (promptResult.error) errors.push(promptResult.error);

    const sizeResult = readStoredString(sizeKey);
    if (sizeResult.error) errors.push(sizeResult.error);

    const secondsResult = readStoredNumber(secondsKey);
    if (secondsResult.error) errors.push(secondsResult.error);

    const loopResult = readStoredBoolean(loopKey);
    if (loopResult.error) errors.push(loopResult.error);

    const audioResult = readStoredBoolean(audioKey);
    if (audioResult.error) errors.push(audioResult.error);

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
    setSize(resolvedSize);
    setSeconds(resolvedSeconds);
    setLoop(loopResult.value ?? false);
    setGenerateAudio(audioResult.value ?? false);
    setStorageError(errors[0] ?? null);
    setStorageLoaded(true);
  }, [
    promptKey,
    sizeKey,
    secondsKey,
    loopKey,
    audioKey,
    sizeOptions,
    secondsOptions,
    defaultSize,
    defaultSeconds,
  ]);

  useEffect(() => {
    if (!storageLoaded) return;
    const errors = [
      writeStoredString(promptKey, prompt),
      writeStoredString(sizeKey, size),
      writeStoredNumber(secondsKey, seconds),
      writeStoredBoolean(loopKey, loop),
      writeStoredBoolean(audioKey, generateAudio),
    ].filter((value): value is string => typeof value === "string");

    setStorageError(errors[0] ?? null);
  }, [
    prompt,
    size,
    seconds,
    loop,
    generateAudio,
    promptKey,
    sizeKey,
    secondsKey,
    loopKey,
    audioKey,
    storageLoaded,
  ]);

  useEffect(() => {
    if (config.replicateSupportsAudio && generateAudio) {
      setGenerateAudio(false);
    }
  }, [config.replicateSupportsAudio, generateAudio]);

  const handleStartImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        const message = "Unsupported file type. Please upload an image.";
        logger.warn("Video model start image rejected", {
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
        logger.error("Video model start image upload failed", {
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
        logger.warn("Video model end image rejected", {
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
        logger.error("Video model end image upload failed", {
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

  const handleReferenceUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        const message = "Unsupported file type. Please upload an image.";
        logger.warn("Video model reference rejected", {
          fileName: file.name,
          fileType: file.type,
        });
        setReferenceImageError(message);
        if (referenceImageRef.current) {
          referenceImageRef.current.value = "";
        }
        return;
      }
      if (referenceImageLimit > 0 && referenceImages.length >= referenceImageLimit) {
        const message = `Reference image limit reached (${referenceImageLimit}).`;
        logger.warn("Video model reference limit reached", {
          referenceImageLimit,
        });
        setReferenceImageError(message);
        if (referenceImageRef.current) {
          referenceImageRef.current.value = "";
        }
        return;
      }
      setReferenceImageError(null);
      try {
        const base64 = await fileToBase64(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setReferenceImages((prev) => [...prev, { id, base64 }]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to read reference image.";
        logger.error("Video model reference upload failed", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          error: message,
        });
        setReferenceImageError("Failed to read reference image.");
      } finally {
        if (referenceImageRef.current) {
          referenceImageRef.current.value = "";
        }
      }
    },
    [referenceImages.length, referenceImageLimit]
  );

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const toggleConcept = useCallback((concept: string) => {
    setConcepts((prev) => {
      if (prev.includes(concept)) {
        return prev.filter((item) => item !== concept);
      }
      return [...prev, concept];
    });
  }, []);

  useEffect(() => {
    if (!referenceConstraints || !referenceImagesActive) return;
    if (referenceConstraints.seconds && seconds !== referenceConstraints.seconds) {
      setSeconds(referenceConstraints.seconds);
    }
    if (referenceConstraints.aspectRatio === "16:9") {
      const [w, h] = size.split("x").map((value) => Number(value));
      const isLandscape = Number.isFinite(w) && Number.isFinite(h) && w >= h;
      if (!isLandscape) {
        setSize(getLandscapeSizeOption());
      }
    }
  }, [
    referenceConstraints,
    referenceImagesActive,
    seconds,
    size,
    getLandscapeSizeOption,
  ]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!promptValue) return;
      if (requiresStartImage && !startImage) return;

      const parameters: StudioVideoParameters = {
        prompt: promptValue,
        size,
        seconds,
      };

      if (startImage) {
        parameters.startImage = startImage;
      }
      if (
        endImage &&
        config.supportsStartEnd &&
        !referenceImagesActive &&
        !effectActive
      ) {
        parameters.endImage = endImage;
      }
      if (config.supportsLoop) {
        parameters.loop = loop;
      }
      if (config.replicateSupportsAudio) {
        parameters.generateAudio = false;
      }
      if (config.supportsNegativePrompt && negativePrompt.trim()) {
        parameters.negativePrompt = negativePrompt.trim();
      }
      if (supportsSeed && typeof seed === "number") {
        parameters.seed = seed;
      }
      if (supportsReferenceImages && referenceImages.length > 0) {
        parameters.referenceImages = referenceImages.map((image) => image.base64);
      }
      if (supportsConcepts && concepts.length > 0) {
        parameters.concepts = concepts;
      }
      if (supportsEffect && effect.trim()) {
        parameters.effect = effect.trim();
      }

      onSubmit(parameters);
    },
    [
      promptValue,
      size,
      seconds,
      startImage,
      endImage,
      loop,
      generateAudio,
      negativePrompt,
      seed,
      supportsSeed,
      referenceImages,
      supportsReferenceImages,
      referenceImagesActive,
      effectActive,
      concepts,
      supportsConcepts,
      effect,
      supportsEffect,
      config,
      requiresStartImage,
      onSubmit,
    ]
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
            disabled={referenceImagesActive && Boolean(referenceConstraints)}
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
            disabled={referenceImagesActive && Boolean(referenceConstraints)}
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

      {config.supportsStartEnd && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Start Image
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
            {requiresStartImage && !startImage && (
              <p className="text-[10px] text-destructive mt-1">
                Start image required for Wan 2.2.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              End Image
            </label>
            <input
              ref={endImageRef}
              type="file"
              accept="image/*"
              onChange={handleEndImageUpload}
              className="hidden"
              disabled={endImageDisabled}
            />
            <button
              type="button"
              onClick={() => endImageRef.current?.click()}
              disabled={endImageDisabled}
              className={`w-full px-3 py-2 text-xs border border-border rounded flex items-center justify-center gap-2 transition-colors ${
                endImage
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
              {endImageDisabled ? "Disabled" : endImage ? "Change" : "Upload"}
            </button>
            {endImage && (
              <div className={`mt-2 space-y-1 ${endImageDisabled ? "opacity-60" : ""}`}>
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
      )}

      {referenceImagesActive && referenceConstraints && (
        <p className="text-[10px] text-muted-foreground">
          Reference images require {referenceConstraints.aspectRatio} and {referenceConstraints.seconds}s.
          End frame is ignored.
        </p>
      )}

      {effectActive && (
        <p className="text-[10px] text-muted-foreground">
          Effects disable the end frame for PixVerse v5.
        </p>
      )}

      {supportsReferenceImages && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs text-muted-foreground">
              Reference Images ({referenceImages.length}/{referenceImageLimit})
            </label>
            <input
              ref={referenceImageRef}
              type="file"
              accept="image/*"
              onChange={handleReferenceUpload}
              className="hidden"
              disabled={isLoading || referenceImages.length >= referenceImageLimit}
            />
            <button
              type="button"
              onClick={() => referenceImageRef.current?.click()}
              disabled={isLoading || referenceImages.length >= referenceImageLimit}
              className="text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add
            </button>
          </div>
          {referenceImages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((img) => (
                <div key={img.id} className="relative">
                  <img
                    src={img.base64}
                    alt="Reference"
                    className="w-14 h-14 object-cover border border-border rounded"
                  />
                  <button
                    type="button"
                    onClick={() => removeReferenceImage(img.id)}
                    disabled={isLoading}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Add up to {referenceImageLimit} images for subject consistency.
            </p>
          )}
          {referenceImageError && (
            <p className="text-[10px] text-destructive">{referenceImageError}</p>
          )}
        </div>
      )}

      {config.supportsNegativePrompt && (
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
      )}

      {supportsSeed && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Seed (optional)
          </label>
          <input
            type="number"
            value={seed}
            onChange={(e) =>
              setSeed(e.target.value ? Number(e.target.value) : "")
            }
            placeholder="Random"
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {supportsEffect && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Effect (optional)
          </label>
          <input
            type="text"
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            placeholder="Effect name"
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {supportsConcepts && config.conceptOptions && config.conceptOptions.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">
            Camera Concepts (optional)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {config.conceptOptions.map((concept) => (
              <label
                key={concept}
                className="flex items-center gap-2 text-[10px] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={concepts.includes(concept)}
                  onChange={() => toggleConcept(concept)}
                  className="w-3.5 h-3.5"
                />
                {concept.replace(/_/g, " ")}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {config.supportsLoop && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Loop
          </label>
        )}

        {config.replicateSupportsAudio && (
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={false}
                disabled={true}
                className="w-3.5 h-3.5"
              />
              Generate Audio
            </label>
            <p className="text-[10px] text-muted-foreground">
              Audio generation is disabled for character animation.
            </p>
          </div>
        )}
      </div>

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
