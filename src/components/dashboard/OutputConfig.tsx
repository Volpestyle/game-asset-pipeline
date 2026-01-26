"use client";

import { useEffect, useState } from "react";
import type { ProjectSettings, AnchorPoint } from "@/types";

const ANCHOR_OPTIONS: { value: AnchorPoint; label: string }[] = [
  { value: "bottom-center", label: "Bottom Center" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
  { value: "top-center", label: "Top Center" },
];

const CANVAS_PRESETS = [
  { label: "256×512", width: 256, height: 512 },
  { label: "128×256", width: 128, height: 256 },
  { label: "64×128", width: 64, height: 128 },
  { label: "256×256", width: 256, height: 256 },
  { label: "128×128", width: 128, height: 128 },
];

export function OutputConfig() {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    fetch("/api/project")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data.settings);
        // Check if current size matches a preset
        const preset = CANVAS_PRESETS.find(
          (p) => p.width === data.settings.canvasWidth && p.height === data.settings.canvasHeight
        );
        setShowCustom(!preset);
      })
      .catch(() => {});
  }, []);

  const saveSettings = async (updates: Partial<ProjectSettings>) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/project", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      setSettings(data.settings);
    } catch {
      // Ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handlePresetChange = (preset: typeof CANVAS_PRESETS[0] | null) => {
    if (preset) {
      setShowCustom(false);
      saveSettings({ canvasWidth: preset.width, canvasHeight: preset.height });
    } else {
      setShowCustom(true);
    }
  };

  if (!settings) {
    return (
      <div className="col-span-4 tech-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground tracking-wider">
            Canvas Settings
          </span>
        </div>
        <div className="p-4 text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const currentPreset = CANVAS_PRESETS.find(
    (p) => p.width === settings.canvasWidth && p.height === settings.canvasHeight
  );

  return (
    <div className="col-span-4 tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          Canvas Settings
        </span>
        {isSaving && (
          <span className="text-[10px] text-muted-foreground">Saving...</span>
        )}
      </div>
      <div className="p-4 space-y-4">
        {/* Canvas Size */}
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground tracking-widest">
            Canvas Size
          </label>
          <div className="flex flex-wrap gap-1">
            {CANVAS_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetChange(preset)}
                className={`px-2 py-1 text-[10px] border transition-colors ${
                  currentPreset?.label === preset.label && !showCustom
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => handlePresetChange(null)}
              className={`px-2 py-1 text-[10px] border transition-colors ${
                showCustom
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              Custom
            </button>
          </div>
          {showCustom && (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={settings.canvasWidth}
                onChange={(e) => saveSettings({ canvasWidth: Number(e.target.value) })}
                className="terminal-input w-20 h-7 px-2 text-xs bg-card"
                min={16}
                max={4096}
              />
              <span className="text-muted-foreground">×</span>
              <input
                type="number"
                value={settings.canvasHeight}
                onChange={(e) => saveSettings({ canvasHeight: Number(e.target.value) })}
                className="terminal-input w-20 h-7 px-2 text-xs bg-card"
                min={16}
                max={4096}
              />
            </div>
          )}
        </div>

        {/* Default Anchor */}
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground tracking-widest">
            Default Anchor
          </label>
          <select
            value={settings.defaultAnchor}
            onChange={(e) => saveSettings({ defaultAnchor: e.target.value as AnchorPoint })}
            className="terminal-input w-full h-8 px-2 text-xs bg-card"
          >
            {ANCHOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Default Scale */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground tracking-widest">
              Default Scale
            </label>
            <span className="text-xs text-foreground">
              {Math.round(settings.defaultScale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={settings.defaultScale}
            onChange={(e) => saveSettings({ defaultScale: parseFloat(e.target.value) })}
            className="w-full accent-primary"
          />
        </div>

        {/* Info */}
        <p className="text-[9px] text-muted-foreground leading-relaxed pt-2 border-t border-border">
          These settings apply when exporting with normalization enabled.
          Characters can override anchor and scale individually.
        </p>
      </div>
    </div>
  );
}
