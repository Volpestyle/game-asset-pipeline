"use client";

export function SystemStatus() {
  return (
    <div className="col-span-3 tech-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">SYSTEM</span>
        <div className="flex items-center gap-2">
          <div className="status-dot status-dot-online" />
          <span className="text-xs text-success">READY</span>
        </div>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Engine</span>
          <span>AI GEN v3</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">API</span>
          <span className="text-success">Connected</span>
        </div>
      </div>
    </div>
  );
}
