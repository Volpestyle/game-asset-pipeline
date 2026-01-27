"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useCallback } from "react";
import { ReferenceImage, ReferenceImageType, ArtStyle } from "@/types";
import { cn } from "@/lib/utils";
import { CloudUpload, Plus } from "iconoir-react";

interface CharacterUploadProps {
  onImagesChange?: (images: ReferenceImage[]) => void;
  onStyleChange?: (style: ArtStyle) => void;
  onBackgroundRemovalChange?: (enabled: boolean) => void;
}

const IMAGE_TYPES: { value: ReferenceImageType; label: string; code: string }[] = [
  { value: "front", label: "Front View", code: "FNT" },
  { value: "side", label: "Side View", code: "SDE" },
  { value: "back", label: "Back View", code: "BCK" },
  { value: "detail", label: "Detail", code: "DTL" },
  { value: "action", label: "Action Pose", code: "ACT" },
  { value: "other", label: "Other", code: "OTH" },
];

const ART_STYLES: { value: ArtStyle; label: string; code: string }[] = [
  { value: "pixel-art", label: "Pixel Art", code: "PXL" },
  { value: "hand-drawn", label: "Hand Drawn", code: "HDR" },
  { value: "anime", label: "Anime", code: "ANM" },
  { value: "3d-rendered", label: "3D Rendered", code: "3DR" },
  { value: "realistic", label: "Realistic", code: "RLS" },
  { value: "custom", label: "Custom", code: "CST" },
];

export function CharacterUpload({
  onImagesChange,
  onStyleChange,
  onBackgroundRemovalChange,
}: CharacterUploadProps) {
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true);

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

  const handleBackgroundToggle = (checked: boolean) => {
    setRemoveBackground(checked);
    onBackgroundRemovalChange?.(checked);
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground tracking-widest mb-1">
            Reference input
          </p>
          <p className="text-sm font-medium">Image data</p>
        </div>
        {images.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="text-primary metric-value">{images.length}</span> loaded
          </div>
        )}
      </div>

      {/* Drop Zone */}
      <div
        className={cn(
          "drop-zone p-8 cursor-pointer transition-all duration-150",
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

        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border border-border flex items-center justify-center">
            <CloudUpload className="w-6 h-6 text-primary" strokeWidth={1.5} />
          </div>

          <div className="space-y-1">
            <p className="text-sm text-foreground">Drop files here</p>
            <p className="text-xs text-muted-foreground">
              or click to browse filesystem
            </p>
          </div>

          <p className="text-[10px] text-muted-foreground/60 tracking-wider">
            Local storage · Formats: PNG, JPG, WEBP
          </p>
          <p className="text-[10px] text-muted-foreground/60 tracking-wider">
            Transparent PNGs are best. Solid backgrounds can confuse normalization.
          </p>
        </div>
      </div>

      <div className="tech-border bg-card/70 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest mb-1">
              Background
            </p>
            <p className="text-sm font-medium">Cleanup</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={removeBackground}
              onChange={(event) => handleBackgroundToggle(event.target.checked)}
              className="form-checkbox"
            />
            Remove background (AI)
          </label>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
          AI background removal runs on upload and saves as PNG with transparency. Disable if it removes important details.
        </p>
      </div>

      {/* Uploaded Images Grid */}
      {images.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="ascii-divider">Loaded references</div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
            {images.map((image, index) => (
              <div
                key={image.id}
                className={cn(
                  "group relative aspect-square tech-border overflow-hidden transition-all duration-150",
                  image.isPrimary
                    ? "border-primary"
                    : "hover:border-primary/50"
                )}
              >
                {/* Index Badge */}
                <div className="absolute top-0 left-0 z-10 bg-card/90 px-2 py-1 text-[10px] text-muted-foreground border-r border-b border-border">
                  {String(index).padStart(2, "0")}
                </div>

                {/* Primary Badge */}
                {image.isPrimary && (
                  <div className="absolute top-0 right-0 z-10 bg-primary px-2 py-1 text-[10px] text-primary-foreground">
                    PRI
                  </div>
                )}

                {/* Image */}
                <img
                  src={image.url}
                  alt={`Reference ${index}`}
                  className="w-full h-full object-cover"
                />

                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col">
                  {/* Type Selector */}
                  <div className="p-2 border-b border-border">
                    <select
                      value={image.type}
                      onChange={(e) =>
                        updateImageType(image.id, e.target.value as ReferenceImageType)
                      }
                      className="w-full text-xs bg-card border border-border px-2 py-1.5 text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {IMAGE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.code} - {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex-1 flex flex-col justify-end p-2 space-y-1">
                    {!image.isPrimary && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimaryImage(image.id);
                        }}
                        className="w-full text-xs bg-card border border-border hover:border-primary hover:text-primary px-2 py-1.5 transition-colors"
                      >
                        SET PRIMARY
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(image.id);
                      }}
                      className="w-full text-xs bg-card border border-destructive/50 text-destructive hover:bg-destructive/10 px-2 py-1.5 transition-colors"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>

                {/* Type Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-card/90 px-2 py-1 text-[10px] text-muted-foreground border-t border-border">
                  {IMAGE_TYPES.find(t => t.value === image.type)?.code || "OTH"}
                </div>
              </div>
            ))}

            {/* Add More Card */}
            <div
              className="aspect-square tech-border border-dashed flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <div className="text-center">
                <Plus className="w-6 h-6 text-muted-foreground mx-auto" strokeWidth={1.5} />
                <p className="text-[10px] text-muted-foreground mt-2">Add more</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Art Style Selection */}
      {images.length > 0 && (
        <div className="space-y-4 animate-slide-up">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest mb-1">
              Render mode
            </p>
            <p className="text-sm font-medium">Art style</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ART_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => handleStyleSelect(style.value)}
                className={cn(
                  "tech-border p-4 text-left transition-all duration-150",
                  selectedStyle === style.value
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-xs font-medium",
                    selectedStyle === style.value ? "text-primary" : "text-foreground"
                  )}>
                    {style.label}
                  </span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 border",
                    selectedStyle === style.value
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  )}>
                    {style.code}
                  </span>
                </div>
                <div className={cn(
                  "h-1 w-full",
                  selectedStyle === style.value
                    ? "bg-primary"
                    : "bg-border"
                )} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
