"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import { CharacterUpload } from "@/components/character/CharacterUpload";
import { ReferenceImage, ArtStyle } from "@/types";
import { Check } from "iconoir-react";

export default function NewCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [style, setStyle] = useState<ArtStyle | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = name.trim() && images.length > 0 && style;

  const handleCreate = async () => {
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("style", style ?? "pixel-art");

      const primaryIndex = images.findIndex((image) => image.isPrimary);
      formData.append("primaryIndex", String(primaryIndex >= 0 ? primaryIndex : 0));
      formData.append("removeBackground", removeBackground ? "true" : "false");

      images.forEach((image) => {
        if (image.file) {
          formData.append("images", image.file, image.file.name || "reference.png");
        }
        formData.append("types", image.type);
      });

      const response = await fetch("/api/characters", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to create character.");
      }

      await response.json();
      router.push("/characters");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create character.");
    } finally {
      setIsCreating(false);
    }

  };

  return (
    <div className="min-h-screen grid-bg">
      <Header
        breadcrumb={[
          { label: "Dashboard", href: "/" },
          { label: "Characters", href: "/characters" },
          { label: "New" },
        ]}
      >
        <div className="flex items-center gap-2">
          <div className={`status-dot ${canCreate ? "status-dot-online" : "status-dot-warning"}`} />
          <span className="text-muted-foreground">{canCreate ? "Ready" : "Incomplete"}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <Button
          onClick={handleCreate}
          disabled={!canCreate || isCreating}
          className="bg-primary hover:bg-primary/80 text-primary-foreground h-7 px-3 text-xs tracking-wider disabled:opacity-40"
        >
          {isCreating ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border border-primary-foreground border-t-transparent rounded-full animate-spin" />
              PROCESSING
            </span>
          ) : (
            "CREATE"
          )}
        </Button>
      </Header>

      {/* Main Dashboard */}
      <main className="pt-14 pb-6 px-4">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* Top Row: Name Input + Status + Info */}
          <div className="grid grid-cols-12 gap-4">
            {/* Character Name Input */}
            <div className="col-span-5 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-xs text-muted-foreground tracking-wider">Identifier</span>
              </div>
              <div className="p-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm">
                    {">"}
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter character name..."
                    className="terminal-input w-full h-10 pl-7 pr-4 text-sm bg-secondary placeholder:text-muted-foreground/50"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="text-primary animate-blink">_</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Unique identifier for this character. Used in animation naming and exports.
                </p>
              </div>
            </div>

            {/* Status Panel */}
            <div className="col-span-3 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-xs text-muted-foreground tracking-wider">Status</span>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Name</span>
                  <span className={name ? "text-success" : "text-warning"}>
                    {name ? "Set" : "Required"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">References</span>
                  <span className={images.length > 0 ? "text-success" : "text-warning"}>
                    {images.length > 0 ? `${images.length} loaded` : "Required"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Style</span>
                  <span className={`${style ? "text-success" : "text-warning"} capitalize`}>
                    {style ? style.replace("-", " ") : "Required"}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Panel */}
            <div className="col-span-4 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-xs text-muted-foreground tracking-wider">About</span>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Input reference images for identity extraction. System will analyze visual data
                  and lock character parameters for consistent frame generation across all animations.
                </p>
              </div>
            </div>
          </div>

          {/* Middle Row: Upload Section */}
          <div className="tech-border bg-card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground tracking-wider">Reference Input</span>
              {images.length > 0 && (
                <span className="text-xs">
                  <span className="text-primary metric-value">{images.length}</span>
                  <span className="text-muted-foreground ml-1">loaded</span>
                </span>
              )}
            </div>
            <div className="p-4">
              <CharacterUpload
                onImagesChange={setImages}
                onStyleChange={setStyle}
                onBackgroundRemovalChange={setRemoveBackground}
              />
            </div>
          </div>

          {/* Ready State */}
          {canCreate && (
            <div className="tech-border bg-card border-primary/50 animate-fade-in">
              <div className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 border border-primary bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-primary" strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="status-dot status-dot-online" />
                      <span className="text-sm font-medium text-primary">Ready to Create</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground">{name}</span> configured with{" "}
                      <span className="text-foreground">{images.length} reference{images.length !== 1 ? "s" : ""}</span> in{" "}
                      <span className="text-foreground">{style?.toUpperCase().replace("-", " ")}</span> mode.
                      Execute to begin identity extraction and proceed to animation setup.
                    </p>
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground h-9 px-6 text-xs tracking-wider"
                  >
                    {isCreating ? "PROCESSING..." : "CREATE"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="tech-border bg-card border-destructive/50 p-4 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Bottom Row: Optimization Hints */}
          <div className="grid grid-cols-3 gap-4">
            <div className="tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <span className="text-primary text-xs metric-value">01</span>
                <span className="text-xs text-muted-foreground tracking-wider">Multi Angle</span>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Front, side, and back views maximize extraction accuracy. System performs better with complete spatial data.
                </p>
              </div>
            </div>
            <div className="tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <span className="text-primary text-xs metric-value">02</span>
                <span className="text-xs text-muted-foreground tracking-wider">Style Match</span>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Consistent art style across all references improves generation quality. Mixing styles may cause artifacts.
                </p>
              </div>
            </div>
            <div className="tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <span className="text-primary text-xs metric-value">03</span>
                <span className="text-xs text-muted-foreground tracking-wider">Clear Form</span>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Distinct silhouettes and features produce cleaner animations. Avoid overlapping elements in references.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
