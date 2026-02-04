"use client";

import { Trash2 } from "lucide-react";
import type { AnimationState, PreviewState } from "../types";
import { Button } from "@/components/ui/button";

interface StateEditorProps {
  state: PreviewState | null;
  states: PreviewState[];
  animations: AnimationState[];
  onUpdate: (stateId: string, updates: Partial<PreviewState>) => void;
  onDelete: (stateId: string) => void;
}

export function StateEditor({
  state,
  states,
  animations,
  onUpdate,
  onDelete,
}: StateEditorProps) {
  if (!state) {
    return (
      <div className="tech-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground tracking-wider">
            STATE EDITOR
          </span>
        </div>
        <div className="p-4 text-xs text-muted-foreground text-center">
          Select a state to edit
        </div>
      </div>
    );
  }

  return (
    <div className="tech-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          STATE EDITOR
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onDelete(state.id)}
          title="Delete state"
        >
          <Trash2 className="size-3 text-destructive" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Name</label>
          <input
            value={state.name}
            onChange={(event) => onUpdate(state.id, { name: event.target.value })}
            className="w-full px-2 py-1.5 text-xs bg-background border border-border"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground">Entry Clip</label>
          <select
            value={state.entryAnimationId ?? ""}
            onChange={(event) =>
              onUpdate(state.id, {
                entryAnimationId: event.target.value || undefined,
              })
            }
            className="w-full px-2 py-1.5 text-xs bg-background border border-border"
          >
            <option value="">None</option>
            {animations.map((anim) => (
              <option key={anim.id} value={anim.id}>
                {anim.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground">Loop Clip</label>
          <select
            value={state.loopAnimationId ?? ""}
            onChange={(event) =>
              onUpdate(state.id, {
                loopAnimationId: event.target.value || undefined,
              })
            }
            className="w-full px-2 py-1.5 text-xs bg-background border border-border"
          >
            <option value="">None</option>
            {animations.map((anim) => (
              <option key={anim.id} value={anim.id}>
                {anim.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground">Exit Clip</label>
          <select
            value={state.exitAnimationId ?? ""}
            onChange={(event) =>
              onUpdate(state.id, {
                exitAnimationId: event.target.value || undefined,
              })
            }
            className="w-full px-2 py-1.5 text-xs bg-background border border-border"
          >
            <option value="">None</option>
            {animations.map((anim) => (
              <option key={anim.id} value={anim.id}>
                {anim.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground">Exit To</label>
          <select
            value={state.exitToStateId ?? ""}
            onChange={(event) =>
              onUpdate(state.id, {
                exitToStateId: event.target.value || undefined,
              })
            }
            className="w-full px-2 py-1.5 text-xs bg-background border border-border"
          >
            <option value="">Default (auto)</option>
            {states.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[9px] text-muted-foreground/70">
          Entry plays once, loop repeats, exit plays once before changing states.
        </div>

        {!state.entryAnimationId && !state.loopAnimationId && (
          <div className="text-[10px] text-destructive/80">
            Assign at least an entry or loop clip to make this state playable.
          </div>
        )}
      </div>
    </div>
  );
}
