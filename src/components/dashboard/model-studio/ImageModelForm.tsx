"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Xmark } from "iconoir-react";
import {
  getImageModelConfig,
  getImageModelStyles,
  type ImageModelId,
} from "@/lib/ai/imageModelConfig";
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
import type { StudioImageParameters } from "@/types/studio";

type ImageModelFormProps = {
  modelId: ImageModelId;
  onSubmit: (parameters: StudioImageParameters) => void;
  isLoading: boolean;
};

type MultiRefImage = {
  id: string;
  base64: string;
  preview: string;
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

export function ImageModelForm({
  modelId,
  onSubmit,
  isLoading,
}: ImageModelFormProps) {
  const config = getImageModelConfig(modelId);
  const styles = getImageModelStyles(modelId);

  const storageScope = "image";
  const promptKey = buildModelStudioKey(storageScope, modelId, "prompt");
  const styleKey = buildModelStudioKey(storageScope, modelId, "style");
  const widthKey = buildModelStudioKey(storageScope, modelId, "width");
  const heightKey = buildModelStudioKey(storageScope, modelId, "height");
  const strengthKey = buildModelStudioKey(storageScope, modelId, "strength");
  const tileXKey = buildModelStudioKey(storageScope, modelId, "tileX");
  const tileYKey = buildModelStudioKey(storageScope, modelId, "tileY");
  const removeBgKey = buildModelStudioKey(storageScope, modelId, "removeBg");
  const seedKey = buildModelStudioKey(storageScope, modelId, "seed");
  const numImagesKey = buildModelStudioKey(storageScope, modelId, "numImages");
  const outputFormatKey = buildModelStudioKey(
    storageScope,
    modelId,
    "outputFormat"
  );
  const safetyFilterKey = buildModelStudioKey(
    storageScope,
    modelId,
    "safetyFilterLevel"
  );
  const bypassKey = buildModelStudioKey(
    storageScope,
    modelId,
    "bypassPromptExpansion"
  );
  const aspectRatioKey = buildModelStudioKey(storageScope, modelId, "aspectRatio");
  const resolutionKey = buildModelStudioKey(storageScope, modelId, "resolution");

  const defaultStyle = styles[0] ?? "default";
  const defaultWidth = config.defaultWidth;
  const defaultHeight = config.defaultHeight;
  const defaultStrength = 0.8;
  const aspectRatioDefault = config.aspectRatioOptions?.[0] ?? "1:1";
  const resolutionDefault = config.resolutionOptions?.[0] ?? "2K";
  const rdMinImages = 1;
  const rdMaxImages = 4;

  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(defaultStyle);
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputPalette, setInputPalette] = useState<string | null>(null);
  const [inputImageError, setInputImageError] = useState<string | null>(null);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [multiRefError, setMultiRefError] = useState<string | null>(null);
  const [strength, setStrength] = useState(defaultStrength);
  const [tileX, setTileX] = useState(false);
  const [tileY, setTileY] = useState(false);
  const [removeBg, setRemoveBg] = useState(false);
  const [seed, setSeed] = useState<number | "">("");
  const [numImages, setNumImages] = useState(rdMinImages);
  const [outputFormat, setOutputFormat] = useState("png");
  const [safetyFilterLevel, setSafetyFilterLevel] = useState("block_only_high");
  const [bypassPromptExpansion, setBypassPromptExpansion] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(aspectRatioDefault);
  const [resolution, setResolution] = useState(resolutionDefault);

  // Multi-input images (session state for models with multi-image support)
  const [multiRefImages, setMultiRefImages] = useState<MultiRefImage[]>([]);

  const inputImageRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLInputElement>(null);
  const multiRefInputRef = useRef<HTMLInputElement>(null);

  const supportsMultiRef = config.supportsMultipleImages;
  const maxImageCount = config.maxImageCount;
  const supportsAspectRatio = config.supportsAspectRatio;
  const supportsResolution = config.supportsResolution;
  const supportsPromptExpansion = config.supportsPromptExpansion;
  const usesAspectRatioControls = supportsAspectRatio || supportsResolution;
  const allowCustomSize = supportsAspectRatio && aspectRatio === "custom";
  const isRdModel = modelId === "rd-fast" || modelId === "rd-plus";
  const isNanoBanana = modelId === "nano-banana-pro";

  useEffect(() => {
    setStorageLoaded(false);
  }, [modelId]);

  useEffect(() => {
    if (storageLoaded) return;
    const errors: string[] = [];

    const activeConfig = getImageModelConfig(modelId);
    const activeStyles = getImageModelStyles(modelId);

    const defaultStyle = activeStyles[0] ?? "default";
    const defaultWidth = activeConfig.defaultWidth;
    const defaultHeight = activeConfig.defaultHeight;
    const defaultStrength = 0.8;
    const aspectRatioDefault = activeConfig.aspectRatioOptions?.[0] ?? "1:1";
    const resolutionDefault = activeConfig.resolutionOptions?.[0] ?? "2K";
    const rdMinImages = 1;
    const rdMaxImages = 4;

    const promptResult = readStoredString(promptKey);
    if (promptResult.error) errors.push(promptResult.error);

    const styleResult = readStoredString(styleKey);
    if (styleResult.error) errors.push(styleResult.error);

    const widthResult = readStoredNumber(widthKey);
    if (widthResult.error) errors.push(widthResult.error);

    const heightResult = readStoredNumber(heightKey);
    if (heightResult.error) errors.push(heightResult.error);

    const strengthResult = readStoredNumber(strengthKey);
    if (strengthResult.error) errors.push(strengthResult.error);

    const tileXResult = readStoredBoolean(tileXKey);
    if (tileXResult.error) errors.push(tileXResult.error);

    const tileYResult = readStoredBoolean(tileYKey);
    if (tileYResult.error) errors.push(tileYResult.error);

    const removeBgResult = readStoredBoolean(removeBgKey);
    if (removeBgResult.error) errors.push(removeBgResult.error);

    const seedResult = readStoredNumber(seedKey);
    if (seedResult.error) errors.push(seedResult.error);

    const numImagesResult = readStoredNumber(numImagesKey);
    if (numImagesResult.error) errors.push(numImagesResult.error);

    const outputFormatResult = readStoredString(outputFormatKey);
    if (outputFormatResult.error) errors.push(outputFormatResult.error);

    const safetyFilterResult = readStoredString(safetyFilterKey);
    if (safetyFilterResult.error) errors.push(safetyFilterResult.error);

    const bypassResult = readStoredBoolean(bypassKey);
    if (bypassResult.error) errors.push(bypassResult.error);

    const aspectRatioResult = readStoredString(aspectRatioKey);
    if (aspectRatioResult.error) errors.push(aspectRatioResult.error);

    const resolutionResult = readStoredString(resolutionKey);
    if (resolutionResult.error) errors.push(resolutionResult.error);

    const resolvedStyle =
      styleResult.value && activeStyles.includes(styleResult.value)
        ? styleResult.value
        : defaultStyle;

    const nextWidth = widthResult.value ?? defaultWidth;
    const nextHeight = heightResult.value ?? defaultHeight;
    const nextStrength =
      typeof strengthResult.value === "number"
        ? Math.min(1, Math.max(0, strengthResult.value))
        : defaultStrength;

    const nextAspectRatio =
      aspectRatioResult.value &&
      activeConfig.aspectRatioOptions?.includes(aspectRatioResult.value)
        ? aspectRatioResult.value
        : aspectRatioDefault;

    const nextResolution =
      resolutionResult.value &&
      activeConfig.resolutionOptions?.includes(resolutionResult.value)
        ? resolutionResult.value
        : resolutionDefault;

    const rawNumImages = numImagesResult.value;
    const nextNumImages =
      typeof rawNumImages === "number" && Number.isFinite(rawNumImages)
        ? Math.min(rdMaxImages, Math.max(rdMinImages, Math.round(rawNumImages)))
        : rdMinImages;

    const outputFormatOptions = ["png", "jpg", "jpeg"];
    const outputFormatCandidate = outputFormatResult.value ?? "";
    const nextOutputFormat = outputFormatOptions.includes(outputFormatCandidate)
      ? outputFormatCandidate
      : "png";

    const safetyOptions = [
      "block_only_high",
      "block_medium_and_above",
      "block_low_and_above",
    ];
    const safetyCandidate = safetyFilterResult.value ?? "";
    const nextSafetyFilterLevel = safetyOptions.includes(safetyCandidate)
      ? safetyCandidate
      : "block_only_high";

    setPrompt(promptResult.value ?? "");
    setStyle(resolvedStyle);
    setWidth(nextWidth);
    setHeight(nextHeight);
    setStrength(nextStrength);
    setTileX(tileXResult.value ?? false);
    setTileY(tileYResult.value ?? false);
    setRemoveBg(removeBgResult.value ?? false);
    setSeed(typeof seedResult.value === "number" ? seedResult.value : "");
    setNumImages(nextNumImages);
    setOutputFormat(nextOutputFormat);
    setSafetyFilterLevel(nextSafetyFilterLevel);
    setBypassPromptExpansion(bypassResult.value ?? false);
    setAspectRatio(nextAspectRatio);
    setResolution(nextResolution);
    setStorageError(errors[0] ?? null);
    setStorageLoaded(true);
  }, [
    storageLoaded,
    modelId,
    promptKey,
    styleKey,
    widthKey,
    heightKey,
    strengthKey,
    tileXKey,
    tileYKey,
    removeBgKey,
    seedKey,
    numImagesKey,
    outputFormatKey,
    safetyFilterKey,
    bypassKey,
    aspectRatioKey,
    resolutionKey,
  ]);

  useEffect(() => {
    if (!storageLoaded) return;
    const errors = [
      writeStoredString(promptKey, prompt),
      writeStoredString(styleKey, style),
      writeStoredNumber(widthKey, width),
      writeStoredNumber(heightKey, height),
      writeStoredNumber(strengthKey, strength),
      writeStoredBoolean(tileXKey, tileX),
      writeStoredBoolean(tileYKey, tileY),
      writeStoredBoolean(removeBgKey, removeBg),
      writeStoredNumber(seedKey, typeof seed === "number" ? seed : null),
      writeStoredNumber(numImagesKey, numImages),
      writeStoredString(outputFormatKey, outputFormat),
      writeStoredString(safetyFilterKey, safetyFilterLevel),
      writeStoredBoolean(bypassKey, bypassPromptExpansion),
      writeStoredString(aspectRatioKey, aspectRatio),
      writeStoredString(resolutionKey, resolution),
    ].filter((value): value is string => typeof value === "string");

    setStorageError(errors[0] ?? null);
  }, [
    prompt,
    style,
    width,
    height,
    strength,
    tileX,
    tileY,
    removeBg,
    seed,
    numImages,
    outputFormat,
    safetyFilterLevel,
    bypassPromptExpansion,
    aspectRatio,
    resolution,
    promptKey,
    styleKey,
    widthKey,
    heightKey,
    strengthKey,
    tileXKey,
    tileYKey,
    removeBgKey,
    seedKey,
    numImagesKey,
    outputFormatKey,
    safetyFilterKey,
    bypassKey,
    aspectRatioKey,
    resolutionKey,
    storageLoaded,
  ]);

  const handleInputImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        const message = "Unsupported file type. Please upload an image.";
        logger.warn("Image model input image rejected", {
          fileName: file.name,
          fileType: file.type,
        });
        setInputImageError(message);
        if (inputImageRef.current) {
          inputImageRef.current.value = "";
        }
        return;
      }
      setInputImageError(null);
      try {
        const base64 = await fileToBase64(file);
        setInputImage(base64);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to read input image.";
        logger.error("Image model input image upload failed", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          error: message,
        });
        setInputImageError("Failed to read input image.");
      } finally {
        if (inputImageRef.current) {
          inputImageRef.current.value = "";
        }
      }
    },
    [inputImageRef]
  );

  const handlePaletteUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        const message = "Unsupported file type. Please upload an image.";
        logger.warn("Image model palette rejected", {
          fileName: file.name,
          fileType: file.type,
        });
        setPaletteError(message);
        if (paletteRef.current) {
          paletteRef.current.value = "";
        }
        return;
      }
      setPaletteError(null);
      try {
        const base64 = await fileToBase64(file);
        setInputPalette(base64);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to read palette image.";
        logger.error("Image model palette upload failed", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          error: message,
        });
        setPaletteError("Failed to read palette image.");
      } finally {
        if (paletteRef.current) {
          paletteRef.current.value = "";
        }
      }
    },
    [paletteRef]
  );

  const handleMultiRefUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        const message = "Unsupported file type. Please upload an image.";
        logger.warn("Image model reference rejected", {
          fileName: file.name,
          fileType: file.type,
        });
        setMultiRefError(message);
        if (multiRefInputRef.current) {
          multiRefInputRef.current.value = "";
        }
        return;
      }
      if (multiRefImages.length >= maxImageCount) {
        const message = `Reference image limit reached (${maxImageCount}).`;
        logger.warn("Image model reference limit reached", {
          maxImageCount,
        });
        setMultiRefError(message);
        if (multiRefInputRef.current) {
          multiRefInputRef.current.value = "";
        }
        return;
      }
      setMultiRefError(null);
      try {
        const base64 = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setMultiRefImages((prev) => [...prev, { id, base64, preview }]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to read reference image.";
        logger.error("Image model reference upload failed", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          error: message,
        });
        setMultiRefError("Failed to read reference image.");
      } finally {
        if (multiRefInputRef.current) {
          multiRefInputRef.current.value = "";
        }
      }
    },
    [multiRefImages.length, maxImageCount]
  );

  const removeMultiRefImage = useCallback((id: string) => {
    setMultiRefImages((prev) => {
      const toRemove = prev.find((img) => img.id === id);
      if (toRemove) {
        URL.revokeObjectURL(toRemove.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;

      const parameters: StudioImageParameters = {
        prompt: prompt.trim(),
      };

      if (usesAspectRatioControls) {
        if (supportsAspectRatio) {
          parameters.aspectRatio = aspectRatio;
        }
        if (supportsResolution && aspectRatio !== "custom") {
          parameters.resolution = resolution;
        }
        if (allowCustomSize) {
          parameters.width = width;
          parameters.height = height;
        }
        if (config.supportsSeed && typeof seed === "number") {
          parameters.seed = seed;
        }
        // Handle multiple input images
        if (supportsMultiRef && multiRefImages.length > 0) {
          parameters.referenceImages = multiRefImages.map((img) => img.base64);
        } else if (!supportsMultiRef && inputImage) {
          parameters.inputImage = inputImage;
        }
        if (isNanoBanana) {
          parameters.outputFormat = outputFormat;
          parameters.safetyFilterLevel = safetyFilterLevel;
        }
      } else {
        parameters.width = width;
        parameters.height = height;

        if (styles.length > 0) {
          parameters.style = style;
        }

        if (inputImage) {
          parameters.inputImage = inputImage;
          if (config.supportsStrength) {
            parameters.strength = strength;
          }
        }

        if (config.supportsPalette && inputPalette) {
          parameters.inputPalette = inputPalette;
        }

        if (config.supportsTiling) {
          parameters.tileX = tileX;
          parameters.tileY = tileY;
        }

        if (config.supportsRemoveBg) {
          parameters.removeBg = removeBg;
        }

        if (config.supportsSeed && typeof seed === "number") {
          parameters.seed = seed;
        }

        if (supportsPromptExpansion) {
          parameters.bypassPromptExpansion = bypassPromptExpansion;
        }

        if (isRdModel) {
          const sanitized = Math.min(4, Math.max(1, Math.round(numImages)));
          parameters.numImages = sanitized;
        }
      }

      onSubmit(parameters);
    },
    [
      prompt,
      width,
      height,
      style,
      styles.length,
      inputImage,
      inputPalette,
      strength,
      tileX,
      tileY,
      removeBg,
      seed,
      bypassPromptExpansion,
      numImages,
      outputFormat,
      safetyFilterLevel,
      aspectRatio,
      resolution,
      multiRefImages,
      config,
      allowCustomSize,
      usesAspectRatioControls,
      supportsAspectRatio,
      supportsResolution,
      supportsPromptExpansion,
      isRdModel,
      isNanoBanana,
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
          placeholder="Describe the image you want to generate..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {usesAspectRatioControls ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {supportsAspectRatio && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {config.aspectRatioOptions?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {supportsResolution && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Resolution
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  disabled={allowCustomSize}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                >
                  {config.resolutionOptions?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {allowCustomSize && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Resolution is ignored when using custom dimensions.
                  </p>
                )}
              </div>
            )}
          </div>

          {allowCustomSize && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Width
                </label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  min={64}
                  max={2048}
                  step={32}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Height
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  min={64}
                  max={2048}
                  step={32}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Multi-input images for models with multi-image support */}
          {supportsMultiRef && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-muted-foreground">
                  Input Images ({multiRefImages.length}/{maxImageCount})
                </label>
                <input
                  ref={multiRefInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleMultiRefUpload}
                  className="hidden"
                  disabled={isLoading || multiRefImages.length >= maxImageCount}
                />
                <button
                  type="button"
                  onClick={() => multiRefInputRef.current?.click()}
                  disabled={isLoading || multiRefImages.length >= maxImageCount}
                  className="text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Image
                </button>
              </div>

              {multiRefImages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {multiRefImages.map((img) => (
                    <div key={img.id} className="relative">
                      <img
                        src={img.preview}
                        alt="Reference"
                        className="w-14 h-14 object-cover border border-border rounded"
                      />
                      <button
                        type="button"
                        onClick={() => removeMultiRefImage(img.id)}
                        disabled={isLoading}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 disabled:opacity-50"
                      >
                        <Xmark className="w-3 h-3" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Upload up to {maxImageCount} input images for generation.
                </p>
              )}
              {multiRefError && (
                <p className="text-[10px] text-destructive">{multiRefError}</p>
              )}
            </div>
          )}

          {isNanoBanana && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Output Format
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="png">png</option>
                  <option value="jpg">jpg</option>
                  <option value="jpeg">jpeg</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Safety Filter
                </label>
                <select
                  value={safetyFilterLevel}
                  onChange={(e) => setSafetyFilterLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="block_only_high">block_only_high</option>
                  <option value="block_medium_and_above">block_medium_and_above</option>
                  <option value="block_low_and_above">block_low_and_above</option>
                </select>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {styles.length > 0 && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Style
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {styles.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Width
              </label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                min={64}
                max={1024}
                step={8}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Height
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                min={64}
                max={1024}
                step={8}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {isRdModel && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Num Images
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={numImages}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setNumImages(Math.min(4, Math.max(1, Math.round(next))));
                }}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Generates multiple variations for selection.
              </p>
            </div>
          )}
        </>
      )}

      {config.supportsImg2Img && !supportsMultiRef && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Input Image (img2img)
            </label>
            <input
              ref={inputImageRef}
              type="file"
              accept="image/*"
              onChange={handleInputImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputImageRef.current?.click()}
              className={`w-full px-3 py-2 text-xs border border-border rounded flex items-center justify-center gap-2 transition-colors ${
                inputImage
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
              {inputImage ? "Change Input Image" : "Upload Input Image"}
            </button>
            {inputImage && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={inputImage}
                  alt="Input preview"
                  className="w-16 h-16 object-cover border border-border rounded"
                />
                <button
                  type="button"
                  onClick={() => {
                    setInputImage(null);
                    setInputImageError(null);
                    if (inputImageRef.current) {
                      inputImageRef.current.value = "";
                    }
                  }}
                  className="text-[10px] text-destructive hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
            {inputImageError && (
              <p className="text-[10px] text-destructive mt-1">
                {inputImageError}
              </p>
            )}
          </div>

          {inputImage && config.supportsStrength && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Strength ({strength.toFixed(2)})
              </label>
              <input
                type="range"
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
            </div>
          )}
        </div>
      )}

      {config.supportsPalette && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Color Palette Reference
          </label>
          <input
            ref={paletteRef}
            type="file"
            accept="image/*"
            onChange={handlePaletteUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => paletteRef.current?.click()}
            className={`w-full px-3 py-2 text-xs border border-border rounded flex items-center justify-center gap-2 transition-colors ${
              inputPalette
                ? "bg-primary/10 border-primary text-primary"
                : "bg-background hover:bg-secondary"
            }`}
          >
            <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
            {inputPalette ? "Change Palette" : "Upload Palette"}
          </button>
          {inputPalette && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={inputPalette}
                alt="Palette preview"
                className="w-20 h-8 object-cover border border-border rounded"
              />
              <button
                type="button"
                onClick={() => {
                  setInputPalette(null);
                  setPaletteError(null);
                  if (paletteRef.current) {
                    paletteRef.current.value = "";
                  }
                }}
                className="text-[10px] text-destructive hover:underline"
              >
                Clear
              </button>
            </div>
          )}
          {paletteError && (
            <p className="text-[10px] text-destructive mt-1">{paletteError}</p>
          )}
        </div>
      )}

      {!usesAspectRatioControls && (
        <div className="flex flex-wrap gap-4">
          {config.supportsTiling && (
            <>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={tileX}
                  onChange={(e) => setTileX(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                Tile X
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={tileY}
                  onChange={(e) => setTileY(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                Tile Y
              </label>
            </>
          )}

          {config.supportsRemoveBg && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={removeBg}
                onChange={(e) => setRemoveBg(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Remove BG
            </label>
          )}

          {supportsPromptExpansion && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={bypassPromptExpansion}
                onChange={(e) => setBypassPromptExpansion(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Bypass Expansion
            </label>
          )}
        </div>
      )}

      {config.supportsSeed && (
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

      <button
        type="submit"
        disabled={isLoading || !prompt.trim()}
        className="w-full px-4 py-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "GENERATING..." : "GENERATE IMAGE"}
      </button>
    </form>
  );
}
