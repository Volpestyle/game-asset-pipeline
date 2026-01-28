"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Move } from "lucide-react";
import type { Animation } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FramePreviewProps {
  animation: Animation;
  currentFrame: number;
  showComparison?: boolean;
  referenceImageUrl?: string | null;
}

const ZOOM_LEVELS = [1, 2, 4, 8, 16];
const PREVIEW_SIZES = [192, 256, 320];
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 32;

type ZoomControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onSetZoom: (value: number) => void;
};

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onSetZoom,
}: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-xs" onClick={onZoomOut} title="Zoom out">
        <ZoomOut className="size-3" />
      </Button>

      <div className="flex items-center gap-0.5 px-1">
        {ZOOM_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onSetZoom(level)}
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

      <Button variant="ghost" size="icon-xs" onClick={onZoomIn} title="Zoom in">
        <ZoomIn className="size-3" />
      </Button>

      <div className="w-px h-4 bg-border mx-1" />

      <Button variant="ghost" size="icon-xs" onClick={onReset} title="Reset view">
        <RotateCcw className="size-3" />
      </Button>
    </div>
  );
}

type FrameCanvasProps = {
  spritesheetUrl?: string;
  isLoaded: boolean;
  error: string | null;
  generatedFrameUrl?: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  currentZoom: number;
  offset: { x: number; y: number };
  frameWidth: number;
  frameHeight: number;
  containerSize: number;
  isPanning: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
};

