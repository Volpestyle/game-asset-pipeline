"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { KeyBinding, KeyBehavior, KeyModifier, PreviewState } from "../types";

interface KeyBindingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  states: PreviewState[];
  keyBindings: KeyBinding[];
  onAdd: (binding: Omit<KeyBinding, "id">) => void;
  onRemove: (bindingId: string) => void;
}

interface EditingBinding {
  stateId: string;
  key: string;
  modifiers: KeyModifier[];
  behavior: KeyBehavior;
}

export function KeyBindingModal({
  open,
  onOpenChange,
  states,
  keyBindings,
  onAdd,
  onRemove,
}: KeyBindingModalProps) {
  const [editingBinding, setEditingBinding] = useState<EditingBinding | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Reset editing state when modal closes - intentional state sync on prop change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      setEditingBinding(null);
      setIsRecording(false);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Record key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording || !editingBinding) return;

      e.preventDefault();

      // Skip modifier-only keys
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;

      const modifiers: KeyModifier[] = [];
      if (e.shiftKey) modifiers.push("shift");
      if (e.ctrlKey) modifiers.push("ctrl");
      if (e.altKey) modifiers.push("alt");

      setEditingBinding((prev) =>
        prev
          ? {
              ...prev,
              key: e.key.length === 1 ? e.key.toUpperCase() : e.key,
              modifiers,
            }
          : null
      );
      setIsRecording(false);
    },
    [isRecording, editingBinding]
  );

  useEffect(() => {
    if (isRecording) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isRecording, handleKeyDown]);

  const handleAddNew = () => {
    if (states.length === 0) return;
    setEditingBinding({
      stateId: states[0]?.id ?? "",
      key: "",
      modifiers: [],
      behavior: "trigger-once",
    });
  };

  const handleSaveBinding = () => {
    if (!editingBinding || !editingBinding.key || !editingBinding.stateId) return;

    onAdd(editingBinding);
    setEditingBinding(null);
  };

  const formatBinding = (binding: KeyBinding): string => {
    const parts: string[] = [];
    if (binding.modifiers.includes("ctrl")) parts.push("Ctrl");
    if (binding.modifiers.includes("alt")) parts.push("Alt");
    if (binding.modifiers.includes("shift")) parts.push("Shift");
    parts.push(binding.key.toUpperCase());
    return parts.join("+");
  };

  const formatBehavior = (behavior: KeyBehavior): string => {
    switch (behavior) {
      case "trigger-once":
        return "Once";
      case "hold":
        return "Hold";
      case "toggle":
        return "Toggle";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-card border-border">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-xs text-muted-foreground tracking-wider font-normal">
            KEY BINDINGS
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Existing bindings */}
          {keyBindings.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground tracking-wider">
                CONFIGURED
              </span>
              <ul className="space-y-1">
                {keyBindings.map((binding) => {
                  const state = states.find((item) => item.id === binding.stateId);
                  return (
                    <li
                      key={binding.id}
                      className="flex items-center gap-3 px-3 py-2 bg-secondary/30 border border-border"
                    >
                      <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-0.5 min-w-[4rem] text-center">
                        {formatBinding(binding)}
                      </span>
                      <span className="flex-1 text-xs text-foreground">
                        {state?.name ?? "Unknown"}
                      </span>
                      <span className="text-[9px] text-muted-foreground uppercase">
                        {formatBehavior(binding.behavior)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onRemove(binding.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Add new binding form */}
          {editingBinding ? (
            <div className="space-y-3 p-3 border border-primary/30 bg-primary/5">
              <span className="text-[10px] text-primary tracking-wider">
                NEW BINDING
              </span>

              <div className="grid grid-cols-2 gap-3">
                {/* Animation select */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">
                    State
                  </label>
                  <select
                    value={editingBinding.stateId}
                    onChange={(e) =>
                      setEditingBinding((prev) =>
                        prev ? { ...prev, stateId: e.target.value } : null
                      )
                    }
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border"
                  >
                    {states.map((state) => (
                      <option key={state.id} value={state.id}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Behavior select */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">
                    Behavior
                  </label>
                  <select
                    value={editingBinding.behavior}
                    onChange={(e) =>
                      setEditingBinding((prev) =>
                        prev
                          ? { ...prev, behavior: e.target.value as KeyBehavior }
                          : null
                      )
                    }
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border"
                  >
                    <option value="trigger-once">Trigger Once</option>
                    <option value="hold">Hold</option>
                    <option value="toggle">Toggle</option>
                  </select>
                </div>
              </div>

              {/* Key recording */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Key</label>
                <button
                  onClick={() => setIsRecording(true)}
                  className={`w-full px-3 py-2 text-xs border transition-colors ${
                    isRecording
                      ? "border-primary bg-primary/10 text-primary"
                      : editingBinding.key
                        ? "border-border bg-background text-foreground"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {isRecording ? (
                    "Press any key..."
                  ) : editingBinding.key ? (
                    <span className="font-mono">
                      {editingBinding.modifiers.includes("ctrl") && "Ctrl+"}
                      {editingBinding.modifiers.includes("alt") && "Alt+"}
                      {editingBinding.modifiers.includes("shift") && "Shift+"}
                      {editingBinding.key}
                    </span>
                  ) : (
                    "Click to record key"
                  )}
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingBinding(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveBinding}
                  disabled={!editingBinding.key || !editingBinding.stateId}
                  className="flex-1"
                >
                  Add Binding
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAddNew}
              disabled={states.length === 0}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted-foreground bg-secondary/30 hover:bg-secondary border border-dashed border-border transition-colors"
            >
              <Plus className="size-4" />
              Add Key Binding
            </button>
          )}

          {states.length === 0 && (
            <div className="text-[10px] text-muted-foreground text-center">
              Create a state before adding bindings.
            </div>
          )}

          {/* Help text */}
          <div className="text-[9px] text-muted-foreground/60 space-y-1">
            <p>
              <strong>Trigger Once:</strong> Plays entry and a single loop, then exits
            </p>
            <p>
              <strong>Hold:</strong> Runs entry then loops while held, exits on release
            </p>
            <p>
              <strong>Toggle:</strong> Press to enter, press again to exit
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
