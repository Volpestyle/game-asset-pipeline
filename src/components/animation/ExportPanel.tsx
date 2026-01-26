"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { Animation, ProjectSettings, AnchorPoint } from "@/types";

interface ExportPanelProps {
  animation: Animation;
  onExport: (options: {
    normalize: boolean;
    removeBackground: boolean;
    alphaThreshold: number;
  }) => Promise<void>;
  isExporting: boolean;
}

const ANCHOR_LABELS: Record<AnchorPoint, string> = {
  "bottom-center": "Bottom Center",
  "center": "Center",
  "bottom-left": "Bottom Left",
  "bottom-right": "Bottom Right",
  "top-center": "Top Center",
};

export function ExportPanel({ animation, onExport, isExporting }: ExportPanelProps) {
  const [normalize, setNormalize] = useState(false);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [alphaThresholdEnabled, setAlphaThresholdEnabled] = useState(false);
  const [alphaThreshold, setAlphaThreshold] = useState(16);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);

  useEffect(() => {
    fetch("/api/project")
      .then((res) => res.json())
      .then((data) => setProjectSettings(data.settings))
      .catch(() => {});
  }, []);
  const hasExports = animation.exports && Object.keys(animation.exports).length > 0;
  const hasSpritesheet = !!animation.generatedSpritesheet;
  const frameWidth =
    animation.spritesheetLayout?.frameWidth ??
    animation.frameWidth ??
    animation.spritesheetLayout?.frameSize ??
    animation.spriteSize;
  const frameHeight =
    animation.spritesheetLayout?.frameHeight ??
    animation.frameHeight ??
    animation.spritesheetLayout?.frameSize ??
    animation.spriteSize;

  const exportLinks = [
    {
      key: "spritesheetUrl",
      label: "Spritesheet PNG",
      url: animation.exports?.spritesheetUrl,
      description: "Full sprite atlas as PNG",
      available: true,
    },
    {
      key: "asepriteJsonArrayUrl",
      label: "Aseprite JSON (Array)",
      url: animation.exports?.asepriteJsonArrayUrl,
      description: "Frame data in array format",
      available: true,
    },
    {
      key: "asepriteJsonHashUrl",
      label: "Aseprite JSON (Hash)",
      url: animation.exports?.asepriteJsonHashUrl,
      description: "Frame data in hash/object format",
      available: true,
    },
    {
      key: "pngSequenceUrl",
      label: "PNG Sequence",
      url: animation.exports?.pngSequenceIndexUrl ?? animation.exports?.pngSequenceUrl,
      description: "Frame list + durations (index.json)",
      available: !!animation.exports?.pngSequenceIndexUrl || !!animation.exports?.pngSequenceUrl,
    },
    {
      key: "zipBundleUrl",
      label: "ZIP Bundle",
      url: animation.exports?.zipBundleUrl,
      description: "All exports in a single archive",
      available: !!animation.exports?.zipBundleUrl,
    },
  ];

  const sourceVideoUrl =
    animation.sourceVideoUrl ?? animation.generationJob?.outputs?.videoUrl;
  const sourceSpritesheetUrl =
    animation.sourceProviderSpritesheetUrl ??
    animation.generationJob?.outputs?.spritesheetUrl;
  const sourceThumbnailUrl =
    animation.sourceThumbnailUrl ?? animation.generationJob?.outputs?.thumbnailUrl;

  const sourceLinks = [
    {
      key: "sourceVideoUrl",
      label: "Source MP4",
      url: sourceVideoUrl,
      description: "Original video output from the provider",
      available: !!sourceVideoUrl,
    },
    {
      key: "sourceProviderSpritesheetUrl",
      label: "Provider Spritesheet",
      url: sourceSpritesheetUrl,
      description: "Spritesheet variant from provider (if available)",
      available: !!sourceSpritesheetUrl,
    },
    {
      key: "sourceThumbnailUrl",
      label: "Provider Thumbnail",
      url: sourceThumbnailUrl,
      description: "Thumbnail image from provider",
      available: !!sourceThumbnailUrl,
    },
  ];

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">Export</span>
        <div className="flex items-center gap-2">
          {hasExports && (
            <span className="text-[10px] text-success flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-success" />
              Ready
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Export status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground tracking-wider">
              Status
            </span>
            <span className={hasSpritesheet ? "text-success" : "text-warning"}>
              {hasSpritesheet
                ? hasExports
                  ? "Exported"
                  : "Ready to Export"
                : "Generate animation first"}
            </span>
          </div>
        </div>

        {/* Normalize option */}
        {projectSettings && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={normalize}
                onChange={(e) => setNormalize(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-xs text-foreground">Normalize to canvas</span>
            </label>
            {normalize && (
              <div className="pl-6 text-[10px] text-muted-foreground space-y-0.5">
                <div>Canvas: {projectSettings.canvasWidth}×{projectSettings.canvasHeight}</div>
                <div>Anchor: {ANCHOR_LABELS[projectSettings.defaultAnchor]}</div>
                <div>Scale: {Math.round(projectSettings.defaultScale * 100)}%</div>
              </div>
            )}
          </div>
        )}

        {/* Background cleanup */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground tracking-wider">
            Background Cleanup
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={removeBackground}
              onChange={(e) => setRemoveBackground(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs text-foreground">Re-key background color</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alphaThresholdEnabled}
              onChange={(e) => setAlphaThresholdEnabled(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs text-foreground">Clamp alpha (hard edges)</span>
          </label>
          {alphaThresholdEnabled && (
            <div className="pl-6 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Threshold</span>
              <input
                type="number"
                min={0}
                max={255}
                value={alphaThreshold}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  setAlphaThreshold(Math.min(255, Math.max(0, Math.round(next))));
                }}
                className="terminal-input w-20 h-7 px-2 text-[10px] bg-card"
              />
              <span>0-255</span>
            </div>
          )}
          {(removeBackground || alphaThresholdEnabled) && (
            <p className="text-[10px] text-muted-foreground/70">
              Applied only to export output. Originals remain unchanged. Uses the working key color (default magenta).
            </p>
          )}
        </div>

        {/* Export button */}
        <Button
          onClick={() =>
            onExport({
              normalize,
              removeBackground,
              alphaThreshold: alphaThresholdEnabled ? alphaThreshold : 0,
            })
          }
          disabled={isExporting || !hasSpritesheet}
          className="w-full h-9 bg-primary hover:bg-primary/80 text-primary-foreground text-[10px] tracking-wider"
        >
          {isExporting ? "EXPORTING..." : hasExports ? "RE-EXPORT" : "EXPORT ALL FORMATS"}
        </Button>

        {/* Export info */}
        {hasSpritesheet && !hasExports && (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Export will generate spritesheet PNG, Aseprite JSON metadata in both array and hash formats.
            {normalize && " Frames will be normalized to the project canvas size."}
            {removeBackground && " Background will be re-keyed using the working key color."}
            {alphaThresholdEnabled &&
              ` Alpha will be clamped at ${alphaThreshold} for crisp edges.`}
          </p>
        )}

        {/* Export links */}
        {hasExports && (
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground tracking-wider">
              Download Links
            </span>
            <div className="space-y-1">
              {exportLinks.map((link) => (
                <div key={link.key} className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-[10px] text-foreground">{link.label}</span>
                    <p className="text-[9px] text-muted-foreground">{link.description}</p>
                  </div>
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="px-2 py-1 text-[10px] border border-border text-primary hover:border-primary transition-colors"
                    >
                      DOWNLOAD
                    </a>
                  ) : link.available ? (
                    <span className="text-[10px] text-muted-foreground">Not yet</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">Coming soon</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(sourceVideoUrl || sourceSpritesheetUrl || sourceThumbnailUrl) && (
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground tracking-wider">
              Provider Assets
            </span>
            <div className="space-y-1">
              {sourceLinks.map((link) => (
                <div key={link.key} className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-[10px] text-foreground">{link.label}</span>
                    <p className="text-[9px] text-muted-foreground">{link.description}</p>
                  </div>
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="px-2 py-1 text-[10px] border border-border text-primary hover:border-primary transition-colors"
                    >
                      DOWNLOAD
                    </a>
                  ) : link.available ? (
                    <span className="text-[10px] text-muted-foreground">Not yet</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">Unavailable</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Frame info */}
        {animation.spritesheetLayout && (
          <div className="pt-2 border-t border-border space-y-1">
            <span className="text-[10px] text-muted-foreground tracking-wider">
              Spritesheet Layout
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frame Size</span>
                <span>
                  {frameWidth}px × {frameHeight}px
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grid</span>
                <span>
                  {animation.spritesheetLayout.columns}×{animation.spritesheetLayout.rows}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dimensions</span>
                <span>
                  {animation.spritesheetLayout.width}×{animation.spritesheetLayout.height}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frames</span>
                <span>{animation.actualFrameCount ?? animation.frameCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Usage hint */}
        <div className="pt-2 border-t border-border">
          <p className="text-[9px] text-muted-foreground leading-relaxed">
            JSON formats are compatible with Aseprite, Phaser, PixiJS, Godot, and most game engines.
            Use array format for ordered playback, hash format for random access by name.
          </p>
        </div>
      </div>
    </div>
  );
}
