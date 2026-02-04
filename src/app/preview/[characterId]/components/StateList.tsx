"use client";

import type { FormEvent } from "react";
import { Star, Play } from "lucide-react";
import type { PreviewState, KeyBinding } from "../types";

interface StateListProps {
  states: PreviewState[];
  defaultStateId: string;
  currentStateId: string | null;
  selectedStateId: string | null;
  keyBindings: KeyBinding[];
  onSetDefault: (stateId: string) => void;
  onSelect: (stateId: string) => void;
  onAddState: (name: string) => void;
}

export function StateList({
  states,
  defaultStateId,
  currentStateId,
  selectedStateId,
  keyBindings,
  onSetDefault,
  onSelect,
  onAddState,
}: StateListProps) {
  const getBindingForState = (stateId: string): KeyBinding | undefined => {
    return keyBindings.find((binding) => binding.stateId === stateId);
  };

  const formatBinding = (binding: KeyBinding): string => {
    const parts: string[] = [];
    if (binding.modifiers.includes("ctrl")) parts.push("Ctrl");
    if (binding.modifiers.includes("alt")) parts.push("Alt");
    if (binding.modifiers.includes("shift")) parts.push("Shift");
    parts.push(binding.key.toUpperCase());
    return parts.join("+");
  };

  const handleAddState = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("stateName") ?? "").trim();
    if (!name) return;
    onAddState(name);
    event.currentTarget.reset();
  };

  return (
    <div className="tech-border bg-card flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-wider">
          STATES
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {states.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {states.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            No states yet
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {states.map((state) => {
              const isDefault = state.id === defaultStateId;
              const isCurrent = state.id === currentStateId;
              const isSelected = state.id === selectedStateId;
              const binding = getBindingForState(state.id);

              return (
                <li key={state.id}>
                  <button
                    onClick={() => onSelect(state.id)}
                    className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${
                      isSelected
                        ? "bg-secondary/60 border-l-2 border-primary -ml-px"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onSetDefault(state.id);
                      }}
                      className={`transition-colors ${
                        isDefault
                          ? "text-warning"
                          : "text-muted-foreground/30 hover:text-muted-foreground"
                      }`}
                      title={isDefault ? "Default state" : "Set as default"}
                    >
                      <Star
                        className="size-3.5"
                        fill={isDefault ? "currentColor" : "none"}
                      />
                    </button>

                    {isCurrent && (
                      <Play className="size-3 text-primary" fill="currentColor" />
                    )}

                    <span
                      className={`flex-1 text-xs ${
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {state.name}
                    </span>

                    {binding && (
                      <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5">
                        {formatBinding(binding)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-3">
        <form onSubmit={handleAddState} className="flex gap-2">
          <input
            name="stateName"
            placeholder="New state name"
            className="flex-1 px-2 py-1.5 text-xs bg-background border border-border"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-[10px] text-muted-foreground bg-secondary/60 hover:bg-secondary border border-dashed border-border"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
