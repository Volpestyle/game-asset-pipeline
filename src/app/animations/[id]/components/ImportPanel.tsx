"use client";

import { useCallback, useState } from "react";
import { CloudUpload } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestFormData } from "@/lib/api/client";
import type { Animation } from "@/types";

type ImportPanelProps = {
  animationId: string;
  animation: Animation;
  onAnimationUpdate: (animation: Animation) => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
};

type VideoMeta = {
  duration: number;
  width: number;
  height: number;
};

type ImportResponse = {
  animation: Animation;
};

export function ImportPanel({
  animationId,
  animation,
  onAnimationUpdate,
  onMessage,
  onError,
}: ImportPanelProps) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSkipRoi, setImportSkipRoi] = useState(true);
  const [importDragOver, setImportDragOver] = useState(false);
  const [importVideoMeta, setImportVideoMeta] = useState<VideoMeta | null>(null);

  const displayFrameWidth = Number(animation.frameWidth ?? animation.spriteSize ?? 0);
  const displayFrameHeight = Number(animation.frameHeight ?? animation.spriteSize ?? 0);

  const handleImportVideo = async () => {
    if (!importFile) return;
    const ok = window.confirm(
      "Import this video? This will replace generated frames, spritesheet, and exports."
    );
    if (!ok) return;
    setIsImporting(true);
    onMessage(null);
    onError(null);
    try {
      const formData = new FormData();
      formData.append("video", importFile, importFile.name);
      if (importSkipRoi) {
        formData.append("skipRoi", "true");
      }

      const data = await requestFormData<ImportResponse>(
        `/api/animations/${animationId}/import-video`,
        formData,
        { errorMessage: "Import failed." }
      );
      onAnimationUpdate(data.animation);
      setImportFile(null);
      setImportVideoMeta(null);
      onMessage("Video imported.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFileSelect = useCallback((file: File | null) => {
    setImportFile(file);
    setImportVideoMeta(null);
    if (!file) return;

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setImportVideoMeta({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  }, []);

  const handleImportDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setImportDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "video/mp4") {
        handleImportFileSelect(file);
      }
    },
    [handleImportFileSelect]
  );

  const handleImportDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(true);
  }, []);

  const handleImportDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
  }, []);

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">IMPORT VIDEO</span>
        <div className="flex gap-2 text-[10px]">
          <a
            href="https://sora.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            sora
          </a>
          <span className="text-muted-foreground">·</span>
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            gemini
          </a>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div
          className={cn(
            "drop-zone p-4 cursor-pointer transition-all duration-150",
            importDragOver && "drag-over",
            isImporting && "opacity-50 pointer-events-none"
          )}
          onDrop={handleImportDrop}
          onDragOver={handleImportDragOver}
          onDragLeave={handleImportDragLeave}
          onClick={() => document.getElementById("import-video-input")?.click()}
        >
          <input
            id="import-video-input"
            type="file"
            accept="video/mp4"
            className="hidden"
            onChange={(e) => handleImportFileSelect(e.target.files?.[0] ?? null)}
            disabled={isImporting}
          />
          <div className="text-center space-y-2">
            <div className="w-10 h-10 mx-auto border border-border flex items-center justify-center">
              <CloudUpload className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-foreground">Drop MP4 here</p>
              <p className="text-[10px] text-muted-foreground">or click to browse</p>
            </div>
          </div>
        </div>

        {importFile && (
          <div className="border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium truncate flex-1 mr-2">{importFile.name}</p>
              <button
                onClick={() => {
                  setImportFile(null);
                  setImportVideoMeta(null);
                }}
                className="text-[10px] text-muted-foreground hover:text-destructive"
              >
                CLEAR
              </button>
            </div>
            {importVideoMeta && (
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>{importVideoMeta.duration.toFixed(1)}s</span>
                <span>
                  {importVideoMeta.width}×{importVideoMeta.height}
                </span>
                <span>
                  ~
                  {Math.ceil(
                    importVideoMeta.duration * Number(animation.extractFps ?? animation.fps ?? 12)
                  )}{" "}
                  frames
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span>FPS: {animation.extractFps ?? animation.fps ?? 12}</span>
          <span>Loop: {animation.loopMode ?? "pingpong"}</span>
          <span>
            Size: {displayFrameWidth}×{displayFrameHeight}
          </span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={importSkipRoi}
            onChange={(e) => setImportSkipRoi(e.target.checked)}
            className="w-3.5 h-3.5 accent-primary"
          />
          <span className="text-[10px] text-muted-foreground">
            Use full frame (skip ROI crop)
          </span>
        </label>

        <Button
          onClick={handleImportVideo}
          disabled={!importFile || isImporting}
          className="w-full h-9 bg-primary hover:bg-primary/80 text-primary-foreground text-[10px] tracking-wider"
        >
          {isImporting ? "IMPORTING..." : "IMPORT MP4"}
        </Button>

        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Generate with Sora or Gemini, download, and import here. Aspect ratio is preserved; video
          is centered with transparent padding if needed.
        </p>
      </div>
    </div>
  );
}
