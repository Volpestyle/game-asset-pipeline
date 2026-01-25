"use client";

import { Clock } from "iconoir-react";

export function RecentActivity() {
  return (
    <div className="col-span-4 tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          Recent Activity
        </span>
        <Clock
          className="w-3.5 h-3.5 text-muted-foreground"
          strokeWidth={1.5}
        />
      </div>
      <div className="p-4">
        {/* Empty State */}
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground/60">
            No recent activity
          </p>
        </div>
      </div>
    </div>
  );
}
