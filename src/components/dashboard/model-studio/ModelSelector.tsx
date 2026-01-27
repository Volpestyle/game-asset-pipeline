"use client";

import { getVideoModelOptions } from "@/lib/ai/soraConstraints";
import { getImageModelOptions } from "@/lib/ai/imageModelConfig";

type ModelCategory = "video" | "image";

type ModelSelectorProps = {
  category: ModelCategory;
  modelId: string;
  onCategoryChange: (category: ModelCategory) => void;
  onModelChange: (modelId: string) => void;
};

export function ModelSelector({
  category,
  modelId,
  onCategoryChange,
  onModelChange,
}: ModelSelectorProps) {
  const videoModels = getVideoModelOptions();
  const imageModels = getImageModelOptions();
  const models = category === "video" ? videoModels : imageModels;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onCategoryChange("video")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            category === "video"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          VIDEO
        </button>
        <button
          type="button"
          onClick={() => onCategoryChange("image")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            category === "image"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          IMAGE
        </button>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Model
        </label>
        <select
          value={modelId}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {models.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
