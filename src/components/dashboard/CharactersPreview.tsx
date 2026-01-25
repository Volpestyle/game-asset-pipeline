/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MediaImage, Plus } from "iconoir-react";
import type { Character } from "@/types";

const MAX_PREVIEW = 4;

function formatStyle(style: string) {
  return style.replace(/-/g, " ");
}

export function CharactersPreview() {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCharacters = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/characters", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load characters");
      }
      const payload = (await response.json()) as { characters?: Character[] };
      const items = payload.characters ?? [];
      items.sort((a, b) => {
        const aTime = Date.parse(a.updatedAt ?? a.createdAt);
        const bTime = Date.parse(b.updatedAt ?? b.createdAt);
        return bTime - aTime;
      });
      setCharacters(items.slice(0, MAX_PREVIEW));
    } catch (err) {
      console.error(err);
      setError("Could not load characters.");
      setCharacters([]);
    }
  }, []);

  useEffect(() => {
    void loadCharacters();
  }, [loadCharacters]);

  const content = useMemo(() => {
    if (characters === null) {
      return (
        <div className="text-center py-12 text-xs text-muted-foreground">
          Loading characters...
        </div>
      );
    }

    if (characters.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto border border-border flex items-center justify-center mb-4">
            <MediaImage
              className="w-8 h-8 text-muted-foreground/50"
              strokeWidth={1}
            />
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            No characters yet
          </p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            Create your first character to get started
          </p>
          <Link href="/characters/new">
            <Button className="bg-primary hover:bg-primary/80 text-primary-foreground h-8 px-4 text-xs">
              <Plus className="w-3 h-3 mr-2" strokeWidth={2} />
              New Character
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {characters.map((character) => {
            const primaryRef = character.referenceImages.find((img) => img.isPrimary) ?? character.referenceImages[0];
            return (
              <Link
                key={character.id}
                href={`/animations/new?characterId=${character.id}`}
                className="tech-border bg-card/70 p-3 hover-highlight block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border border-border flex items-center justify-center bg-secondary overflow-hidden">
                    {primaryRef?.url ? (
                      <img
                        src={primaryRef.url}
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MediaImage
                        className="w-5 h-5 text-muted-foreground/60"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium truncate max-w-[120px]">
                      {character.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground tracking-wider capitalize">
                      {formatStyle(character.style)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Most recent {Math.min(characters.length, MAX_PREVIEW)}</span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={loadCharacters}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }, [characters, loadCharacters]);

  return (
    <div className="col-span-8 tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          Characters
        </span>
        <Link
          href="/characters"
          className="text-xs text-primary hover:underline"
        >
          View All
        </Link>
      </div>
      <div className="p-6">
        {error ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            {error} Refresh to try again.
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
