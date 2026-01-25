"use client";

import Link from "next/link";
import { Plus } from "iconoir-react";

export function QuickActions() {
  return (
    <Link href="/characters/new" className="col-span-3">
      <div className="tech-border bg-card h-full p-4 hover:border-primary transition-colors group cursor-pointer">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 border border-primary bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plus className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <span className="text-xs text-muted-foreground">NEW</span>
        </div>
        <p className="text-sm font-medium">Create Character</p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload refs, extract identity
        </p>
      </div>
    </Link>
  );
}
