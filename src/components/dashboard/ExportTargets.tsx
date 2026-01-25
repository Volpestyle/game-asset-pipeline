"use client";

export function ExportTargets() {
  return (
    <div className="col-span-4 tech-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs text-muted-foreground tracking-wider">
          Export Targets
        </span>
      </div>
      <div className="p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success" />
          <span>Spritesheet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success" />
          <span>Individual Frames</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-border" />
          <span className="text-muted-foreground">WebP Animation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-border" />
          <span className="text-muted-foreground">GIF Preview</span>
        </div>
      </div>
    </div>
  );
}
