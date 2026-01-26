"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useRef, useState, memo } from "react";
import { Keyframe as KeyframeIcon, Xmark, OpenNewWindow } from "iconoir-react";
import type { Animation, Keyframe } from "@/types";

interface TimelineTrackProps {
  animation: Animation;
  currentFrame: number;
  onFrameChange: (frame: number) => void;
  onKeyframeAction?: (
    frameIndex: number,
    action: "set" | "regenerate" | "refine" | "clear"
  ) => void;
  frameCount: number;
  frameWidth: number;
  minFrameWidth: number;
  frameDuration: number;
}

export const TimelineTrack = memo(function TimelineTrack({
  animation,
  currentFrame,
  onFrameChange,
  onKeyframeAction,
  frameCount,
  frameWidth,
  minFrameWidth,
  frameDuration,
}: TimelineTrackProps) {
  const [showKeyframeMenu, setShowKeyframeMenu] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const generatedFrames = animation.generatedFrames ?? [];

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frame = Math.floor((x / rect.width) * frameCount);
      onFrameChange(Math.max(0, Math.min(frameCount - 1, frame)));
    },
    [frameCount, onFrameChange]
  );

  const getKeyframeAtIndex = (index: number): Keyframe | undefined => {
    return animation.keyframes?.find((kf) => kf.frameIndex === index);
  };

  const getGeneratedFrameAtIndex = (index: number) => {
    return generatedFrames.find((frame) => frame.frameIndex === index);
  };

  const isKeyframe = (index: number): boolean => {
    return animation.keyframes?.some((kf) => kf.frameIndex === index) ?? false;
  };

  const handleFrameContextMenu = (e: React.MouseEvent, frameIndex: number) => {
    e.preventDefault();
    setShowKeyframeMenu(showKeyframeMenu === frameIndex ? null : frameIndex);
  };

  return (
    <div
      ref={timelineRef}
      className="px-4 py-3 overflow-x-auto cursor-pointer"
      onClick={handleTimelineClick}
      onMouseLeave={() => setShowKeyframeMenu(null)}
    >
      <div
        className="flex relative"
        style={{ minWidth: frameCount * minFrameWidth }}
      >
        {Array.from({ length: frameCount }).map((_, i) => {
          const kf = getKeyframeAtIndex(i);
          const generated = getGeneratedFrameAtIndex(i);
          const hasKeyframe = isKeyframe(i);
          const isCurrent = i === currentFrame;

          return (
            <div
              key={i}
              className="flex-shrink-0 relative group"
              style={{ width: frameWidth }}
              onContextMenu={(e) => handleFrameContextMenu(e, i)}
              title={`Frame ${i}${
                hasKeyframe ? " (KEYFRAME)" : ""
              } • ${Math.round(frameDuration)}ms`}
            >
              {/* Frame cell */}
              <div
                className={`h-8 border border-border transition-all ${
                  isCurrent
                    ? "bg-primary/30 border-primary"
                    : hasKeyframe
                    ? "bg-success/20 border-success/50"
                    : "hover:bg-muted/50"
                }`}
              >
                {/* Keyframe badge */}
                {hasKeyframe && (
                  <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-success flex items-center justify-center z-10 rounded-sm">
                    <KeyframeIcon
                      className="w-2 h-2 text-success-foreground"
                      strokeWidth={2.5}
                    />
                  </div>
                )}

                {/* Frame thumbnail preview */}
                {(generated?.url || kf?.image) && (
                  <div className="absolute inset-1 overflow-hidden opacity-60 bg-muted/20">
                    <img
                      src={generated?.url ?? kf?.image ?? ""}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* Frame index overlay on hover */}
                <div className="absolute bottom-0 left-0 right-0 text-[6px] text-center bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity">
                  {i}
                </div>
              </div>

              {/* Playhead indicator */}
              {isCurrent && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-primary" />
              )}

              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border border-border text-[9px] text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 rounded">
                Frame {i}
                {hasKeyframe && " • Keyframe"}
                <br />
                {Math.round(frameDuration * i)}ms
              </div>

              {/* Context menu */}
              {showKeyframeMenu === i && (
                <div className="absolute top-full left-0 z-50 mt-1 tech-border bg-card p-1 min-w-[140px] shadow-lg">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onKeyframeAction?.(i, hasKeyframe ? "regenerate" : "set");
                      setShowKeyframeMenu(null);
                    }}
                    className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <OpenNewWindow className="w-3 h-3" strokeWidth={2} />
                    {hasKeyframe ? "OPEN KEYFRAME" : "SET KEYFRAME"}
                  </button>
                  {hasKeyframe && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onKeyframeAction?.(i, "refine");
                          setShowKeyframeMenu(null);
                        }}
                        className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <KeyframeIcon className="w-3 h-3" strokeWidth={2} />
                        OPEN FOR REFINE
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onKeyframeAction?.(i, "clear");
                          setShowKeyframeMenu(null);
                        }}
                        className="w-full px-2 py-1.5 text-left text-[10px] text-destructive hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <Xmark className="w-3 h-3" strokeWidth={2} />
                        CLEAR
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
