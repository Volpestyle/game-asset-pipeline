"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnimationState, StatePhase } from "../types";

interface InteractivePreviewProps {
  clip: AnimationState | null;
  stateName: string | null;
  phase: StatePhase;
  onClipComplete?: () => void;
}

const ZOOM_LEVELS = [1, 2, 4, 8];
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 16;

export function InteractivePreview({
  clip,
  stateName,
  phase,
  onClipComplete,
}: InteractivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentImageRef = useRef<HTMLImageElement | null>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [zoom, setZoom] = useState(2);

  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const animationCompleteRef = useRef(false);

  // Container size
  const containerSize = 320;

  // Load image for an animation
  const loadImage = useCallback(
    (animation: AnimationState): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        if (!animation.spritesheetUrl) {
          reject(new Error("No spritesheet URL"));
          return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load spritesheet"));
        img.src = animation.spritesheetUrl;
      });
    },
    []
  );

  // Load clip image
  useEffect(() => {
    if (!clip?.spritesheetUrl) {
      currentImageRef.current = null;
      return;
    }

    loadImage(clip)
      .then((img) => {
        currentImageRef.current = img;
      })
      .catch(() => {
        currentImageRef.current = null;
      });
  }, [clip, loadImage]);

  // Reset frame when animation changes - intentional state sync on prop change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCurrentFrame(0);
    animationCompleteRef.current = false;
  }, [clip?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Draw frame to canvas
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentImg = currentImageRef.current;
    const anim = clip;

    if (!currentImg || !anim) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = anim.frameWidth * zoom;
    const displayHeight = anim.frameHeight * zoom;

    // Set canvas size
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.scale(dpr, dpr);

    ctx.globalAlpha = 1;

    // Draw current clip
    const col = currentFrame % anim.columns;
    const row = Math.floor(currentFrame / anim.columns);
    const sx = col * anim.frameWidth;
    const sy = row * anim.frameHeight;

    ctx.drawImage(
      currentImg,
      sx,
      sy,
      anim.frameWidth,
      anim.frameHeight,
      0,
      0,
      displayWidth,
      displayHeight
    );

    // Reset scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [
    currentAnimation,
    currentFrame,
    clip,
    zoom,
  ]);

  // Animation loop
  useEffect(() => {
    if (!clip || !isPlaying) {
      return;
    }

    const tick = (timestamp: number) => {
      const frameDuration = 1000 / clip.fps;
      const elapsed = timestamp - lastFrameTimeRef.current;

      if (elapsed >= frameDuration) {
        // Advance frame
        setCurrentFrame((prev) => {
          const nextFrame = (prev + 1) % clip.frameCount;

          // Check for animation complete (looped back to 0)
          if (nextFrame === 0 && prev === clip.frameCount - 1) {
            if (!animationCompleteRef.current) {
              animationCompleteRef.current = true;
              requestAnimationFrame(() => {
                animationCompleteRef.current = false;
                onClipComplete?.();
              });
            }
          }

          return nextFrame;
        });

        lastFrameTimeRef.current = timestamp - (elapsed % frameDuration);
      }

      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    lastFrameTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    isPlaying,
    clip,
    onClipComplete,
    drawFrame,
  ]);

  // Initial draw
  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  const handleZoomIn = () => {
    setZoom((z) => Math.min(MAX_ZOOM, z * 2));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(MIN_ZOOM, z / 2));
  };

  const handleResetZoom = () => {
    setZoom(2);
  };

  const frameWidth = clip?.frameWidth ?? 64;
  const frameHeight = clip?.frameHeight ?? 64;
  const frameCount = clip?.frameCount ?? 1;
  const fps = clip?.fps ?? 12;

  return (
    <div className="tech-border bg-card h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tracking-wider">
            INTERACTIVE PREVIEW
          </span>
          <span className="text-[10px] text-muted-foreground">
            {stateName ?? "No state"} · {phase.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">
            {frameWidth}×{frameHeight}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-3">
        {/* Canvas container */}
        <div
          className="flex-1 relative border border-border bg-[#0a0a0a] overflow-hidden flex items-center justify-center"
          style={{ minHeight: containerSize }}
        >
          {/* Checkerboard background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #333 25%, transparent 25%),
                linear-gradient(-45deg, #333 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #333 75%),
                linear-gradient(-45deg, transparent 75%, #333 75%)
              `,
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          />

          {clip?.spritesheetUrl ? (
            <canvas
              ref={canvasRef}
              className="relative"
              style={{
                imageRendering: "pixelated",
                width: frameWidth * zoom,
                height: frameHeight * zoom,
              }}
            />
          ) : (
            <div className="text-xs text-muted-foreground">
              Select a state and assign clips to preview
            </div>
          )}

          {/* Help text overlay */}
          <div className="absolute bottom-2 left-2 right-2 text-center">
            <span className="text-[9px] text-muted-foreground/60 bg-background/80 px-2 py-1">
              Press configured keys to control
            </span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-between px-2 py-2 bg-secondary/30 border border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="size-3" />
              ) : (
                <Play className="size-3" />
              )}
            </Button>
            <span className="text-[10px] text-muted-foreground font-mono">
              {clip?.name?.toUpperCase() ?? "NONE"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              frame {String(currentFrame + 1).padStart(2, "0")}/{frameCount}
            </span>
            <span className="text-border">|</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {fps}fps
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleZoomOut}
              title="Zoom out"
            >
              <ZoomOut className="size-3" />
            </Button>

            <div className="flex items-center gap-0.5 px-1">
              {ZOOM_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setZoom(level)}
                  className={`px-1.5 py-0.5 text-[9px] font-mono transition-colors ${
                    Math.abs(zoom - level) < 0.5
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {level}x
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleZoomIn}
              title="Zoom in"
            >
              <ZoomIn className="size-3" />
            </Button>

            <div className="w-px h-4 bg-border mx-1" />

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleResetZoom}
              title="Reset view"
            >
              <RotateCcw className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
