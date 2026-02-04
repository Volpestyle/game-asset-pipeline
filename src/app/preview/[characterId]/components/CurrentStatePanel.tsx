"use client";

import { Play, Star } from "lucide-react";
import type { AnimationState, PreviewState, StatePhase } from "../types";

interface CurrentStatePanelProps {
  currentState: PreviewState | null;
  currentClip: AnimationState | null;
  phase: StatePhase;
  isDefault: boolean;
}

export function CurrentStatePanel({
  currentState,
  currentClip,
  phase,
  isDefault,
}: CurrentStatePanelProps) {
  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs text-muted-foreground tracking-wider">
          STATE STATUS
        </span>
      </div>

      <div className="p-4 space-y-3">
        {currentState ? (
          <>
            {/* Current state display */}
            <div className="flex items-center gap-2">
              <Play className="size-4 text-primary" fill="currentColor" />
              <span className="text-sm font-medium text-foreground">
                {currentState.name}
              </span>
              {isDefault && (
                <Star className="size-3 text-warning" fill="currentColor" />
              )}
            </div>

            {/* Transition indicator */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="uppercase">{phase}</span>
              <span className="text-muted-foreground/60">•</span>
              <span className="text-foreground">
                {currentClip?.name ?? "No clip"}
              </span>
            </div>

            {/* Frame info */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frames</span>
                <span className="font-mono">
                  {currentClip?.frameCount ?? "--"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">FPS</span>
                <span className="font-mono">{currentClip?.fps ?? "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span className="font-mono">
                  {currentClip?.frameWidth ?? "--"}×{currentClip?.frameHeight ?? "--"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-mono">
                  {currentClip
                    ? ((currentClip.frameCount / currentClip.fps) * 1000).toFixed(0)
                    : "--"}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">
            No active state
          </div>
        )}
      </div>
    </div>
  );
}
