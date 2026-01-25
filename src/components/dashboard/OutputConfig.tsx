"use client";

export function OutputConfig() {
  return (
    <div className="col-span-4 tech-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs text-muted-foreground tracking-wider">
          Default Output
        </span>
      </div>
      <div className="p-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Format</span>
          <span>PNG Sequence</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Resolution</span>
          <span>128 × 128</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Color Depth</span>
          <span>32-bit</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Compression</span>
          <span className="text-success">Lossless</span>
        </div>
      </div>
    </div>
  );
}
