"use client";

import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  NavArrowLeft,
  NavArrowRight,
  SkipPrev,
  SkipNext,
} from "iconoir-react";

interface TimelineControlsProps {
  currentFrame: number;
  frameCount: number;
  isPlaying: boolean;
  onFrameChange: (frame: number) => void;
  onTogglePlay: () => void;
}

export function TimelineControls({
  currentFrame,
  frameCount,
  isPlaying,
  onFrameChange,
  onTogglePlay,
}: TimelineControlsProps) {
  return (
    <div className="px-4 py-2 border-b border-border flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFrameChange(0)}
        className="h-7 w-7 p-0 border-border hover:border-primary hover:text-primary"
        title="Jump to start (Home)"
      >
        <SkipPrev className="w-3.5 h-3.5" strokeWidth={2} />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onFrameChange((currentFrame - 1 + frameCount) % frameCount)
        }
        className="h-7 w-7 p-0 border-border hover:border-primary hover:text-primary"
        title="Previous frame (←)"
      >
        <NavArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
      </Button>
      <Button
        size="sm"
        onClick={onTogglePlay}
        className={`h-7 w-7 p-0 ${
          isPlaying
            ? "bg-warning text-warning-foreground hover:bg-warning/80"
            : "bg-primary hover:bg-primary/80 text-primary-foreground"
        }`}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5" strokeWidth={2} />
        ) : (
          <Play className="w-3.5 h-3.5" strokeWidth={2} />
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFrameChange((currentFrame + 1) % frameCount)}
        className="h-7 w-7 p-0 border-border hover:border-primary hover:text-primary"
        title="Next frame (→)"
      >
        <NavArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFrameChange(frameCount - 1)}
        className="h-7 w-7 p-0 border-border hover:border-primary hover:text-primary"
        title="Jump to end (End)"
      >
        <SkipNext className="w-3.5 h-3.5" strokeWidth={2} />
      </Button>
      <div className="ml-auto text-[10px] text-muted-foreground">
        SPACE: play/pause | ARROWS: step | HOME/END: jump
      </div>
    </div>
  );
}
