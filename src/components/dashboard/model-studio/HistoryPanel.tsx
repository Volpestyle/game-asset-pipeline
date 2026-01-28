"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, MediaImageList, NavArrowDown, NavArrowUp } from "iconoir-react";
import type { StudioHistoryEntry, StudioHistoryPage } from "@/types/studio";

type HistoryPanelProps = {
  refreshToken: number;
};

type HistoryFetchState = {
  items: StudioHistoryEntry[];
  nextOffset: number | null;
  total: number;
};

const PAGE_LIMIT = 12;
const SCROLL_THRESHOLD = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHistoryEntry(value: unknown): value is StudioHistoryEntry {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (value.modelCategory !== "video" && value.modelCategory !== "image") return false;
  if (typeof value.modelId !== "string") return false;
  if (typeof value.createdAt !== "string") return false;
  if (!isRecord(value.result)) return false;
  const result = value.result;
  if (result.imageUrls !== undefined && !Array.isArray(result.imageUrls)) {
    return false;
  }
  if (result.videoUrl !== undefined && typeof result.videoUrl !== "string") {
    return false;
  }
  if (result.thumbnailUrl !== undefined && typeof result.thumbnailUrl !== "string") {
    return false;
  }
  return true;
}

function parseHistoryPage(value: unknown): StudioHistoryPage | null {
  if (!isRecord(value)) return null;
  const itemsValue = value.items;
  const nextOffsetValue = value.nextOffset;
  const totalValue = value.total;
  if (!Array.isArray(itemsValue) || typeof totalValue !== "number") return null;
  const items = itemsValue.filter(isHistoryEntry);
  const nextOffset =
    typeof nextOffsetValue === "number" ? nextOffsetValue : null;
  return {
    items,
    nextOffset,
    total: totalValue,
  };
}

function downloadFile(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function HistoryPanel({ refreshToken }: HistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryFetchState>({
    items: [],
    nextOffset: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = useCallback(
    async (offset: number, reset: boolean) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/studio/history?offset=${offset}&limit=${PAGE_LIMIT}`
        );
        const data = await response.json();
        if (!response.ok) {
          const message =
            isRecord(data) && typeof data.error === "string"
              ? data.error
              : "Failed to load history.";
          throw new Error(message);
        }
        const parsed = parseHistoryPage(data);
        if (!parsed) {
          throw new Error("Invalid history response.");
        }
        setHistory((prev) => ({
          items: reset ? parsed.items : [...prev.items, ...parsed.items],
          nextOffset: parsed.nextOffset,
          total: parsed.total,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history.");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (history.items.length === 0) {
      loadHistory(0, true);
    }
  }, [isOpen, history.items.length, loadHistory]);

  useEffect(() => {
    if (!isOpen) return;
    if (refreshToken === 0) return;
    loadHistory(0, true);
  }, [refreshToken, isOpen, loadHistory]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || isLoading) return;
    if (history.nextOffset === null) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD) {
      loadHistory(history.nextOffset, false);
    }
  }, [history.nextOffset, isLoading, loadHistory]);

  const emptyState =
    !isLoading && history.items.length === 0 && !error ? (
      <div className="p-4 text-center text-xs text-muted-foreground">
        No Model Studio history yet.
      </div>
    ) : null;

  return (
    <div className="border border-border rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3 py-2 text-xs flex items-center justify-between bg-secondary/40 hover:bg-secondary/60 transition-colors"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <MediaImageList className="w-4 h-4" strokeWidth={1.5} />
          History ({history.total})
        </span>
        {isOpen ? (
          <NavArrowUp className="w-4 h-4" strokeWidth={2} />
        ) : (
          <NavArrowDown className="w-4 h-4" strokeWidth={2} />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border">
          {error && (
            <div className="p-3 bg-destructive/10 border-b border-destructive/30">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="max-h-[320px] overflow-y-auto space-y-3 p-3"
          >
            {history.items.map((entry) => (
              <div
                key={entry.id}
                className="border border-border rounded overflow-hidden bg-card/40"
              >
                {entry.result.videoUrl && (
                  <div className="relative bg-black aspect-video">
                    <video
                      src={entry.result.videoUrl}
                      controls
                      loop
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(
                          entry.result.videoUrl!,
                          `studio_video_${entry.id}.mp4`
                        )
                      }
                      className="absolute bottom-2 right-2 px-2 py-1 text-[10px] flex items-center gap-1 bg-black/70 text-white rounded"
                      aria-label="Download video"
                    >
                      <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                )}

                {entry.result.imageUrls && (
                  <div
                    className={`grid gap-2 p-2 ${
                      entry.result.imageUrls.length === 1
                        ? "grid-cols-1"
                        : "grid-cols-2"
                    }`}
                  >
                    {entry.result.imageUrls.map((url, index) => (
                      <div key={`${entry.id}-${index}`} className="relative group">
                        <img
                          src={url}
                          alt={`History ${index + 1}`}
                          className="w-full border border-border rounded"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            downloadFile(url, `studio_image_${entry.id}_${index}.png`)
                          }
                          className="absolute bottom-2 right-2 px-2 py-1 text-[10px] flex items-center gap-1 bg-black/70 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Download image ${index + 1}`}
                        >
                          <Download className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="px-2 py-1.5 border-t border-border bg-secondary/20">
                  <p className="text-[10px] text-muted-foreground">
                    {entry.modelCategory === "video" ? "Video" : "Image"} ·{" "}
                    {entry.modelId} ·{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}

            {emptyState}

            {isLoading && (
              <div className="py-2 text-center text-xs text-muted-foreground">
                Loading history...
              </div>
            )}

            {!isLoading && history.nextOffset === null && history.items.length > 0 && (
              <div className="py-2 text-center text-[10px] text-muted-foreground">
                End of history.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
