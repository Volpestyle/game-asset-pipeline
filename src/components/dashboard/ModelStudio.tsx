"use client";

import { useState, useCallback } from "react";
import { ModelSelector } from "./model-studio/ModelSelector";
import { VideoModelForm } from "./model-studio/VideoModelForm";
import { ImageModelForm } from "./model-studio/ImageModelForm";
import { ToonCrafterForm } from "./model-studio/ToonCrafterForm";
import { ResultsDisplay } from "./model-studio/ResultsDisplay";
import type { ImageModelId } from "@/lib/ai/imageModelConfig";

type ModelCategory = "video" | "image";

type StudioResult = {
  type: "video" | "image";
  videoUrl?: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  timestamp: number;
};

export function ModelStudio() {
  const [category, setCategory] = useState<ModelCategory>("video");
  const [videoModelId, setVideoModelId] = useState("sora-2");
  const [imageModelId, setImageModelId] = useState<ImageModelId>("rd-fast");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCategoryChange = useCallback((newCategory: ModelCategory) => {
    setCategory(newCategory);
    setError(null);
  }, []);

  const handleVideoModelChange = useCallback((modelId: string) => {
    setVideoModelId(modelId);
    setError(null);
  }, []);

  const handleImageModelChange = useCallback((modelId: string) => {
    setImageModelId(modelId as ImageModelId);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (parameters: Record<string, unknown>) => {
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
          throw new Error(data.error ?? "Generation failed");
        }

        const result = data.result as {
          videoUrl?: string;
          thumbnailUrl?: string;
          imageUrls?: string[];
        };

        const newResult: StudioResult = {
          type: category,
          videoUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl,
          imageUrls: result.imageUrls,
          timestamp: Date.now(),
        };

        setResults((prev) => [newResult, ...prev]);
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
                <ToonCrafterForm onSubmit={handleSubmit} isLoading={isLoading} />
              ) : (
                <VideoModelForm
                  modelId={videoModelId}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                />
              )
            ) : (
              <ImageModelForm
                modelId={imageModelId}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            )}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="col-span-7 min-h-[300px]">
          <ResultsDisplay results={results} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
