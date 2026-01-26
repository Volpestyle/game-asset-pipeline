"use client";

import {
  getVideoSizeOptions,
  isSizeValidForModel,
  getVideoModelLabel,
} from "@/lib/ai/soraConstraints";

export const EXTRACT_FPS_OPTIONS = [6, 8, 12];

export type LoopMode = "loop" | "pingpong";

export function getExpectedFrameCount(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(fps)) return 0;
  return Math.max(1, Math.round(seconds * fps));
}

interface ModelConstraintsProps {
  generationSize: string;
  generationModel: string;
  onSizeChange: (size: string) => void;
  frameWidth: number;
  frameHeight: number;
}

export function ModelConstraints({
  generationSize,
  generationModel,
  onSizeChange,
  frameWidth,
  frameHeight,
}: ModelConstraintsProps) {
  const sizeOptions = getVideoSizeOptions(generationModel);
  const isValidSize = isSizeValidForModel(generationSize, generationModel);
  const modelLabel = getVideoModelLabel(generationModel);

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          Video Constraints
        </span>
        <span className="text-[10px] text-primary">{modelLabel}</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground tracking-wider">
              Video Size
            </span>
            {!isValidSize && (
              <span className="text-[10px] text-destructive">Invalid</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((size) => (
              <button
                key={size}
                onClick={() => onSizeChange(size)}
                className={`px-3 py-1 text-xs border transition-colors ${
                  generationSize === size
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          {!isValidSize && (
            <p className="text-[10px] text-destructive">
              Select a supported video resolution for {modelLabel}.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground tracking-wider">
              Sprite Frame
            </span>
            <span className="text-[10px] text-primary">Locked</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold metric-value">
              {frameWidth}×{frameHeight}
            </span>
            <span className="text-[10px] text-muted-foreground">px</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Frame size is derived from the character reference. Adjust the character
            reference if you need a different base dimension.
          </p>
        </div>
      </div>
    </div>
  );
}
