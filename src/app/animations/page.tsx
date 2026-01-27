"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import type { Animation, Character } from "@/types";
import { Play, Trash, User } from "iconoir-react";

interface GroupedAnimations {
  character: Character | null;
  animations: Animation[];
}

export default function AnimationsPage() {
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [animationsRes, charactersRes] = await Promise.all([
        fetch("/api/animations", { cache: "no-store" }),
        fetch("/api/characters", { cache: "no-store" }),
      ]);
      const animationsData = await animationsRes.json();
      const charactersData = await charactersRes.json();
      setAnimations(animationsData.animations ?? []);
      setCharacters(charactersData.characters ?? []);
    } catch {
      setAnimations([]);
      setCharacters([]);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedAnimations = useMemo((): GroupedAnimations[] => {
    const characterMap = new Map(characters.map((c) => [c.id, c]));
    const groups = new Map<string, Animation[]>();

    for (const animation of animations) {
      const key = animation.characterId || "unknown";
      const existing = groups.get(key) || [];
      existing.push(animation);
      groups.set(key, existing);
    }

    const result: GroupedAnimations[] = [];
    for (const [characterId, anims] of groups) {
      result.push({
        character: characterMap.get(characterId) || null,
        animations: anims.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      });
    }

    return result.sort((a, b) => {
      const nameA = a.character?.name || "Unknown";
      const nameB = b.character?.name || "Unknown";
      return nameA.localeCompare(nameB);
    });
  }, [animations, characters]);

  useEffect(() => {
    void loadData();
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
      <Header
        breadcrumb={[
          { label: "Dashboard", href: "/" },
          { label: "Animations" },
        ]}
      >
        <Button
          onClick={loadData}
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
                  <span className="text-muted-foreground">Total Animations</span>
                  <span className="metric-value">{isLoading ? "--" : animations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Characters</span>
                  <span className="metric-value">{isLoading ? "--" : groupedAnimations.length}</span>
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
            <div className="space-y-6">
              {groupedAnimations.map((group) => {
                const characterId = group.character?.id || "unknown";
                const primaryRef = group.character?.referenceImages?.find((r) => r.isPrimary);
                const thumbnailUrl = primaryRef?.url || group.character?.workingReference?.url;

                return (
                  <div key={characterId} className="tech-border bg-card">
                    <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                      {thumbnailUrl ? (
                        <div className="w-8 h-8 relative border border-border bg-black/20 flex-shrink-0">
                          <Image
                            src={thumbnailUrl}
                            alt={group.character?.name || "Character"}
                            fill
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 border border-border bg-black/20 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate">
                            {group.character?.name || "Unknown Character"}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-2">
                            {group.animations.length} animation{group.animations.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {group.character && (
                          <p className="text-[10px] text-muted-foreground tracking-wider capitalize">
                            {group.character.style}
                          </p>
                        )}
                      </div>
                      {group.character && (
                        <Link href={`/characters/${group.character.id}`}>
                          <Button
                            variant="outline"
                            className="h-6 px-2 text-[9px] tracking-wider border-border hover:border-primary hover:text-primary"
                          >
                            VIEW
                          </Button>
                        </Link>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.animations.map((animation) => (
                          <div
                            key={animation.id}
                            className="border border-border/50 bg-background/50 p-3 hover-highlight"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium truncate">{animation.name}</p>
                              <span className="text-[9px] text-muted-foreground capitalize ml-2">
                                {animation.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground tracking-wider capitalize mb-1">
                              {animation.style} · {animation.frameCount}f @ {animation.fps}fps
                            </p>
                            {animation.description && (
                              <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                                {animation.description}
                              </p>
                            )}
                            <div className="mt-3 flex gap-2">
                              <Link href={`/animations/${animation.id}`} className="flex-1">
                                <Button
                                  variant="outline"
                                  className="w-full h-7 px-2 text-[9px] tracking-wider border-border hover:border-primary hover:text-primary"
                                >
                                  OPEN
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                onClick={() => handleDelete(animation.id)}
                                disabled={deletingId === animation.id}
                                className="h-7 w-7 p-0 border-destructive/60 text-destructive hover:border-destructive"
                                title="Delete animation"
                              >
                                <Trash className="w-3 h-3" strokeWidth={2} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
