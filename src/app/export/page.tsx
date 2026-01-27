"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import type { Animation, Character } from "@/types";
import { User, Download, Check } from "iconoir-react";

interface GroupedAnimations {
  character: Character | null;
  animations: Animation[];
}

interface ExportOptions {
  normalize: boolean;
  removeBackground: boolean;
  backgroundRemovalMode: "spritesheet" | "per-frame";
}

export default function ExportPage() {
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingCharacterId, setExportingCharacterId] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    normalize: true,
    removeBackground: false,
    backgroundRemovalMode: "spritesheet",
  });
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

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

  const exportableCount = useMemo(() => {
    return animations.filter((a) => a.generatedSpritesheet).length;
  }, [animations]);

  useEffect(() => {
    void loadData();
  }, []);

  const handleExportAll = async (group: GroupedAnimations) => {
    const characterId = group.character?.id || "unknown";
    const exportableAnims = group.animations.filter((a) => a.generatedSpritesheet);

    if (exportableAnims.length === 0) {
      alert("No animations with generated spritesheets to export.");
      return;
    }

    setExportingCharacterId(characterId);
    setExportSuccess(null);

    try {
      const response = await fetch("/api/export/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animationIds: exportableAnims.map((a) => a.id),
          characterId: group.character?.id,
          characterName: group.character?.name,
          normalize: exportOptions.normalize,
          removeBackground: exportOptions.removeBackground,
          backgroundRemovalMode: exportOptions.backgroundRemovalMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Export failed");
      }

      setExportSuccess(characterId);

      // Trigger download
      if (data.zipUrl) {
        const link = document.createElement("a");
        link.href = data.zipUrl;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Refresh to get updated export data
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingCharacterId(null);
    }
  };

  const getExportableCount = (group: GroupedAnimations) => {
    return group.animations.filter((a) => a.generatedSpritesheet).length;
  };

  return (
    <div className="min-h-screen grid-bg">
      <Header
        breadcrumb={[
          { label: "Dashboard", href: "/" },
          { label: "Export" },
        ]}
      >
        <Button
          onClick={loadData}
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
                  {isLoading ? "--" : exportableCount} exportable
                </span>
              </div>
              <div className="p-4 text-xs text-muted-foreground leading-relaxed">
                Export spritesheets and Aseprite-compatible metadata for web and Expo pipelines.
                Use &quot;Export All&quot; to bundle all animations for a character into a single ZIP.
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exportable</span>
                  <span className="metric-value">{isLoading ? "--" : exportableCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="tech-border bg-card p-4">
            <div className="flex items-center gap-6">
              <span className="text-xs text-muted-foreground tracking-wider">OPTIONS</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.normalize}
                  onChange={(e) =>
                    setExportOptions((prev) => ({ ...prev, normalize: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground">Normalize Canvas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.removeBackground}
                  onChange={(e) =>
                    setExportOptions((prev) => ({ ...prev, removeBackground: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground">Remove Background (AI)</span>
              </label>
              {exportOptions.removeBackground && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-muted-foreground">Mode</span>
                  <select
                    value={exportOptions.backgroundRemovalMode}
                    onChange={(event) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        backgroundRemovalMode:
                          event.target.value === "per-frame" ? "per-frame" : "spritesheet",
                      }))
                    }
                    className="terminal-input h-7 px-2 text-[10px] bg-card"
                  >
                    <option value="spritesheet">Spritesheet (fast)</option>
                    <option value="per-frame">Per-frame (accurate)</option>
                  </select>
                </label>
              )}
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
            <div className="space-y-6">
              {groupedAnimations.map((group) => {
                const characterId = group.character?.id || "unknown";
                const primaryRef = group.character?.referenceImages?.find((r) => r.isPrimary);
                const thumbnailUrl = primaryRef?.url || group.character?.workingReference?.url;
                const exportableInGroup = getExportableCount(group);
                const isExporting = exportingCharacterId === characterId;
                const justExported = exportSuccess === characterId;

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
                            {exportableInGroup}/{group.animations.length} exportable
                          </span>
                        </div>
                        {group.character && (
                          <p className="text-[10px] text-muted-foreground tracking-wider capitalize">
                            {group.character.style}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => handleExportAll(group)}
                        disabled={isExporting || exportableInGroup === 0}
                        className={`h-7 px-3 text-[9px] tracking-wider ${
                          justExported
                            ? "bg-success/20 border-success text-success"
                            : "bg-primary hover:bg-primary/80 text-primary-foreground"
                        }`}
                      >
                        {isExporting ? (
                          "EXPORTING..."
                        ) : justExported ? (
                          <span className="flex items-center gap-1">
                            <Check className="w-3 h-3" strokeWidth={2} />
                            EXPORTED
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" strokeWidth={2} />
                            EXPORT ALL
                          </span>
                        )}
                      </Button>
                    </div>
                    <div className="p-4">
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.animations.map((animation) => {
                          const hasExport = Boolean(animation.generatedSpritesheet);
                          const wasExported = Boolean(
                            animation.exports?.lastExportedAt || animation.exports?.zipBundleUrl
                          );

                          return (
                            <div
                              key={animation.id}
                              className={`border p-3 ${
                                hasExport
                                  ? "border-border/50 bg-background/50 hover-highlight"
                                  : "border-border/30 bg-background/20 opacity-60"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium truncate">{animation.name}</p>
                                <div className="flex items-center gap-1 ml-2">
                                  {wasExported && (
                                    <span title="Previously exported" aria-label="Previously exported">
                                      <Check
                                        className="w-3 h-3 text-success"
                                        strokeWidth={2}
                                        aria-hidden="true"
                                      />
                                    </span>
                                  )}
                                  <span
                                    className={`text-[9px] capitalize ${
                                      hasExport ? "text-success" : "text-muted-foreground"
                                    }`}
                                  >
                                    {hasExport ? "ready" : animation.status}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground tracking-wider capitalize mb-1">
                                {animation.style} · {animation.frameCount}f @ {animation.fps}fps
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {animation.frameWidth ?? animation.spriteSize}×
                                {animation.frameHeight ?? animation.spriteSize}px
                              </p>
                              <div className="mt-3">
                                <Link href={`/animations/${animation.id}`}>
                                  <Button
                                    variant="outline"
                                    className="w-full h-7 px-2 text-[9px] tracking-wider border-border hover:border-primary hover:text-primary"
                                  >
                                    {hasExport ? "EXPORT OPTIONS" : "OPEN"}
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
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
