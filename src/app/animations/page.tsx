"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import type { Animation } from "@/types";
import { Play, Trash } from "iconoir-react";

export default function AnimationsPage() {
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAnimations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/animations", { cache: "no-store" });
      const data = await response.json();
      setAnimations(data.animations ?? []);
    } catch {
      setAnimations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAnimations();
  }, []);

  const handleDelete = async (animationId: string) => {
    const ok = window.confirm("Delete this animation? This cannot be undone.");
    if (!ok) return;
    setDeletingId(animationId);
    try {
      const response = await fetch(`/api/animations/${animationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete animation.");
      }
      setAnimations((prev) => prev.filter((anim) => anim.id !== animationId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete animation.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen grid-bg">
      <Header backHref="/">
        <Button
          onClick={loadAnimations}
          variant="outline"
          className="h-7 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
        >
          REFRESH
        </Button>
        <Link href="/animations/new">
          <Button className="bg-primary hover:bg-primary/80 text-primary-foreground h-7 px-3 text-[10px] tracking-wider">
            NEW ANIMATION
          </Button>
        </Link>
      </Header>

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground tracking-wider">Animation Queue</span>
                <span className="text-xs text-muted-foreground">
                  {isLoading ? "--" : animations.length} entries
                </span>
              </div>
              <div className="p-4 text-xs text-muted-foreground leading-relaxed">
                Manage generation runs, tweak prompts, and export pixel-art sequences.
              </div>
            </div>
            <div className="col-span-4 tech-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground tracking-wider">Status</span>
                <div className="flex items-center gap-2">
                  <div className={`status-dot ${isLoading ? "status-dot-warning" : "status-dot-online"}`} />
                  <span className={`text-xs ${isLoading ? "text-warning" : "text-success"}`}>
                    {isLoading ? "Scanning" : "Ready"}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="metric-value">{isLoading ? "--" : animations.length}</span>
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="tech-border bg-card p-4 text-xs text-muted-foreground">
              Loading animation registry...
            </div>
          ) : animations.length === 0 ? (
            <div className="tech-border corner-brackets bg-card p-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto border border-border flex items-center justify-center">
                <Play className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-medium">No animations yet</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Create a character and define a motion prompt to get started.
                </p>
              </div>
              <Link href="/animations/new">
                <Button className="bg-primary hover:bg-primary/80 text-primary-foreground h-8 px-4 text-xs tracking-wider">
                  CREATE ANIMATION
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {animations.map((animation) => (
                <div key={animation.id} className="tech-border bg-card p-4 hover-highlight">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-muted-foreground tracking-wider">Animation</div>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {animation.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium">{animation.name}</p>
                    <p className="text-[10px] text-muted-foreground tracking-wider capitalize">
                      {animation.style} · {animation.frameCount}f @ {animation.fps}fps
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {animation.description}
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <Link href={`/animations/${animation.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          className="w-full h-8 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
                        >
                          OPEN
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => handleDelete(animation.id)}
                        disabled={deletingId === animation.id}
                        className="h-8 w-8 p-0 border-destructive/60 text-destructive hover:border-destructive"
                        title="Delete animation"
                      >
                        <Trash className="w-3.5 h-3.5" strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
