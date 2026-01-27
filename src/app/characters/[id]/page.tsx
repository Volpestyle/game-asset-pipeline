"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Header } from "@/components/layout";
import type { AnchorPoint, ArtStyle, Character, ReferenceImage, ReferenceImageType } from "@/types";
import { logger } from "@/lib/logger";

const ANCHOR_OPTIONS: { value: AnchorPoint; label: string }[] = [
  { value: "bottom-center", label: "Bottom Center (feet)" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
  { value: "top-center", label: "Top Center" },
];

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

const isReferenceType = (value: string): value is ReferenceImageType => {
  return IMAGE_TYPES.some((type) => type.value === value);
};

const parseReferenceType = (value: string): ReferenceImageType => {
  return isReferenceType(value) ? value : "other";
};

const isAnchorPoint = (value: string): value is AnchorPoint => {
  return ANCHOR_OPTIONS.some((option) => option.value === value);
};

const parseAnchorPoint = (value: string): AnchorPoint | undefined => {
  return isAnchorPoint(value) ? value : undefined;
};

const createUploadId = (seed: number) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${seed}`;
};

export default function CharacterDetailPage() {
  const params = useParams();
  const characterId = String(params.id ?? "");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [removingReferenceId, setRemovingReferenceId] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<ReferenceImage | null>(null);
  const [uploadQueue, setUploadQueue] = useState<ReferenceImage[]>([]);
  const [isUploadDragOver, setIsUploadDragOver] = useState(false);
  const [uploadRemoveBackground, setUploadRemoveBackground] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCharacter = useCallback(async () => {
    if (!characterId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/characters/${characterId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Character not found.");
      }
      const data = await response.json();
      setCharacter(data.character);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load character.");
    } finally {
      setIsLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    void loadCharacter();
  }, [loadCharacter]);

  const updatePrimary = (id: string) => {
    if (!character) return;
    const updated = character.referenceImages.map((img) => ({
      ...img,
      isPrimary: img.id === id,
    }));
    setCharacter({ ...character, referenceImages: updated });
  };

  const updateType = (id: string, type: ReferenceImageType) => {
    if (!character) return;
    const updated = character.referenceImages.map((img) =>
      img.id === id ? { ...img, type } : img
    );
    setCharacter({ ...character, referenceImages: updated });
  };

  const handleUploadFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    setError(null);
    setMessage(null);
    const newImages: ReferenceImage[] = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file, index) => ({
        id: createUploadId(index),
        url: URL.createObjectURL(file),
        file,
        type: "other",
        isPrimary: false,
      }));

    if (newImages.length === 0) {
      setError("Only image files can be uploaded.");
      return;
    }

    setUploadQueue((prev) => [...prev, ...newImages]);
  }, []);

  const handleUploadDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsUploadDragOver(false);
    handleUploadFiles(event.dataTransfer.files);
  }, [handleUploadFiles]);

  const handleUploadDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsUploadDragOver(true);
  }, []);

  const handleUploadDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsUploadDragOver(false);
  }, []);

  const updateUploadType = (id: string, typeValue: string) => {
    const nextType = parseReferenceType(typeValue);
    setUploadQueue((prev) =>
      prev.map((img) => (img.id === id ? { ...img, type: nextType } : img))
    );
  };

  const removeUploadImage = (id: string) => {
    setUploadQueue((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleUploadQueue = async () => {
    if (!character || uploadQueue.length === 0) return;
    setIsUploading(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("removeBackground", uploadRemoveBackground ? "true" : "false");
      uploadQueue.forEach((image) => {
        if (image.file) {
          formData.append("images", image.file, image.file.name || "reference.png");
        }
        formData.append("types", image.type);
      });

      const response = await fetch(`/api/characters/${characterId}/references`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to add reference images.");
      }

      const data = await response.json();
      setCharacter(data.character);
      uploadQueue.forEach((image) => {
        URL.revokeObjectURL(image.url);
      });
      setUploadQueue([]);
      const addedCount = uploadQueue.length;
      setMessage(`Added ${addedCount} reference${addedCount === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add reference images.");
    } finally {
      setIsUploading(false);
    }
  };

  const openRemoveDialog = (image: ReferenceImage) => {
    if (!character || removingReferenceId) return;
    if (character.referenceImages.length <= 1) {
      setError("At least one reference image is required.");
      logger.warn("Attempted to remove the last reference image", {
        characterId,
        referenceId: image.id,
      });
      return;
    }
    setMessage(null);
    setError(null);
    setPendingRemove(image);
    setRemoveDialogOpen(true);
    logger.info("Reference removal dialog opened", {
      characterId,
      referenceId: image.id,
      type: image.type,
    });
  };

  const handleRemoveDialogChange = (nextOpen: boolean) => {
    if (removingReferenceId) return;
    setRemoveDialogOpen(nextOpen);
    if (!nextOpen) {
      if (pendingRemove) {
        logger.info("Reference removal dialog closed", {
          characterId,
          referenceId: pendingRemove.id,
        });
      }
      setPendingRemove(null);
    }
  };

  const confirmRemoveReference = async () => {
    if (!character || !pendingRemove || removingReferenceId) return;
    if (character.referenceImages.length <= 1) {
      setError("At least one reference image is required.");
      return;
    }

    const referenceId = pendingRemove.id;
    setRemovingReferenceId(referenceId);
    setMessage(null);
    setError(null);

    logger.info("Removing reference image", {
      characterId,
      referenceId,
      type: pendingRemove.type,
    });

    let didRemove = false;

    try {
      const response = await fetch(
        `/api/characters/${characterId}/references?referenceId=${encodeURIComponent(referenceId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = await response.json();
        logger.warn("Reference removal failed", {
          characterId,
          referenceId,
          status: response.status,
          error: data?.error ?? "Unknown error",
        });
        throw new Error(data?.error || "Failed to remove reference image.");
      }
      const data = await response.json();
      setCharacter(data.character);
      setMessage("Reference removed.");
      didRemove = true;
      logger.info("Reference image removed", { characterId, referenceId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove reference image.";
      setError(message);
      logger.error("Failed to remove reference image", {
        characterId,
        referenceId,
        error: message,
      });
    } finally {
      setRemovingReferenceId(null);
      if (didRemove) {
        setRemoveDialogOpen(false);
        setPendingRemove(null);
      }
    }
  };

  const handleSave = async () => {
    if (!character) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);

    const sanitizedRefs = character.referenceImages.map((img) => ({
      id: img.id,
      url: img.url,
      filename: img.filename,
      type: img.type,
      isPrimary: img.isPrimary,
    }));

    try {
      const response = await fetch(`/api/characters/${characterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...character,
          referenceImages: sanitizedRefs,
          anchor: character.anchor,
          scale: character.scale,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to save.");
      }
      const data = await response.json();
      setCharacter(data.character);
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center text-xs text-muted-foreground">
        Loading character...
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center text-xs text-muted-foreground">
        Character not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg">
      <Header
        breadcrumb={[
          { label: "Dashboard", href: "/" },
          { label: "Characters", href: "/characters" },
          { label: character.name },
        ]}
      >
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="outline"
          className="h-7 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
        >
          {isSaving ? "SAVING" : "SAVE"}
        </Button>
        <Link href={`/animations/new?characterId=${character.id}`}>
          <Button className="bg-primary hover:bg-primary/80 text-primary-foreground h-7 px-3 text-[10px] tracking-wider">
            NEW ANIMATION
          </Button>
        </Link>
      </Header>

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {(message || error) && (
            <div className={`tech-border bg-card p-3 text-xs ${error ? "text-destructive border-destructive/30" : "text-success border-success/30"}`}>
              {error ?? message}
            </div>
          )}

          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-8 tech-border bg-card p-4 space-y-3">
              <p className="text-xs text-muted-foreground tracking-wider">Identity</p>
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground tracking-widest">Name</label>
                <input
                  value={character.name}
                  onChange={(event) => setCharacter({ ...character, name: event.target.value })}
                  className="terminal-input w-full h-10 px-3 text-sm bg-card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground tracking-widest">Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {ART_STYLES.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => setCharacter({ ...character, style: style.value })}
                      className={`tech-border p-2 text-left transition-all duration-150 ${
                        character.style === style.value
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={character.style === style.value ? "text-primary text-[10px]" : "text-[10px]"}>
                          {style.label}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 border ${
                          character.style === style.value ? "border-primary text-primary" : "border-border text-muted-foreground"
                        }`}>
                          {style.code}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-4 tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Status</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">References</span>
                  <span className="metric-value">{character.referenceImages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primary</span>
                  <span className="text-primary">
                    {character.referenceImages.find((img) => img.isPrimary)?.type ?? "-"}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Manage reference images, primary selection, and metadata below.
              </p>
            </div>
          </section>

          {/* Canvas Normalization Settings */}
          <section className="tech-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground tracking-wider">Canvas Normalization</p>
              <span className="text-[10px] text-muted-foreground">Export settings</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              These settings control how this character is positioned and scaled when exporting with normalization enabled.
              Leave blank to use project defaults.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground tracking-widest">Anchor Point</label>
                <select
                  value={character.anchor ?? ""}
                  onChange={(e) => setCharacter({
                    ...character,
                    anchor: parseAnchorPoint(e.target.value),
                  })}
                  className="terminal-input w-full h-9 px-3 text-sm bg-card"
                >
                  <option value="">Use project default</option>
                  {ANCHOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-[9px] text-muted-foreground">
                  Where to position the character within the canvas
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground tracking-widest">Scale</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={character.scale ?? 0.8}
                    onChange={(e) => setCharacter({
                      ...character,
                      scale: parseFloat(e.target.value),
                    })}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs text-foreground w-12 text-right">
                    {Math.round((character.scale ?? 0.8) * 100)}%
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground">
                  How much of the canvas height the character fills
                </p>
              </div>
            </div>
          </section>

          <section className="tech-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground tracking-wider">Reference Images</p>
              <Link href="/characters/new" className="text-[10px] text-primary hover:underline">
                Add New Character
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {character.referenceImages.map((image) => (
                <div key={image.id} className={`tech-border p-2 space-y-2 ${image.isPrimary ? "border-primary" : ""}`}>
                  <img
                    src={image.url}
                    alt={image.type}
                    className="w-full aspect-square object-contain border border-border"
                  />
                  <div className="flex items-center justify-between">
                    <select
                      value={image.type}
                      onChange={(event) => updateType(image.id, parseReferenceType(event.target.value))}
                      className="text-[10px] bg-card border border-border px-2 py-1 text-foreground w-full"
                    >
                      {IMAGE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.code} - {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updatePrimary(image.id)}
                    className={`w-full h-7 px-2 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary ${
                      image.isPrimary ? "border-primary text-primary" : ""
                    }`}
                  >
                    {image.isPrimary ? "PRIMARY" : "SET PRIMARY"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={character.referenceImages.length <= 1 || removingReferenceId !== null}
                    onClick={() => openRemoveDialog(image)}
                    className="w-full h-7 px-2 text-[10px] tracking-wider border-destructive/50 text-destructive hover:border-destructive hover:text-destructive"
                  >
                    {removingReferenceId === image.id ? "REMOVING" : "REMOVE"}
                  </Button>
                </div>
              ))}
            </div>
            <div className="tech-border bg-card/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground tracking-wider">Add References</p>
                {uploadQueue.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    <span className="text-primary metric-value">{uploadQueue.length}</span> queued
                  </span>
                )}
              </div>
              <div
                className={`drop-zone p-6 cursor-pointer transition-all duration-150 ${isUploadDragOver ? "drag-over" : ""}`}
                onDrop={handleUploadDrop}
                onDragOver={handleUploadDragOver}
                onDragLeave={handleUploadDragLeave}
                onClick={() => uploadInputRef.current?.click()}
              >
                <input
                  ref={uploadInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleUploadFiles(event.target.files)}
                />
                <div className="text-center space-y-2">
                  <p className="text-xs text-foreground">Drop files here</p>
                  <p className="text-[10px] text-muted-foreground">or click to browse</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={uploadRemoveBackground}
                  onChange={(event) => setUploadRemoveBackground(event.target.checked)}
                  className="form-checkbox"
                />
                Remove background (AI)
              </label>
              {uploadQueue.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {uploadQueue.map((image) => (
                    <div key={image.id} className="tech-border p-2 space-y-2">
                      <img
                        src={image.url}
                        alt={image.type}
                        className="w-full aspect-square object-cover border border-border"
                      />
                      <select
                        value={image.type}
                        onChange={(event) => updateUploadType(image.id, event.target.value)}
                        className="text-[10px] bg-card border border-border px-2 py-1 text-foreground w-full"
                      >
                        {IMAGE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.code} - {type.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeUploadImage(image.id)}
                        className="w-full h-7 px-2 text-[10px] tracking-wider border-destructive/50 text-destructive hover:border-destructive hover:text-destructive"
                      >
                        REMOVE
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={handleUploadQueue}
                  disabled={uploadQueue.length === 0 || isUploading}
                  className="bg-primary hover:bg-primary/80 text-primary-foreground h-7 px-3 text-[10px] tracking-wider disabled:opacity-40"
                >
                  {isUploading ? "UPLOADING" : "UPLOAD REFERENCES"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Dialog open={removeDialogOpen} onOpenChange={handleRemoveDialogChange}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">Remove reference image</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This cannot be undone. The next primary reference will be picked automatically if needed.
            </DialogDescription>
          </DialogHeader>
          {pendingRemove && (
            <div className="tech-border bg-card/70 p-3 flex items-center gap-3">
              <img
                src={pendingRemove.url}
                alt={`${pendingRemove.type} reference`}
                className="size-16 object-contain border border-border"
              />
              <div className="space-y-1 text-xs">
                <div className="text-[10px] text-muted-foreground tracking-wider">REFERENCE</div>
                <div className="text-foreground">{pendingRemove.type}</div>
                {pendingRemove.filename && (
                  <div className="text-[10px] text-muted-foreground">{pendingRemove.filename}</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleRemoveDialogChange(false)}
              disabled={removingReferenceId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveReference}
              disabled={removingReferenceId !== null}
            >
              {removingReferenceId ? "REMOVING" : "REMOVE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
