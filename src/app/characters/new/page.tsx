"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CharacterUpload } from "@/components/character/CharacterUpload";
import { ReferenceImage, ArtStyle } from "@/types";
import { NavArrowLeft, Check } from "iconoir-react";

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
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsCreating(false);
  };

  return (
    <div className="min-h-screen grid-bg">
      {/* Top Status Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="h-10 px-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <NavArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              <span>[BACK]</span>
            </Link>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-primary">/characters/new</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">MODE:</span>
              <span className="text-primary">CREATE</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <Button
              onClick={handleCreate}
              disabled={!canCreate || isCreating}
              className="bg-primary hover:bg-primary/80 text-primary-foreground h-7 px-3 text-xs tracking-wider disabled:opacity-40"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-primary-foreground border-t-transparent animate-spin" />
                  PROCESSING...
                </span>
              ) : (
                "[EXECUTE]"
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Page Header */}
          <section className="py-8 border-b border-border">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground tracking-widest">
                  CHARACTER_CREATION_MODULE
                </p>
                <h1 className="text-2xl font-bold tracking-tight">
                  NEW_<span className="text-primary crt-glow">CHARACTER</span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-lg">
                  Input reference images for identity extraction. System will analyze visual data
                  and lock character parameters for consistent frame generation.
                </p>
              </div>

              {/* Status Panel */}
              <div className="tech-border bg-card p-3 text-xs min-w-[180px]">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NAME</span>
                    <span className={name ? "text-success" : "text-warning"}>
                      {name ? "SET" : "REQUIRED"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">REFS</span>
                    <span className={images.length > 0 ? "text-success" : "text-warning"}>
                      {images.length > 0 ? `${images.length}_LOADED` : "REQUIRED"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">STYLE</span>
                    <span className={style ? "text-success" : "text-warning"}>
                      {style ? style.toUpperCase().replace("-", "_") : "REQUIRED"}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">STATUS</span>
                      <span className={canCreate ? "text-success" : "text-warning"}>
                        {canCreate ? "READY" : "INCOMPLETE"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Character Name Input */}
          <section className="py-6 border-b border-border">
            <div className="grid lg:grid-cols-[200px,1fr] gap-6 items-start">
              <div>
                <p className="text-xs text-muted-foreground tracking-widest mb-1">
                  IDENTIFIER
                </p>
                <p className="text-sm font-medium">CHARACTER_NAME</p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm">
                  {">"}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter identifier..."
                  className="terminal-input w-full h-10 pl-7 pr-4 text-sm bg-card placeholder:text-muted-foreground/50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-primary animate-blink">_</span>
                </div>
              </div>
            </div>
          </section>

          {/* Upload Section */}
          <section className="py-6">
            <CharacterUpload
              onImagesChange={setImages}
              onStyleChange={setStyle}
            />
          </section>

          {/* Ready State */}
          {canCreate && (
            <section className="py-6 border-t border-border animate-slide-up">
              <div className="tech-border corner-brackets bg-card p-6 crt-glow-box">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 border border-primary bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-primary" strokeWidth={2} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="status-dot status-dot-online" />
                      <h3 className="text-sm font-medium text-primary">READY_TO_EXECUTE</h3>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        <span className="text-foreground">{name}</span> configured with{" "}
                        <span className="text-foreground">{images.length} reference{images.length !== 1 ? "s" : ""}</span> in{" "}
                        <span className="text-foreground">{style?.toUpperCase().replace("-", "_")}</span> mode.
                      </p>
                      <p className="text-muted-foreground/70">
                        Execute to begin identity extraction and proceed to animation setup.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground h-9 px-4 text-xs tracking-wider"
                  >
                    {isCreating ? "PROCESSING..." : "[EXECUTE]"}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* Tips Panel */}
          <section className="py-6 border-t border-border">
            <div className="mb-4">
              <p className="text-xs text-muted-foreground tracking-widest">
                OPTIMIZATION_HINTS
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-4 stagger-children">
              <div className="tech-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary text-xs metric-value">01</span>
                  <span className="text-xs font-medium">MULTI_ANGLE</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Front, side, and back views maximize extraction accuracy. System performs better with complete spatial data.
                </p>
              </div>
              <div className="tech-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary text-xs metric-value">02</span>
                  <span className="text-xs font-medium">STYLE_MATCH</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Consistent art style across all references improves generation quality. Mixing styles may cause artifacts.
                </p>
              </div>
              <div className="tech-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary text-xs metric-value">03</span>
                  <span className="text-xs font-medium">CLEAR_FORM</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Distinct silhouettes and features produce cleaner animations. Avoid overlapping elements in references.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-primary">[SF]</span>
            <span>/characters/new</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Character Creation Module</span>
            <span className="text-border">|</span>
            <span className="metric-value">v2.1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
