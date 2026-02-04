"use client";

import { useState } from "react";
import { Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewState, QueuedState } from "../types";

interface SequenceQueuePanelProps {
  states: PreviewState[];
  onPlaySequence: (sequence: string[]) => void;
}

export function SequenceQueuePanel({
  states,
  onPlaySequence,
}: SequenceQueuePanelProps) {
  const [queue, setQueue] = useState<QueuedState[]>([]);

  const addToQueue = (stateId: string) => {
    const state = states.find((item) => item.id === stateId);
    if (!state) return;

    setQueue((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        stateId: state.id,
        stateName: state.name,
      },
    ]);
  };

  const removeFromQueue = (queueId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== queueId));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const playQueue = () => {
    if (queue.length === 0) return;
    onPlaySequence(queue.map((item) => item.stateId));
  };

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          SEQUENCE QUEUE
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {queue.length} items
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Queue items */}
        {queue.length > 0 ? (
          <div className="space-y-1">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-secondary/30 border border-border group"
              >
                <span className="text-[10px] text-muted-foreground/60 font-mono w-4">
                  {index + 1}
                </span>
                <span className="flex-1 text-xs text-foreground truncate">
                  {item.stateName}
                </span>
                <button
                  onClick={() => removeFromQueue(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-opacity"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground text-center py-4">
            Add states to create a sequence
          </div>
        )}

        {/* Sequence visualization */}
        {queue.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {queue.map((item, index) => (
              <div key={item.id} className="flex items-center gap-1">
                <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 whitespace-nowrap">
                  {item.stateName.slice(0, 6)}
                </span>
                {index < queue.length - 1 && (
                  <span className="text-muted-foreground/40">→</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add animation dropdown */}
        <div className="flex gap-2">
          <select
            onChange={(e) => {
              if (e.target.value) {
                addToQueue(e.target.value);
                e.target.value = "";
              }
            }}
            className="flex-1 px-2 py-1.5 text-xs bg-background border border-border"
            defaultValue=""
          >
            <option value="" disabled>
              Add state...
            </option>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearQueue}
            disabled={queue.length === 0}
            className="flex-1"
          >
            <Trash2 className="size-3 mr-1.5" />
            Clear
          </Button>
          <Button
            size="sm"
            onClick={playQueue}
            disabled={queue.length === 0}
            className="flex-1"
          >
            <Play className="size-3 mr-1.5" />
            Play
          </Button>
        </div>

        {/* Help text */}
        <div className="text-[9px] text-muted-foreground/60">
          Queue plays states in order, including entry, loop, and exit clips.
        </div>
      </div>
    </div>
  );
}
