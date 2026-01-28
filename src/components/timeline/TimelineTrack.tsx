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

type TrackKind = "keyframes" | "generated";

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
  const keyframesScrollRef = useRef<HTMLDivElement>(null);
  const generatedScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef<TrackKind | null>(null);
  const generatedFrames = animation.generatedFrames ?? [];

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = e.currentTarget.scrollLeft;
      const totalWidth = frameCount * frameWidth;
      if (totalWidth <= 0) return;
      const x = scrollLeft + e.clientX - rect.left;
      const frame = Math.floor((x / totalWidth) * frameCount);
      onFrameChange(Math.max(0, Math.min(frameCount - 1, frame)));
    },
    [frameCount, frameWidth, onFrameChange]
  );

  const syncScroll = useCallback((source: TrackKind) => {
    const sourceEl =
      source === "keyframes" ? keyframesScrollRef.current : generatedScrollRef.current;
    const targetEl =
      source === "keyframes" ? generatedScrollRef.current : keyframesScrollRef.current;
    if (!sourceEl || !targetEl) return;
    if (scrollSyncRef.current && scrollSyncRef.current !== source) return;
    scrollSyncRef.current = source;
    targetEl.scrollLeft = sourceEl.scrollLeft;
    requestAnimationFrame(() => {
      if (scrollSyncRef.current === source) {
        scrollSyncRef.current = null;
      }
    });
  }, []);

  const getKeyframeAtIndex = (index: number): Keyframe | undefined => {
    return animation.keyframes?.find((kf) => kf.frameIndex === index);
  };

  const getGeneratedFrameAtIndex = (index: number) => {
    return generatedFrames.find((frame) => frame.frameIndex === index);
  };

  const handleFrameContextMenu = (e: React.MouseEvent, frameIndex: number) => {
    e.preventDefault();
    setShowKeyframeMenu(showKeyframeMenu === frameIndex ? null : frameIndex);
  };

  const renderTrack = (kind: TrackKind, label: string) => {
    const isKeyframeTrack = kind === "keyframes";
    const scrollRef = isKeyframeTrack ? keyframesScrollRef : generatedScrollRef;

    return (
      <div className="flex items-start gap-3">
        <div className="w-20 pt-2 text-[10px] text-muted-foreground tracking-widest uppercase">
          {label}
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto cursor-pointer"
          onClick={handleTimelineClick}
          onMouseLeave={() => {
            if (isKeyframeTrack) {
              setShowKeyframeMenu(null);
            }
          }}
          onScroll={() => syncScroll(kind)}
        >
          <div
            className="flex relative"
            style={{ minWidth: frameCount * minFrameWidth }}
          >
            {Array.from({ length: frameCount }).map((_, i) => {
              const kf = isKeyframeTrack ? getKeyframeAtIndex(i) : undefined;
              const generated = !isKeyframeTrack
                ? getGeneratedFrameAtIndex(i)
                : undefined;
              const hasKeyframe = Boolean(kf);
              const hasGenerated = Boolean(generated?.url);
              const isCurrent = i === currentFrame;
              const thumbnailUrl = isKeyframeTrack ? kf?.image : generated?.url;

              return (
                <div
                  key={i}
                  className="flex-shrink-0 relative group"
                  style={{ width: frameWidth }}
                  onContextMenu={
                    isKeyframeTrack
                      ? (e) => handleFrameContextMenu(e, i)
                      : undefined
                  }
                  title={`Frame ${i}${
                    isKeyframeTrack && hasKeyframe
                      ? " (KEYFRAME)"
                      : !isKeyframeTrack && hasGenerated
                      ? " (GENERATED)"
                      : ""
                  } • ${Math.round(frameDuration)}ms`}
                >
                  <div
                    className={`h-8 border border-border transition-all ${
                      isCurrent
                        ? "bg-primary/30 border-primary"
                        : isKeyframeTrack
                        ? hasKeyframe
                          ? "bg-success/20 border-success/50"
                          : "hover:bg-muted/50"
                        : hasGenerated
                        ? "bg-primary/10 border-primary/40"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {isKeyframeTrack && hasKeyframe && (
                      <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-success flex items-center justify-center z-10 rounded-sm">
                        <KeyframeIcon
                          className="w-2 h-2 text-success-foreground"
                          strokeWidth={2.5}
                        />
                      </div>
                    )}

                    {thumbnailUrl && (
                      <div className="absolute inset-1 overflow-hidden opacity-60 bg-muted/20">
                        <img
                          src={thumbnailUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 text-[6px] text-center bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity">
                      {i}
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-primary" />
                  )}

                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border border-border text-[9px] text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 rounded">
                    Frame {i}
                    {isKeyframeTrack && hasKeyframe && " • Keyframe"}
                    {!isKeyframeTrack && hasGenerated && " • Generated"}
                    <br />
                    {Math.round(frameDuration * i)}ms
                  </div>

                  {isKeyframeTrack && showKeyframeMenu === i && (
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
      </div>
    );
  };

  return (
    <div className="px-4 py-3 space-y-3">
      {renderTrack("keyframes", "Keyframes")}
      {renderTrack("generated", "Generated")}
    </div>
  );
});
