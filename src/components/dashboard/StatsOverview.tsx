"use client";

import { useCallback, useEffect, useState } from "react";

type DashboardStats = {
  characters: number;
  animations: number;
  framesGenerated: number;
  exports: number;
};

type StatsInput = {
  characters?: number;
  animations?: number;
  framesGenerated?: number;
  exports?: number;
};

const EMPTY_STATS: DashboardStats = {
  characters: 0,
  animations: 0,
  framesGenerated: 0,
  exports: 0,
};

function toSafeCount(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function normalizeStats(stats: StatsInput | null | undefined) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    return null;
  }
  return {
    characters: toSafeCount(stats.characters),
    animations: toSafeCount(stats.animations),
    framesGenerated: toSafeCount(stats.framesGenerated),
    exports: toSafeCount(stats.exports),
  };
}

function formatMetric(value: number, showPlaceholder: boolean) {
  if (showPlaceholder) {
    return "--";
  }
  return value.toLocaleString();
}

export function StatsOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load stats (${response.status})`);
      }
      const payload = await response.json();
      const normalized = normalizeStats(payload?.stats);
      if (!normalized) {
        throw new Error("Invalid stats payload");
      }
      setStats(normalized);
    } catch (err) {
      console.error("Dashboard stats request failed", err);
      setError("Could not load dashboard stats.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const showPlaceholder = isLoading || stats === null;
  const values = stats ?? EMPTY_STATS;

  return (
    <div className="col-span-6 tech-border bg-card p-4">
      <div className="grid grid-cols-4 gap-4 h-full">
        <div className="border-r border-border pr-4">
          <p className="text-xs text-muted-foreground mb-1">Characters</p>
          <p className="text-2xl font-bold text-primary metric-value">
            {formatMetric(values.characters, showPlaceholder)}
          </p>
        </div>
        <div className="border-r border-border pr-4">
          <p className="text-xs text-muted-foreground mb-1">Animations</p>
          <p className="text-2xl font-bold metric-value">
            {formatMetric(values.animations, showPlaceholder)}
          </p>
        </div>
        <div className="border-r border-border pr-4">
          <p className="text-xs text-muted-foreground mb-1">Frames Generated</p>
          <p className="text-2xl font-bold metric-value">
            {formatMetric(values.framesGenerated, showPlaceholder)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Exports</p>
          <p className="text-2xl font-bold metric-value">
            {formatMetric(values.exports, showPlaceholder)}
          </p>
        </div>
      </div>
      {error ? (
        <div className="mt-3 text-[10px] text-destructive">{error}</div>
      ) : null}
    </div>
  );
}
