"use client";

export function StatsOverview() {
  return (
    <div className="col-span-6 tech-border bg-card p-4">
      <div className="grid grid-cols-4 gap-4 h-full">
        <div className="border-r border-border pr-4">
          <p className="text-xs text-muted-foreground mb-1">Characters</p>
          <p className="text-2xl font-bold text-primary metric-value">0</p>
        </div>
        <div className="border-r border-border pr-4">
          <p className="text-xs text-muted-foreground mb-1">Animations</p>
          <p className="text-2xl font-bold metric-value">0</p>
        </div>
        <div className="border-r border-border pr-4">
          <p className="text-xs text-muted-foreground mb-1">Frames Generated</p>
          <p className="text-2xl font-bold metric-value">0</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Exports</p>
          <p className="text-2xl font-bold metric-value">0</p>
        </div>
      </div>
    </div>
  );
}
