"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CharacterUpload } from "@/components/character/CharacterUpload";
import { ReferenceImage, ArtStyle } from "@/types";

export default function NewCharacterPage() {
  const [name, setName] = useState("");
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [style, setStyle] = useState<ArtStyle | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const canCreate = name.trim() && images.length > 0 && style;

  const handleCreate = async () => {
    if (!canCreate) return;

    setIsCreating(true);

    // TODO: Implement actual character creation
    // For now, simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Redirect to character page or animations
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="w-px h-5 bg-border" />
            <h1 className="font-semibold">New Character</h1>
          </div>

          <Button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            className="bg-gold hover:bg-gold/90 text-primary-foreground disabled:opacity-50"
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </span>
            ) : (
              "Create Character"
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="space-y-12">
          {/* Intro */}
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl font-bold">Create a character identity</h2>
            <p className="text-muted-foreground">
              Upload reference images of your character. The AI will extract their visual identity
              to ensure consistent animation frames.
            </p>
          </div>

          {/* Character Name */}
          <div className="max-w-md space-y-3">
            <Label htmlFor="name" className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Character Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Knight, Wizard, Hero..."
              className="h-12 bg-card border-border focus:border-gold focus:ring-gold/20"
            />
          </div>

          {/* Upload Section */}
          <CharacterUpload
            onImagesChange={setImages}
            onStyleChange={setStyle}
          />

          {/* Summary / Next Steps */}
          {canCreate && (
            <div className="p-6 rounded-xl bg-card border border-gold/30 glow-gold-subtle animate-slide-up">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-gold">Ready to create</h3>
                  <p className="text-sm text-muted-foreground">
                    <span className="text-foreground font-medium">{name}</span> with{" "}
                    <span className="text-foreground font-medium">{images.length} reference{images.length !== 1 ? "s" : ""}</span> in{" "}
                    <span className="text-foreground font-medium">{style?.replace("-", " ")}</span> style.
                    Click &quot;Create Character&quot; to continue to animation setup.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="grid md:grid-cols-3 gap-4 pt-8 border-t border-border">
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-sm font-medium mb-1">Multiple angles</p>
              <p className="text-xs text-muted-foreground">
                Front, side, and back views help AI understand your character&apos;s full form.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-sm font-medium mb-1">Consistent style</p>
              <p className="text-xs text-muted-foreground">
                Keep all references in the same art style for best results.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-sm font-medium mb-1">Clear silhouette</p>
              <p className="text-xs text-muted-foreground">
                Characters with distinct shapes and features animate better.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
