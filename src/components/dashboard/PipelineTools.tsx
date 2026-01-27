"use client";

import Link from "next/link";
import { Play, Folder, Settings } from "iconoir-react";

export function PipelineTools() {
  return (
    <div className="col-span-4 tech-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs text-muted-foreground tracking-wider">
          Quick Tools
        </span>
      </div>
      <div className="p-3 space-y-1">
        <Link
          href="/animations/new"
          className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors flex items-center gap-3"
        >
          <Play className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
          <span>Generate Animation</span>
          <span className="ml-auto text-muted-foreground/50">⌘G</span>
        </Link>
        <Link
          href="/export"
          className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors flex items-center gap-3"
        >
          <Folder className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
          <span>Batch Export</span>
          <span className="ml-auto text-muted-foreground/50">⌘E</span>
        </Link>
        <Link
          href="/settings"
          className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors flex items-center gap-3"
        >
          <Settings className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
          <span>Pipeline Settings</span>
          <span className="ml-auto text-muted-foreground/50">⌘,</span>
        </Link>
      </div>
    </div>
  );
}
