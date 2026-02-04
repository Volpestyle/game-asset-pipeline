"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PreviewConfig, KeyBinding, PreviewState } from "../types";
import { createDefaultConfig } from "../types";
import { logger } from "@/lib/logger";

interface UsePreviewConfigOptions {
  characterId: string;
}

interface UsePreviewConfigReturn {
  config: PreviewConfig | null;
  isLoading: boolean;
  error: string | null;
  setDefaultState: (stateId: string) => void;
  addState: (name: string) => void;
  updateState: (stateId: string, updates: Partial<PreviewState>) => void;
  removeState: (stateId: string) => void;
  addKeyBinding: (binding: Omit<KeyBinding, "id">) => void;
  removeKeyBinding: (bindingId: string) => void;
}

export function usePreviewConfig({ characterId }: UsePreviewConfigOptions): UsePreviewConfigReturn {
  const [config, setConfig] = useState<PreviewConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch config on mount
  useEffect(() => {
    async function fetchConfig() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/preview/${characterId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch config");
        }
        const data = await response.json();
        setConfig(data.config);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        logger.warn("Preview config: failed to fetch, using defaults", {
          characterId,
          error: message,
        });
        // Initialize with default config on error
        setConfig(createDefaultConfig(characterId));
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, [characterId]);

  // Debounced save
  const debouncedSave = useCallback((updatedConfig: PreviewConfig) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/preview/${characterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedConfig),
        });
      } catch (err) {
        logger.warn("Preview config: failed to save", {
          characterId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, 500);
  }, [characterId]);

  // Update helper that triggers save
  const updateConfig = useCallback((updater: (prev: PreviewConfig) => PreviewConfig) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const setDefaultState = useCallback((stateId: string) => {
    updateConfig((prev) => ({
      ...prev,
      defaultStateId: stateId,
    }));
  }, [updateConfig]);

  const addState = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    updateConfig((prev) => {
      const newState: PreviewState = {
        id: crypto.randomUUID(),
        name: trimmed,
      };

      const nextStates = [...prev.states, newState];
      return {
        ...prev,
        states: nextStates,
        defaultStateId: prev.defaultStateId || newState.id,
      };
    });
  }, [updateConfig]);

  const updateState = useCallback((stateId: string, updates: Partial<PreviewState>) => {
    updateConfig((prev) => ({
      ...prev,
      states: prev.states.map((state) =>
        state.id === stateId ? { ...state, ...updates } : state
      ),
    }));
  }, [updateConfig]);

  const removeState = useCallback((stateId: string) => {
    updateConfig((prev) => {
      const remainingStates = prev.states.filter((state) => state.id !== stateId);
      const remainingBindings = prev.keyBindings.filter(
        (binding) => binding.stateId !== stateId
      );
      const nextDefault =
        prev.defaultStateId === stateId
          ? remainingStates[0]?.id ?? ""
          : prev.defaultStateId;

      return {
        ...prev,
        states: remainingStates,
        keyBindings: remainingBindings,
        defaultStateId: nextDefault,
      };
    });
  }, [updateConfig]);

  const addKeyBinding = useCallback((binding: Omit<KeyBinding, "id">) => {
    updateConfig((prev) => ({
      ...prev,
      keyBindings: [
        ...prev.keyBindings,
        { ...binding, id: crypto.randomUUID() },
      ],
    }));
  }, [updateConfig]);

  const removeKeyBinding = useCallback((bindingId: string) => {
    updateConfig((prev) => ({
      ...prev,
      keyBindings: prev.keyBindings.filter((b) => b.id !== bindingId),
    }));
  }, [updateConfig]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    config,
    isLoading,
    error,
    setDefaultState,
    addState,
    updateState,
    removeState,
    addKeyBinding,
    removeKeyBinding,
  };
}