function FrameCanvas({
  spritesheetUrl,
  isLoaded,
  error,
  generatedFrameUrl,
  canvasRef,
  containerRef,
  currentZoom,
  offset,
  frameWidth,
  frameHeight,
  containerSize,
  isPanning,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: FrameCanvasProps) {
  return (
    <div
      ref={containerRef}
      className={`
        relative border border-border bg-[#0a0a0a] overflow-hidden
        ${isPanning ? "cursor-grabbing" : "cursor-grab"}
      `}
      style={{ width: containerSize, height: containerSize }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Checkerboard background for transparency */}
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

      {spritesheetUrl ? (
        isLoaded ? (
          <canvas
            ref={canvasRef}
            className="absolute"
            style={{
              imageRendering: "pixelated",
              width: Math.round(frameWidth * currentZoom),
              height: Math.round(frameHeight * currentZoom),
              left: 0,
              top: 0,
              transform: `translate3d(${Math.round((containerSize - frameWidth * currentZoom) / 2 + offset.x)}px, ${Math.round((containerSize - frameHeight * currentZoom) / 2 + offset.y)}px, 0)`,
              willChange: "transform",
            }}
          />
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-destructive">{error}</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground animate-pulse">
              Loading...
            </span>
          </div>
        )
      ) : generatedFrameUrl ? (
        <img
          src={generatedFrameUrl}
          alt="Frame preview"
          className="absolute"
          style={{
            imageRendering: "pixelated",
            width: Math.round(frameWidth * currentZoom),
            height: Math.round(frameHeight * currentZoom),
            left: 0,
            top: 0,
            transform: `translate3d(${Math.round((containerSize - frameWidth * currentZoom) / 2 + offset.x)}px, ${Math.round((containerSize - frameHeight * currentZoom) / 2 + offset.y)}px, 0)`,
            willChange: "transform",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">
            Generate animation first
          </span>
        </div>
      )}

      {/* Pan indicator */}
      {(offset.x !== 0 || offset.y !== 0) && (
        <div className="absolute bottom-1 left-1 flex items-center gap-1 text-[9px] text-muted-foreground bg-background/80 px-1 py-0.5">
          <Move className="size-2.5" />
          Pan active
        </div>
      )}
    </div>
  );
}

export function FramePreview({
  animation,
  currentFrame,
  showComparison = false,
  referenceImageUrl,
}: FramePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);
  const [modalZoomOverride, setModalZoomOverride] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewSize, setPreviewSize] = useState(() => {
    if (typeof window === "undefined") return 256;
    const stored = window.localStorage?.getItem("framePreviewSize");
    if (!stored) return 256;
    const parsed = Number(stored);
    return Number.isFinite(parsed) && PREVIEW_SIZES.includes(parsed) ? parsed : 256;
  });
  const [isPanning, setIsPanning] = useState(false);
  const [activePan, setActivePan] = useState<"main" | "modal">("main");
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0, frame: currentFrame });
  const [modalPanOffset, setModalPanOffset] = useState({
    x: 0,
    y: 0,
    frame: currentFrame,
  });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const spritesheetUrl = animation.generatedSpritesheet;
  const generatedFrame = animation.generatedFrames?.find(
    (frame) => frame.frameIndex === currentFrame
  );
  const keyframe = animation.keyframes?.find((kf) => kf.frameIndex === currentFrame);
  const startOverride =
    typeof animation.generationStartImageUrl === "string"
      ? animation.generationStartImageUrl
      : null;
  const fallbackFrameUrl =
    currentFrame === 0 ? startOverride ?? referenceImageUrl ?? undefined : undefined;
  const resolvedFrameUrl = generatedFrame?.url ?? keyframe?.image ?? fallbackFrameUrl;
  const layout = animation.spritesheetLayout;
  const frameWidth =
    layout?.frameWidth ?? layout?.frameSize ?? animation.frameWidth ?? animation.spriteSize;
  const frameHeight =
    layout?.frameHeight ?? layout?.frameSize ?? animation.frameHeight ?? animation.spriteSize;
  const generatedCount =
    animation.generatedFrames && animation.generatedFrames.length > 0
      ? animation.generatedFrames.length
      : undefined;
  const resolvedFrameCount =
    animation.actualFrameCount ?? generatedCount ?? animation.frameCount ?? 1;
  const safeFrameCount = Math.max(1, resolvedFrameCount);
  const columns =
    layout?.columns && layout.columns > 0
      ? layout.columns
      : Math.max(1, Math.ceil(Math.sqrt(safeFrameCount)));

  // Calculate fit zoom to contain the frame within the preview container
  const fitZoom = useMemo(() => {
    if (!frameWidth || !frameHeight) return 1;
    const fit = Math.min(previewSize / frameWidth, previewSize / frameHeight);
    // Round to a nice value for pixel art
    if (fit >= 1) {
      return Math.floor(fit);
    }
    return fit;
  }, [previewSize, frameWidth, frameHeight]);

  const modalFitZoom = useMemo(() => {
    if (!frameWidth || !frameHeight) return 2;
    const fit = Math.min(512 / frameWidth, 512 / frameHeight);
    if (fit >= 1) {
      return Math.floor(fit);
    }
    return fit;
  }, [frameWidth, frameHeight]);

  // Use override if set, otherwise use fit zoom
  const zoom = zoomOverride ?? fitZoom;
  const modalZoom = modalZoomOverride ?? modalFitZoom;

  const setZoom = (value: number | ((prev: number) => number)) => {
    setZoomOverride((prev) => {
      const current = prev ?? fitZoom;
      return typeof value === "function" ? value(current) : value;
    });
  };

  const setModalZoom = (value: number | ((prev: number) => number)) => {
    setModalZoomOverride((prev) => {
      const current = prev ?? modalFitZoom;
      return typeof value === "function" ? value(current) : value;
    });
  };

  const isLoaded = !!spritesheetUrl && loadedUrl === spritesheetUrl && !loadError;
  const error = loadedUrl === spritesheetUrl ? loadError : null;

  const resolvedPanOffset = useMemo(
    () =>
      panOffset.frame === currentFrame
        ? { x: panOffset.x, y: panOffset.y }
        : { x: 0, y: 0 },
    [panOffset, currentFrame]
  );
  const resolvedModalPanOffset = useMemo(
    () =>
      modalPanOffset.frame === currentFrame
        ? { x: modalPanOffset.x, y: modalPanOffset.y }
        : { x: 0, y: 0 },
    [modalPanOffset, currentFrame]
  );

  const drawFrame = useCallback(
    (canvas: HTMLCanvasElement | null, currentZoom: number, _offset: { x: number; y: number }) => {
      if (!canvas || !spritesheetUrl || !isLoaded) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = imageRef.current;
      if (!img) return;

      const col = currentFrame % columns;
      const row = Math.floor(currentFrame / columns);
      const sx = col * frameWidth;
      const sy = row * frameHeight;

      // Use integer dimensions and account for devicePixelRatio for crisp rendering
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.round(frameWidth * currentZoom);
      const displayHeight = Math.round(frameHeight * currentZoom);

      // Set canvas internal resolution to match device pixels
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      // Scale context to match devicePixelRatio
      ctx.scale(dpr, dpr);

      ctx.drawImage(
        img,
        sx,
        sy,
        frameWidth,
        frameHeight,
        0,
        0,
        displayWidth,
        displayHeight
      );
    },
    [spritesheetUrl, currentFrame, frameWidth, frameHeight, columns, isLoaded]
  );

  useEffect(() => {
    drawFrame(canvasRef.current, zoom, resolvedPanOffset);
  }, [drawFrame, zoom, resolvedPanOffset]);

  useEffect(() => {
    if (isModalOpen) {
      drawFrame(modalCanvasRef.current, modalZoom, resolvedModalPanOffset);
    }
  }, [drawFrame, modalZoom, resolvedModalPanOffset, isModalOpen]);

  const handleZoomIn = (isModal = false) => {
    if (isModal) {
      setModalZoom((z) => Math.min(MAX_ZOOM, z * 2));
    } else {
      setZoom((z) => Math.min(MAX_ZOOM, z * 2));
    }
  };

  const handleZoomOut = (isModal = false) => {
    if (isModal) {
      setModalZoom((z) => Math.max(MIN_ZOOM, z / 2));
    } else {
      setZoom((z) => Math.max(MIN_ZOOM, z / 2));
    }
  };

  const handleResetZoom = (isModal = false) => {
    if (isModal) {
      setModalZoomOverride(null); // Reset to fit zoom
      setModalPanOffset({ x: 0, y: 0, frame: currentFrame });
    } else {
      setZoomOverride(null); // Reset to fit zoom
      setPanOffset({ x: 0, y: 0, frame: currentFrame });
    }
  };

  const handleMainMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setActivePan("main");
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleModalMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setActivePan("modal");
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    if (activePan === "modal") {
      setModalPanOffset((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
        frame: currentFrame,
      }));
    } else {
      setPanOffset((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
        frame: currentFrame,
      }));
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    window.localStorage?.setItem("framePreviewSize", String(previewSize));
  }, [previewSize]);

  return (
    <>
      <div className="tech-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tracking-wider">FRAME PREVIEW</span>
            {keyframe && (
              <span className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-success" />
                KEYFRAME
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              {frameWidth}×{frameHeight}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsModalOpen(true)}
              title="Enlarge preview"
              disabled={!spritesheetUrl && !generatedFrame?.url}
            >
              <Maximize2 className="size-3" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground tracking-wider">
              {spritesheetUrl ? "GENERATED" : "PREVIEW"}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="tracking-wider">SIZE</span>
                {PREVIEW_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setPreviewSize(size)}
                    className={`px-1.5 py-0.5 font-mono transition-colors ${
                      previewSize === size
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <ZoomControls
                zoom={zoom}
                onZoomIn={() => handleZoomIn(false)}
                onZoomOut={() => handleZoomOut(false)}
                onReset={() => handleResetZoom(false)}
                onSetZoom={(value) => setZoom(value)}
              />
            </div>
          </div>

          <div className={`flex ${showComparison && keyframe?.image ? "gap-4" : ""}`}>
            <div className="flex-1 flex flex-col items-center">
              <FrameCanvas
                spritesheetUrl={spritesheetUrl ?? undefined}
                isLoaded={isLoaded}
                error={error}
                generatedFrameUrl={resolvedFrameUrl}
                canvasRef={canvasRef}
                containerRef={containerRef}
                currentZoom={zoom}
                offset={resolvedPanOffset}
                frameWidth={frameWidth}
                frameHeight={frameHeight}
                containerSize={previewSize}
                isPanning={isPanning && activePan === "main"}
                onMouseDown={handleMainMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
              <div className="mt-2 text-[9px] text-muted-foreground flex items-center gap-2">
                <span>Drag to pan</span>
              </div>
            </div>

            {showComparison && keyframe?.image && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-[10px] text-muted-foreground mb-2 tracking-wider">
                  KEYFRAME REF
                </div>
                <div
                  className="border border-success/30 bg-[#0a0a0a] flex items-center justify-center overflow-hidden"
                  style={{ width: previewSize, height: previewSize }}
                >
                  <img
                    src={keyframe.image}
                    alt={`Keyframe ${currentFrame}`}
                    style={{
                      maxWidth: previewSize,
                      maxHeight: previewSize,
                      objectFit: "contain",
                      imageRendering: "pixelated",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frame</span>
                <span className="font-mono">{String(currentFrame).padStart(3, "0")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-mono">{Math.round(1000 / animation.fps)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grid Pos</span>
                <span className="font-mono">
                  {currentFrame % columns},{Math.floor(currentFrame / columns)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Keyframe</span>
                <span className={keyframe ? "text-success" : "text-muted-foreground"}>
                  {keyframe ? "Yes" : "No"}
                </span>
              </div>
            </div>

            {keyframe && (
              <div className="pt-2 border-t border-border/50 space-y-1">
                <div className="text-[9px] text-muted-foreground tracking-wider mb-1">
                  KEYFRAME DATA
                </div>
                {keyframe.prompt && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Prompt: </span>
                    <span className="text-foreground">{keyframe.prompt}</span>
                  </div>
                )}
                {keyframe.model && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Model: </span>
                    <span className="text-primary font-mono">{keyframe.model}</span>
                  </div>
                )}
                {keyframe.strength !== undefined && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Strength: </span>
                    <span className="font-mono">{keyframe.strength.toFixed(2)}</span>
                  </div>
                )}
                {keyframe.seed !== undefined && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Seed: </span>
                    <span className="font-mono">{keyframe.seed}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {spritesheetUrl && (
          <img
            ref={imageRef}
            src={spritesheetUrl}
            alt="spritesheet"
            className="hidden"
            onLoad={() => {
              setLoadedUrl(spritesheetUrl);
              setLoadError(null);
            }}
            onError={() => {
              setLoadedUrl(spritesheetUrl);
              setLoadError("Failed to load spritesheet");
            }}
          />
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-fit p-0 gap-0 bg-card border-border">
          <DialogHeader className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xs text-muted-foreground tracking-wider font-normal">
                FRAME {String(currentFrame).padStart(3, "0")} — {frameWidth}×{frameHeight}px
              </DialogTitle>
              <ZoomControls
                zoom={modalZoom}
                onZoomIn={() => handleZoomIn(true)}
                onZoomOut={() => handleZoomOut(true)}
                onReset={() => handleResetZoom(true)}
                onSetZoom={(value) => setModalZoom(value)}
              />
            </div>
          </DialogHeader>

          <div className="p-4">
            <FrameCanvas
              spritesheetUrl={spritesheetUrl ?? undefined}
              isLoaded={isLoaded}
              error={error}
              generatedFrameUrl={resolvedFrameUrl}
              canvasRef={modalCanvasRef}
              containerRef={modalContainerRef}
              currentZoom={modalZoom}
              offset={resolvedModalPanOffset}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
              containerSize={512}
              isPanning={isPanning && activePan === "modal"}
              onMouseDown={handleModalMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
              <span>Drag to pan</span>
              <span className="text-border">|</span>
              <span className="font-mono">{modalZoom.toFixed(1)}x zoom</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
