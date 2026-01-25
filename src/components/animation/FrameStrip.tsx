"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useEffect } from "react";
import { Keyframe as KeyframeIcon } from "iconoir-react";
import type { Animation } from "@/types";

interface FrameStripProps {
  animation: Animation;
  currentFrame: number;
  onFrameChange: (frame: number) => void;
}

export function FrameStrip({
  animation,
  currentFrame,
  onFrameChange,
}: FrameStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const generatedFrames = animation.generatedFrames ?? [];
  const generatedCount =
    generatedFrames.length > 0 ? generatedFrames.length : undefined;
  const frameCount = Math.max(
    1,
    animation.actualFrameCount ?? generatedCount ?? animation.frameCount ?? 1
  );

  const isKeyframe = (index: number): boolean => {
    return animation.keyframes?.some((kf) => kf.frameIndex === index) ?? false;
  };

  const getFrameImage = (index: number): string | undefined => {
    const generated = generatedFrames.find((f) => f.frameIndex === index);
    if (generated?.url) return generated.url;
    const kf = animation.keyframes?.find((k) => k.frameIndex === index);
    return kf?.image;
  };

  // Auto-scroll to keep current frame visible
  useEffect(() => {
    const frameEl = frameRefs.current.get(currentFrame);
    if (frameEl && scrollRef.current) {
      const container = scrollRef.current;
      const frameRect = frameEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      if (
        frameRect.left < containerRect.left ||
        frameRect.right > containerRect.right
      ) {
        frameEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [currentFrame]);

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          Frame Gallery
        </span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-success" />
            {animation.keyframes?.length ?? 0} Keyframes
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-primary" />
            Frame {currentFrame + 1} of {frameCount}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="p-3 overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        <div className="flex gap-2">
          {Array.from({ length: frameCount }).map((_, index) => {
            const hasKeyframe = isKeyframe(index);
            const isCurrent = index === currentFrame;
            const image = getFrameImage(index);

            return (
              <button
                key={index}
                ref={(el) => {
                  if (el) frameRefs.current.set(index, el);
                  else frameRefs.current.delete(index);
                }}
                onClick={() => onFrameChange(index)}
                className={`relative flex-shrink-0 w-12 h-12 border-2 transition-all duration-150 group ${
                  isCurrent
                    ? "border-primary bg-primary/20 ring-2 ring-primary/30"
                    : hasKeyframe
                    ? "border-success/60 bg-success/10 hover:border-success"
                    : "border-border bg-card hover:border-muted-foreground"
                }`}
                title={`Frame ${index}${hasKeyframe ? " (Keyframe)" : ""}`}
              >
                {/* Frame thumbnail */}
                {image ? (
                  <img
                    src={image}
                    alt={`Frame ${index}`}
                    className="w-full h-full object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                    {index}
                  </div>
                )}

                {/* Keyframe badge */}
                {hasKeyframe && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-success border border-background flex items-center justify-center rounded-sm">
                    <KeyframeIcon className="w-2.5 h-2.5 text-success-foreground" strokeWidth={2.5} />
                  </div>
                )}

                {/* Frame index overlay */}
                <div
                  className={`absolute bottom-0 left-0 right-0 text-[8px] text-center py-0.5 ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/80 text-muted-foreground"
                  }`}
                >
                  {String(index).padStart(3, "0")}
                </div>

                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border text-[9px] text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Frame {index}
                  {hasKeyframe && " • Keyframe"}
                  <br />
                  {Math.round((1000 / animation.fps) * index)}ms
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
