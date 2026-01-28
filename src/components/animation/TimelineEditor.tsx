"use client";

import { useEffect, useRef, useState } from "react";
import type { Animation } from "@/types";
import {
  TimelineControls,
  TimelineRuler,
  TimelineTrack,
} from "@/components/timeline";

interface TimelineEditorProps {
  animation: Animation;
  currentFrame: number;
  onFrameChange: (frame: number) => void;
  onKeyframeAction?: (
    frameIndex: number,
    action: "set" | "regenerate" | "refine" | "clear"
  ) => void;
}

export function TimelineEditor({
  animation,
  currentFrame,
  onFrameChange,
  onKeyframeAction,
}: TimelineEditorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameRef = useRef(currentFrame);

  // Keep frameRef in sync with currentFrame prop
  useEffect(() => {
    frameRef.current = currentFrame;
  }, [currentFrame]);

  const generatedFrames = animation.generatedFrames ?? [];
  const generatedCount =
    generatedFrames.length > 0 ? generatedFrames.length : undefined;
  const frameCount = Math.max(
    1,
    animation.actualFrameCount ?? generatedCount ?? animation.frameCount ?? 1
  );
  const frameDuration = 1000 / animation.fps;

  // Playback loop using requestAnimationFrame for smooth, consistent timing
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (timestamp: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;

      if (elapsed >= frameDuration) {
        const nextFrame = (frameRef.current + 1) % frameCount;
        frameRef.current = nextFrame;
        onFrameChange(nextFrame);
        lastFrameTimeRef.current = timestamp - (elapsed % frameDuration);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    lastFrameTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, frameCount, frameDuration, onFrameChange]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case "ArrowLeft":
          e.preventDefault();
          onFrameChange((currentFrame - 1 + frameCount) % frameCount);
          break;
        case "ArrowRight":
          e.preventDefault();
          onFrameChange((currentFrame + 1) % frameCount);
          break;
        case "Home":
          e.preventDefault();
          onFrameChange(0);
          break;
        case "End":
          e.preventDefault();
          onFrameChange(frameCount - 1);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFrame, frameCount, onFrameChange]);

  // Calculate frame width
  const minFrameWidth = 24;
  const maxFrameWidth = 48;
  const frameWidth = Math.max(
    minFrameWidth,
    Math.min(maxFrameWidth, 800 / frameCount)
  );

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          Timeline
        </span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Frame {String(currentFrame).padStart(3, "0")} /{" "}
            {String(frameCount - 1).padStart(3, "0")}
          </span>
          <span className="w-px h-3 bg-border" />
          <span>{animation.fps} FPS</span>
        </div>
      </div>

      <TimelineControls
        currentFrame={currentFrame}
        frameCount={frameCount}
        isPlaying={isPlaying}
        onFrameChange={onFrameChange}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
      />

      <TimelineRuler
        frameCount={frameCount}
        frameWidth={frameWidth}
        minFrameWidth={minFrameWidth}
      />

      <TimelineTrack
        animation={animation}
        currentFrame={currentFrame}
        onFrameChange={onFrameChange}
        onKeyframeAction={onKeyframeAction}
        frameCount={frameCount}
        frameWidth={frameWidth}
        minFrameWidth={minFrameWidth}
        frameDuration={frameDuration}
      />

      {/* Keyframe summary */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-success" />
          Keyframes: {animation.keyframes?.length ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-primary" />
          Current: {currentFrame}
        </span>
        {animation.actualFrameCount &&
          animation.actualFrameCount !== animation.frameCount && (
            <span className="text-warning">
              Model output: {animation.actualFrameCount} frames (requested:{" "}
              {animation.frameCount})
            </span>
          )}
      </div>
    </div>
  );
}
