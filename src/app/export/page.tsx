"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import type { Animation } from "@/types";

export default function ExportPage() {
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      </Header>

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground tracking-wider">Export Bay</span>
                <span className="text-xs text-muted-foreground">
                  {isLoading ? "--" : animations.length} assets
                </span>
              </div>
              <div className="p-4 text-xs text-muted-foreground leading-relaxed">
                Export spritesheets and Aseprite-compatible metadata for web and Expo pipelines.
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
                  <span className="text-muted-foreground">Animations</span>
                  <span className="metric-value">{isLoading ? "--" : animations.length}</span>
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="tech-border bg-card p-4 text-xs text-muted-foreground">
              Loading export registry...
            </div>
          ) : animations.length === 0 ? (
            <div className="tech-border corner-brackets bg-card p-6 text-center space-y-4">
              <div>
                <p className="text-xs font-medium">No animations to export</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Create and generate an animation first.
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
                    <div className="text-xs text-muted-foreground tracking-wider">Export</div>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {animation.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium">{animation.name}</p>
                  <p className="text-[10px] text-muted-foreground tracking-wider mt-1">
                    {animation.frameCount}f · {(animation.frameWidth ?? animation.spriteSize)}×{(animation.frameHeight ?? animation.spriteSize)}px
                  </p>
                  <div className="mt-4">
                    <Link href={`/animations/${animation.id}`}>
                      <Button
                        variant="outline"
                        className="w-full h-8 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
                      >
                        OPEN EXPORT PANEL
                      </Button>
                    </Link>
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
