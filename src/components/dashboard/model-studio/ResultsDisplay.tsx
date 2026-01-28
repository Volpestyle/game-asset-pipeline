"use client";

import { Download, MediaImageList } from "iconoir-react";

type StudioResult = {
  type: "video" | "image";
  videoUrl?: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  timestamp: number;
};

type ResultsDisplayProps = {
  results: StudioResult[];
  isLoading: boolean;
};

function downloadFile(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ResultsDisplay({ results, isLoading }: ResultsDisplayProps) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Generating...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <MediaImageList
            className="w-10 h-10 text-muted-foreground/50 mx-auto"
            strokeWidth={1}
          />
          <p className="text-xs text-muted-foreground">
            Generated outputs will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto">
      {results.map((result, index) => (
        <div
          key={result.timestamp}
          className="border border-border rounded overflow-hidden"
        >
          {result.type === "video" && result.videoUrl && (
            <div className="space-y-2">
              <div className="relative bg-black aspect-video">
                <video
                  src={result.videoUrl}
                  controls
                  loop
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      result.videoUrl!,
                      `studio_video_${result.timestamp}.mp4`
                    )
                  }
                  className="absolute bottom-2 right-2 px-2 py-1 text-[10px] flex items-center gap-1 bg-black/70 text-white rounded"
                  aria-label="Download video"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {result.type === "image" && result.imageUrls && (
            <div className="space-y-2">
              <div
                className={`grid gap-2 p-2 ${
                  result.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                }`}
              >
                {result.imageUrls.map((url, imgIndex) => (
                  <div key={imgIndex} className="relative group">
                    <img
                      src={url}
                      alt={`Generated ${imgIndex + 1}`}
                      className="w-full border border-border rounded"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(
                          url,
                          `studio_image_${result.timestamp}_${imgIndex}.png`
                        )
                      }
                      className="absolute bottom-2 right-2 px-2 py-1 text-[10px] flex items-center gap-1 bg-black/70 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Download image ${imgIndex + 1}`}
                    >
                      <Download className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-2 py-1.5 border-t border-border bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">
              {result.type === "video" ? "Video" : "Image"} #{results.length - index}
              {" - "}
              {new Date(result.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
