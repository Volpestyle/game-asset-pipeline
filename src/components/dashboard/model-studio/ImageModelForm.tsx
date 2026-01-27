"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useCallback, useRef } from "react";
import { Upload, Xmark } from "iconoir-react";
import {
  getImageModelConfig,
  getImageModelStyles,
  type ImageModelId,
} from "@/lib/ai/imageModelConfig";

type ImageModelFormProps = {
  modelId: ImageModelId;
  onSubmit: (parameters: Record<string, unknown>) => void;
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
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
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

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(styles[0] ?? "default");
  const [width, setWidth] = useState(config.defaultWidth);
  const [height, setHeight] = useState(config.defaultHeight);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputPalette, setInputPalette] = useState<string | null>(null);
  const [strength, setStrength] = useState(0.8);
  const [tileX, setTileX] = useState(false);
  const [tileY, setTileY] = useState(false);
  const [removeBg, setRemoveBg] = useState(false);
  const [seed, setSeed] = useState<number | "">("");
  const [bypassPromptExpansion, setBypassPromptExpansion] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(
    config.aspectRatioOptions?.[0] ?? "1:1"
  );
  const [resolution, setResolution] = useState(
    config.resolutionOptions?.[0] ?? "2K"
  );

  // Multi-reference images (session state for nano-banana-pro)
  const [multiRefImages, setMultiRefImages] = useState<MultiRefImage[]>([]);

  const inputImageRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLInputElement>(null);
  const multiRefInputRef = useRef<HTMLInputElement>(null);

  const supportsMultiRef = config.supportsMultipleImages;
  const maxImageCount = config.maxImageCount;

  const handleInputImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const base64 = await fileToBase64(file);
        setInputImage(base64);
      }
    },
    []
  );

  const handlePaletteUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const base64 = await fileToBase64(file);
        setInputPalette(base64);
      }
    },
    []
  );

  const handleMultiRefUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && multiRefImages.length < maxImageCount) {
        const base64 = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setMultiRefImages((prev) => [...prev, { id, base64, preview }]);
      }
      if (multiRefInputRef.current) {
        multiRefInputRef.current.value = "";
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

      const parameters: Record<string, unknown> = {
        prompt: prompt.trim(),
      };

      if (modelId === "nano-banana-pro") {
        parameters.aspectRatio = aspectRatio;
        parameters.resolution = resolution;
        // Handle multiple reference images
        if (multiRefImages.length > 0) {
          parameters.referenceImages = multiRefImages.map((img) => img.base64);
        } else if (inputImage) {
          parameters.inputImage = inputImage;
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

        parameters.bypassPromptExpansion = bypassPromptExpansion;
      }

      onSubmit(parameters);
    },
    [
      prompt,
      modelId,
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
      aspectRatio,
      resolution,
      multiRefImages,
      config,
      onSubmit,
    ]
  );

  const isNanoBanana = modelId === "nano-banana-pro";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {isNanoBanana ? (
        <>
          <div className="grid grid-cols-2 gap-3">
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

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {config.resolutionOptions?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multi-reference images for nano-banana-pro */}
          {supportsMultiRef && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-muted-foreground">
                  Reference Images ({multiRefImages.length}/{maxImageCount})
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
                  + Add
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
                  Upload up to {maxImageCount} reference images for generation.
                </p>
              )}
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
        </>
      )}

      {config.supportsImg2Img && (
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
              {inputImage ? "Image Uploaded" : "Upload Input Image"}
            </button>
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
            {inputPalette ? "Palette Uploaded" : "Upload Palette"}
          </button>
        </div>
      )}

      {!isNanoBanana && (
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

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={bypassPromptExpansion}
              onChange={(e) => setBypassPromptExpansion(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Bypass Expansion
          </label>
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
