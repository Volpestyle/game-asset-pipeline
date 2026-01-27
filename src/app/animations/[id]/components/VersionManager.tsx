"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import type { Animation, AnimationVersion } from "@/types";

type VersionManagerProps = {
  animationId: string;
  versions: AnimationVersion[];
  activeVersionId: string | null;
  onAnimationUpdate: (animation: Animation) => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
};

type VersionResponse = {
  animation: Animation;
  version?: AnimationVersion;
};

function formatVersionTimestamp(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function VersionManager({
  animationId,
  versions,
  activeVersionId,
  onAnimationUpdate,
  onMessage,
  onError,
}: VersionManagerProps) {
  const [versionName, setVersionName] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [versions]);

  const handleCreateVersion = async () => {
    if (!animationId) return;
    setIsWorking(true);
    onMessage(null);
    onError(null);
    try {
      const data = await requestJson<VersionResponse>(
        `/api/animations/${animationId}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: versionName.trim() || undefined,
          }),
          errorMessage: "Failed to create version.",
        }
      );
      onAnimationUpdate(data.animation);
      setVersionName("");
      onMessage(`Version saved (${data.version?.name ?? "new version"}).`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create version.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveVersion = async (versionId: string) => {
    if (!animationId) return;
    const ok = window.confirm("Overwrite this version with the current state?");
    if (!ok) return;
    setIsWorking(true);
    onMessage(null);
    onError(null);
    try {
      const data = await requestJson<VersionResponse>(
        `/api/animations/${animationId}/versions/${versionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          errorMessage: "Failed to save version.",
        }
      );
      onAnimationUpdate(data.animation);
      onMessage(`Version updated (${data.version?.name ?? "version"}).`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save version.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleLoadVersion = async (versionId: string) => {
    if (!animationId) return;
    const ok = window.confirm(
      "Load this version? Current keyframes and generated output will be replaced."
    );
    if (!ok) return;
    setIsWorking(true);
    onMessage(null);
    onError(null);
    try {
      const data = await requestJson<VersionResponse>(
        `/api/animations/${animationId}/versions/${versionId}/load`,
        {
          method: "POST",
          errorMessage: "Failed to load version.",
        }
      );
      onAnimationUpdate(data.animation);
      onMessage("Version loaded.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load version.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!animationId) return;
    const ok = window.confirm("Delete this version? This cannot be undone.");
    if (!ok) return;
    setIsWorking(true);
    onMessage(null);
    onError(null);
    try {
      const data = await requestJson<VersionResponse>(
        `/api/animations/${animationId}/versions/${versionId}`,
        {
          method: "DELETE",
          errorMessage: "Failed to delete version.",
        }
      );
      onAnimationUpdate(data.animation);
      onMessage("Version deleted.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete version.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">VERSIONS</span>
        <span className="text-[10px] text-muted-foreground">{versions.length} SAVES</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <input
            value={versionName}
            onChange={(event) => setVersionName(event.target.value)}
            placeholder="Version name (optional)"
            className="terminal-input w-full h-9 px-3 text-sm bg-card"
          />
          <Button
            onClick={handleCreateVersion}
            disabled={isWorking}
            className="h-9 px-3 bg-primary hover:bg-primary/80 text-primary-foreground text-[10px] tracking-wider"
          >
            {isWorking ? "SAVING" : "ADD"}
          </Button>
        </div>
        {versions.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            No versions saved yet. Creating a version snapshots keyframes and generated output.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedVersions.map((version) => {
              const isActive = activeVersionId === version.id;
              const label = version.updatedAt
                ? `Updated ${formatVersionTimestamp(version.updatedAt)}`
                : `Created ${formatVersionTimestamp(version.createdAt)}`;
              return (
                <div
                  key={version.id}
                  className={`border p-3 flex items-center justify-between gap-3 ${
                    isActive ? "border-primary/70 bg-primary/5" : "border-border"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{version.name}</span>
                      {isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 border border-primary text-primary">
                          ACTIVE
                        </span>
                      )}
                      {version.source === "generation" && (
                        <span className="text-[9px] px-1.5 py-0.5 border border-border text-muted-foreground">
                          AUTO
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleLoadVersion(version.id)}
                      className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                      disabled={isWorking}
                    >
                      LOAD
                    </button>
                    <button
                      onClick={() => handleSaveVersion(version.id)}
                      className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                      disabled={isWorking}
                    >
                      SAVE
                    </button>
                    <button
                      onClick={() => handleDeleteVersion(version.id)}
                      className="px-2 py-1 text-[10px] border border-destructive/60 text-destructive hover:border-destructive"
                      disabled={isWorking}
                    >
                      DEL
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
