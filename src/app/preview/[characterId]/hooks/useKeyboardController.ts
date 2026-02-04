"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import type { KeyBinding, KeyModifier } from "../types";

interface UseKeyboardControllerOptions {
  keyBindings: KeyBinding[];
  onKeyTrigger: (binding: KeyBinding, key: string) => void;
  onKeyRelease?: (binding: KeyBinding, key: string) => void;
  enabled?: boolean;
}

interface UseKeyboardControllerReturn {
  pressedKeys: Set<string>;
}

function normalizeKey(key: string): string {
  // Normalize key to uppercase for consistency
  return key.length === 1 ? key.toUpperCase() : key;
}

function getActiveModifiers(e: KeyboardEvent): KeyModifier[] {
  const modifiers: KeyModifier[] = [];
  if (e.shiftKey) modifiers.push("shift");
  if (e.ctrlKey) modifiers.push("ctrl");
  if (e.altKey) modifiers.push("alt");
  return modifiers;
}

function modifiersMatch(required: KeyModifier[], active: KeyModifier[]): boolean {
  if (required.length !== active.length) return false;
  return required.every((mod) => active.includes(mod));
}

export function useKeyboardController({
  keyBindings,
  onKeyTrigger,
  onKeyRelease,
  enabled = true,
}: UseKeyboardControllerOptions): UseKeyboardControllerReturn {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // Track toggle states
  const toggleStatesRef = useRef<Map<string, boolean>>(new Map());

  // Find matching binding for a key event
  const findBinding = useCallback(
    (key: string, modifiers: KeyModifier[]): KeyBinding | undefined => {
      const normalizedKey = normalizeKey(key);
      return keyBindings.find(
        (binding) =>
          normalizeKey(binding.key) === normalizedKey &&
          modifiersMatch(binding.modifiers, modifiers)
      );
    },
    [keyBindings]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if focused on input elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const key = normalizeKey(e.key);
      const modifiers = getActiveModifiers(e);
      const binding = findBinding(e.key, modifiers);

      if (!binding) return;

      // Prevent default behavior for bound keys
      e.preventDefault();

      // Update pressed keys
      setPressedKeys((prev) => new Set(prev).add(key));

      switch (binding.behavior) {
        case "trigger-once":
          // Only trigger if not already in pressed state
          if (!pressedKeys.has(key)) {
            onKeyTrigger(binding, key);
          }
          break;

        case "hold":
          // Trigger on initial press
          if (!pressedKeys.has(key)) {
            onKeyTrigger(binding, key);
          }
          break;

        case "toggle":
          // Toggle on press
          if (!pressedKeys.has(key)) {
            const currentState = toggleStatesRef.current.get(binding.id) ?? false;
            const newState = !currentState;
            toggleStatesRef.current.set(binding.id, newState);

            if (newState) {
              onKeyTrigger(binding, key);
            } else {
              onKeyRelease?.(binding, key);
            }
          }
          break;
      }
    },
    [enabled, findBinding, pressedKeys, onKeyTrigger, onKeyRelease]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const key = normalizeKey(e.key);
      const modifiers = getActiveModifiers(e);
      const binding = findBinding(e.key, modifiers);

      // Update pressed keys
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      if (!binding) return;

      // Handle hold behavior - trigger release
      if (binding.behavior === "hold") {
        onKeyRelease?.(binding, key);
      }
    },
    [enabled, findBinding, onKeyRelease]
  );

  // Attach event listeners
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, handleKeyDown, handleKeyUp]);

  // Clear pressed keys when disabled or on blur
  useEffect(() => {
    const handleBlur = () => {
      setPressedKeys(new Set());
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  return {
    pressedKeys,
  };
}
