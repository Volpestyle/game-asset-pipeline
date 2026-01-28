"use client";

import { useState, useCallback, useEffect } from "react";
import { ModelSelector } from "./model-studio/ModelSelector";
import { VideoModelForm } from "./model-studio/VideoModelForm";
import { ImageModelForm } from "./model-studio/ImageModelForm";
import { ToonCrafterForm } from "./model-studio/ToonCrafterForm";
import { PikaframesForm } from "./model-studio/PikaframesForm";
import { WanForm } from "./model-studio/WanForm";
import { ResultsDisplay } from "./model-studio/ResultsDisplay";
import { HistoryPanel } from "./model-studio/HistoryPanel";
import { isValidImageModel, type ImageModelId } from "@/lib/ai/imageModelConfig";
import { isVideoModelId } from "@/lib/ai/soraConstraints";
import {
  buildModelStudioKey,
  readStoredString,
  writeStoredString,
} from "@/lib/modelStudioStorage";
import type { StudioParameters } from "@/types/studio";

type ModelCategory = "video" | "image";

type StudioResult = {
  type: "video" | "image";
  videoUrl?: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  timestamp: number;
};

type StudioResultPayload = {
  videoUrl?: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
};

const STORAGE_SCOPE = "meta";
const CATEGORY_KEY = buildModelStudioKey(STORAGE_SCOPE, null, "category");
const VIDEO_MODEL_KEY = buildModelStudioKey(STORAGE_SCOPE, null, "videoModelId");
const IMAGE_MODEL_KEY = buildModelStudioKey(STORAGE_SCOPE, null, "imageModelId");

type PersistedStudioSettings = {
  category: ModelCategory;
  videoModelId: string;
  imageModelId: ImageModelId;
  error: string | null;
};

function loadPersistedSettings(): PersistedStudioSettings {
  const errors: string[] = [];

  const categoryResult = readStoredString(CATEGORY_KEY);
  if (categoryResult.error) errors.push(categoryResult.error);
  const rawCategory = categoryResult.value;
  const category =
    rawCategory === "image" || rawCategory === "video" ? rawCategory : "video";

  const videoResult = readStoredString(VIDEO_MODEL_KEY);
  if (videoResult.error) errors.push(videoResult.error);
  const rawVideo = videoResult.value ?? "";
  const videoModelId = isVideoModelId(rawVideo) ? rawVideo : "sora-2";

  const imageResult = readStoredString(IMAGE_MODEL_KEY);
  if (imageResult.error) errors.push(imageResult.error);
  const rawImage = imageResult.value ?? "";
  const imageModelId = isValidImageModel(rawImage) ? rawImage : "rd-fast";

  return {
    category,
    videoModelId,
    imageModelId,
    error: errors[0] ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStudioResultPayload(data: unknown): StudioResultPayload | null {
  if (!isRecord(data)) return null;
  const result = data.result;
  if (!isRecord(result)) return null;
  const videoUrl = typeof result.videoUrl === "string" ? result.videoUrl : undefined;
  const thumbnailUrl =
    typeof result.thumbnailUrl === "string" ? result.thumbnailUrl : undefined;
  const imageUrls = Array.isArray(result.imageUrls)
    ? result.imageUrls.filter((url) => typeof url === "string")
    : undefined;

  if (videoUrl) return { videoUrl, thumbnailUrl };
  if (imageUrls && imageUrls.length > 0) {
    return { imageUrls };
  }
  return null;
}

function getErrorMessage(data: unknown): string | null {
  if (!isRecord(data)) return null;
  return typeof data.error === "string" ? data.error : null;
}

export function ModelStudio() {
  const [category, setCategory] = useState<ModelCategory>("video");
  const [videoModelId, setVideoModelId] = useState<string>("sora-2");
  const [imageModelId, setImageModelId] = useState<ImageModelId>("rd-fast");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

  useEffect(() => {
    const persisted = loadPersistedSettings();
    setCategory(persisted.category);
    setVideoModelId(persisted.videoModelId);
    setImageModelId(persisted.imageModelId);
    setSettingsError(persisted.error);
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    const errors = [
      writeStoredString(CATEGORY_KEY, category),
      writeStoredString(VIDEO_MODEL_KEY, videoModelId),
      writeStoredString(IMAGE_MODEL_KEY, imageModelId),
    ].filter((value): value is string => typeof value === "string");
    setSettingsError(errors[0] ?? null);
  }, [category, videoModelId, imageModelId, storageLoaded]);

  const handleCategoryChange = useCallback((newCategory: ModelCategory) => {
    setCategory(newCategory);
    setError(null);
  }, []);

  const handleVideoModelChange = useCallback((modelId: string) => {
    setVideoModelId(modelId);
    setError(null);
  }, []);

  const handleImageModelChange = useCallback((modelId: string) => {
    if (isValidImageModel(modelId)) {
      setImageModelId(modelId);
      setError(null);
    } else {
      setError("Invalid image model selection.");
    }
  }, []);

  const handleSubmit = useCallback(
    async (parameters: StudioParameters) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelCategory: category,
            modelId: category === "video" ? videoModelId : imageModelId,
            parameters,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const message = getErrorMessage(data) ?? "Generation failed";
          throw new Error(message);
        }

        const result = parseStudioResultPayload(data);
        if (!result) {
          throw new Error("Studio response did not include any outputs.");
        }

        const newResult: StudioResult = {
          type: category,
          videoUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl,
          imageUrls: result.imageUrls,
          timestamp: Date.now(),
        };

        setResults((prev) => [newResult, ...prev]);
        setHistoryRefreshToken((prev) => prev + 1);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [category, videoModelId, imageModelId]
  );

  const currentModelId = category === "video" ? videoModelId : imageModelId;
  const isToonCrafter = category === "video" && videoModelId === "tooncrafter";
  const isPikaframes = category === "video" && videoModelId === "pikaframes";
  const isWan = category === "video" && videoModelId === "wan2.2";

  return (
    <div className="col-span-12 tech-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs text-muted-foreground tracking-wider">
          MODEL STUDIO
        </span>
      </div>
      <div className="p-4 grid grid-cols-12 gap-4">
        <div className="col-span-5 space-y-4">
          <ModelSelector
            category={category}
            modelId={currentModelId}
            onCategoryChange={handleCategoryChange}
            onModelChange={
              category === "video"
                ? handleVideoModelChange
                : handleImageModelChange
            }
          />

          <div className="border-t border-border pt-4">
            {category === "video" ? (
              isToonCrafter ? (
                <ToonCrafterForm
                  key={videoModelId}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                />
              ) : isPikaframes ? (
                <PikaframesForm
                  key={videoModelId}
                  modelId={videoModelId}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                />
              ) : isWan ? (
                <WanForm
                  key={videoModelId}
                  modelId={videoModelId}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                />
              ) : (
                <VideoModelForm
                  key={videoModelId}
                  modelId={videoModelId}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                />
              )
            ) : (
              <ImageModelForm
                key={imageModelId}
                modelId={imageModelId}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            )}
          </div>

          {settingsError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded">
              <p className="text-xs text-destructive">{settingsError}</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="col-span-7 min-h-[300px] space-y-4">
          <ResultsDisplay results={results} isLoading={isLoading} />
          <HistoryPanel refreshToken={historyRefreshToken} />
        </div>
      </div>
    </div>
  );
}
