"use client";

import { useState, useCallback } from "react";
import { ReferenceImage, ReferenceImageType, ArtStyle } from "@/types";
import { cn } from "@/lib/utils";

interface CharacterUploadProps {
  onImagesChange?: (images: ReferenceImage[]) => void;
  onStyleChange?: (style: ArtStyle) => void;
}

const IMAGE_TYPES: { value: ReferenceImageType; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "side", label: "Side" },
  { value: "back", label: "Back" },
  { value: "detail", label: "Detail" },
  { value: "action", label: "Action" },
  { value: "other", label: "Other" },
];

const ART_STYLES: { value: ArtStyle; label: string; description: string }[] = [
  { value: "pixel-art", label: "Pixel Art", description: "Retro game aesthetics" },
  { value: "hand-drawn", label: "Hand Drawn", description: "Illustrated style" },
  { value: "anime", label: "Anime", description: "Japanese animation" },
  { value: "3d-rendered", label: "3D Rendered", description: "Pre-rendered 3D" },
  { value: "realistic", label: "Realistic", description: "Photorealistic" },
  { value: "custom", label: "Custom", description: "Define your own" },
];

export function CharacterUpload({ onImagesChange, onStyleChange }: CharacterUploadProps) {
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle | null>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const newImages: ReferenceImage[] = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file, index) => ({
        id: `${Date.now()}-${index}`,
        url: URL.createObjectURL(file),
        file,
        type: "other" as ReferenceImageType,
        isPrimary: images.length === 0 && index === 0,
      }));

    const updated = [...images, ...newImages];
    setImages(updated);
    onImagesChange?.(updated);
  }, [images, onImagesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const updateImageType = (id: string, type: ReferenceImageType) => {
    const updated = images.map((img) =>
      img.id === id ? { ...img, type } : img
    );
    setImages(updated);
    onImagesChange?.(updated);
  };

  const setPrimaryImage = (id: string) => {
    const updated = images.map((img) => ({
      ...img,
      isPrimary: img.id === id,
    }));
    setImages(updated);
    onImagesChange?.(updated);
  };

  const removeImage = (id: string) => {
    const updated = images.filter((img) => img.id !== id);
    // If we removed the primary, make the first one primary
    if (updated.length > 0 && !updated.some((img) => img.isPrimary)) {
      updated[0].isPrimary = true;
    }
    setImages(updated);
    onImagesChange?.(updated);
  };

  const handleStyleSelect = (style: ArtStyle) => {
    setSelectedStyle(style);
    onStyleChange?.(style);
  };

  return (
    <div className="space-y-8">
      {/* Drop Zone */}
      <div
        className={cn(
          "drop-zone rounded-lg p-8 text-center cursor-pointer transition-all duration-200",
          isDragOver && "drag-over"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="space-y-4">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gold"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div>
            <p className="text-lg font-medium text-foreground">
              Drop character references here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>

          <p className="text-xs text-muted-foreground/70">
            PNG, JPG, WebP up to 10MB each
          </p>
        </div>
      </div>

      {/* Uploaded Images Grid */}
      {images.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">
              Reference Images
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {images.length} uploaded
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
            {images.map((image) => (
              <div
                key={image.id}
                className={cn(
                  "group relative aspect-square rounded-lg overflow-hidden bg-card border transition-all duration-200",
                  image.isPrimary
                    ? "border-gold ring-1 ring-gold/30 glow-gold-subtle"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                {/* Image */}
                <img
                  src={image.url}
                  alt="Reference"
                  className="w-full h-full object-cover"
                />

                {/* Primary Badge */}
                {image.isPrimary && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-gold text-primary-foreground text-xs font-medium">
                    Primary
                  </div>
                )}

                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
                    {/* Type Selector */}
                    <select
                      value={image.type}
                      onChange={(e) =>
                        updateImageType(image.id, e.target.value as ReferenceImageType)
                      }
                      className="w-full text-xs bg-black/50 border border-white/20 rounded px-2 py-1 text-white backdrop-blur-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {IMAGE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!image.isPrimary && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrimaryImage(image.id);
                          }}
                          className="flex-1 text-xs bg-white/10 hover:bg-white/20 border border-white/20 rounded px-2 py-1 text-white transition-colors"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(image.id);
                        }}
                        className="text-xs bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded px-2 py-1 text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add More Card */}
            <div
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-muted-foreground/50 flex items-center justify-center cursor-pointer transition-colors"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <div className="text-center">
                <svg
                  className="w-8 h-8 text-muted-foreground mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="text-xs text-muted-foreground mt-2 block">
                  Add more
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Art Style Selection */}
      {images.length > 0 && (
        <div className="space-y-4 animate-slide-up">
          <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">
            Art Style
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ART_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => handleStyleSelect(style.value)}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all duration-200",
                  selectedStyle === style.value
                    ? "border-gold bg-gold/10 glow-gold-subtle"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary"
                )}
              >
                <p
                  className={cn(
                    "font-medium",
                    selectedStyle === style.value ? "text-gold" : "text-foreground"
                  )}
                >
                  {style.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {style.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
