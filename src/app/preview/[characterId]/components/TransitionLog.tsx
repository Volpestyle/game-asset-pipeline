"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TransitionLogEntry, PreviewState } from "../types";

interface TransitionLogProps {
  entries: TransitionLogEntry[];
  states: PreviewState[];
  startTime: number;
  onClear: () => void;
}

function formatTimestamp(timestamp: number, startTime: number): string {
  const elapsed = timestamp - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const ms = Math.floor((elapsed % 1000) / 100);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;
}

function formatTrigger(trigger: TransitionLogEntry["trigger"], key?: string): string {
  switch (trigger) {
    case "key":
      return key ? `(${key})` : "(key)";
    case "release":
      return key ? `(release ${key})` : "(release)";
    case "sequence":
      return "(sequence)";
    case "auto":
      return "(auto)";
    case "force":
      return "(force)";
    default:
      return "";
  }
}

export function TransitionLog({
  entries,
  states,
  startTime,
  onClear,
}: TransitionLogProps) {
  const getStateName = (id: string): string => {
    if (id === "none") return "none";
    return states.find((state) => state.id === id)?.name ?? id;
  };

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          TRANSITION LOG
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">
            {entries.length}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            disabled={entries.length === 0}
            title="Clear log"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      <div className="max-h-32 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="p-4 text-[10px] text-muted-foreground text-center">
            No transitions logged
          </div>
        ) : (
          <div className="px-4 py-2 space-y-0.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 text-[10px] font-mono"
              >
                <span className="text-muted-foreground/60 w-12">
                  {formatTimestamp(entry.timestamp, startTime)}
                </span>
                <span className="text-muted-foreground">
                  {getStateName(entry.fromState)}
                </span>
                <span className="text-primary">→</span>
                <span className="text-foreground">
                  {getStateName(entry.toState)}
                </span>
                <span className="text-muted-foreground/60 text-[9px]">
                  {formatTrigger(entry.trigger, entry.key)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
