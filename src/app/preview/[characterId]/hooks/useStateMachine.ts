"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  PreviewConfig,
  TransitionLogEntry,
  TransitionTrigger,
  AnimationState,
  PreviewState,
  StatePhase,
} from "../types";
import { logger } from "@/lib/logger";

interface UseStateMachineOptions {
  config: PreviewConfig | null;
  animations: AnimationState[];
}

interface TriggerOptions {
  key?: string;
  autoExit?: boolean;
  exitToStateId?: string;
}

interface UseStateMachineReturn {
  currentStateId: string | null;
  currentPhase: StatePhase;
  currentClipId: string | null;
  transitionLog: TransitionLogEntry[];
  triggerState: (stateId: string, trigger: TransitionTrigger, options?: TriggerOptions) => void;
  releaseState: (stateId: string, trigger: TransitionTrigger, key?: string) => void;
  forceState: (stateId: string) => void;
  playSequence: (stateIds: string[]) => void;
  handleClipComplete: () => void;
  clearLog: () => void;
}

interface ClipIds {
  entryId: string | null;
  loopId: string | null;
  exitId: string | null;
}

export function useStateMachine({
  config,
  animations,
}: UseStateMachineOptions): UseStateMachineReturn {
  const [currentStateId, setCurrentStateId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<StatePhase>("loop");
  const [currentClipId, setCurrentClipId] = useState<string | null>(null);
  const [transitionLog, setTransitionLog] = useState<TransitionLogEntry[]>([]);

  const pendingStateRef = useRef<string | null>(null);
  const pendingTriggerRef = useRef<TransitionTrigger>("auto");
  const pendingKeyRef = useRef<string | undefined>(undefined);
  const pendingOptionsRef = useRef<TriggerOptions | undefined>(undefined);
  const autoExitRef = useRef(false);
  const autoExitTargetRef = useRef<string | null>(null);
  const autoExitTriggerRef = useRef<TransitionTrigger>("auto");

  const sequenceActiveRef = useRef(false);
  const sequenceRef = useRef<string[]>([]);
  const sequenceIndexRef = useRef<number>(0);

  const animationsById = useMemo(() => {
    return new Map<string, AnimationState>(animations.map((anim) => [anim.id, anim]));
  }, [animations]);

  const statesById = useMemo(() => {
    return new Map<string, PreviewState>(
      (config?.states ?? []).map((state) => [state.id, state])
    );
  }, [config?.states]);

  const addLogEntry = useCallback(
    (fromState: string, toState: string, trigger: TransitionTrigger, key?: string) => {
      const entry: TransitionLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        fromState,
        toState,
        trigger,
        key,
      };

      setTransitionLog((prev) => [entry, ...prev].slice(0, 50));
    },
    []
  );

  const getState = useCallback(
    (stateId: string): PreviewState | null => {
      return statesById.get(stateId) ?? null;
    },
    [statesById]
  );

  const getClipIds = useCallback(
    (state: PreviewState): ClipIds => {
      const entryId =
        state.entryAnimationId && animationsById.has(state.entryAnimationId)
          ? state.entryAnimationId
          : null;
      const loopId =
        state.loopAnimationId && animationsById.has(state.loopAnimationId)
          ? state.loopAnimationId
          : null;
      const exitId =
        state.exitAnimationId && animationsById.has(state.exitAnimationId)
          ? state.exitAnimationId
          : null;

      return { entryId, loopId, exitId };
    },
    [animationsById]
  );

  const setPhase = useCallback((phase: StatePhase, clipId: string | null) => {
    setCurrentPhase(phase);
    setCurrentClipId(clipId);
  }, []);

  const clearSequence = useCallback(() => {
    sequenceActiveRef.current = false;
    sequenceRef.current = [];
    sequenceIndexRef.current = 0;
  }, []);

  const getSequenceNextStateId = useCallback((stateId: string): string | null => {
    const sequence = sequenceRef.current;
    if (sequence.length === 0) return null;

    let index = sequenceIndexRef.current;
    if (sequence[index] !== stateId) {
      const foundIndex = sequence.indexOf(stateId);
      if (foundIndex === -1) return null;
      sequenceIndexRef.current = foundIndex;
      index = foundIndex;
    }

    return sequence[index + 1] ?? null;
  }, []);

  const startState = useCallback(
    (stateId: string, trigger: TransitionTrigger, options?: TriggerOptions) => {
      const state = getState(stateId);
      if (!state) {
        logger.warn("Preview state machine: unknown state", { stateId });
        return;
      }

      const { entryId, loopId } = getClipIds(state);
      if (!entryId && !loopId) {
        logger.warn("Preview state machine: state has no playable clips", {
          stateId,
        });
        return;
      }

      const fromState = currentStateId ?? "none";
      addLogEntry(fromState, stateId, trigger, options?.key);

      setCurrentStateId(stateId);
      pendingStateRef.current = null;
      pendingTriggerRef.current = "auto";
      pendingKeyRef.current = undefined;
      pendingOptionsRef.current = undefined;

      const initialPhase: StatePhase = entryId ? "entry" : "loop";
      setPhase(initialPhase, entryId ?? loopId);

      let autoExit = options?.autoExit ?? false;
      let exitTarget =
        options?.exitToStateId ?? state.exitToStateId ?? config?.defaultStateId ?? null;
      let autoTrigger: TransitionTrigger = "auto";

      if (trigger === "sequence") {
        if (sequenceActiveRef.current) {
          autoExit = true;
          autoTrigger = "sequence";
          const nextStateId = getSequenceNextStateId(stateId);
          exitTarget = nextStateId ?? config?.defaultStateId ?? null;
          if (!nextStateId) {
            clearSequence();
          }
        } else {
          clearSequence();
        }
      } else {
        clearSequence();
      }

      autoExitRef.current = autoExit;
      autoExitTargetRef.current = exitTarget;
      autoExitTriggerRef.current = autoTrigger;

    },
    [
      addLogEntry,
      clearSequence,
      config?.defaultStateId,
      currentStateId,
      getClipIds,
      getSequenceNextStateId,
      getState,
      setPhase,
    ]
  );

  const beginExit = useCallback(
    (targetStateId: string, trigger: TransitionTrigger, options?: TriggerOptions) => {
      if (!currentStateId) return;

      const state = getState(currentStateId);
      if (!state) return;

      const { exitId } = getClipIds(state);
      if (!exitId) {
        if (targetStateId) {
          startState(targetStateId, trigger, options);
        }
        return;
      }

      pendingStateRef.current = targetStateId;
      pendingTriggerRef.current = trigger;
      pendingKeyRef.current = options?.key;
      pendingOptionsRef.current = options;
      setPhase("exit", exitId);
    },
    [currentStateId, getClipIds, getState, setPhase, startState]
  );

  const triggerState = useCallback(
    (stateId: string, trigger: TransitionTrigger, options?: TriggerOptions) => {
      if (!config) return;
      if (!stateId) return;

      if (currentStateId === null) {
        startState(stateId, trigger, options);
        return;
      }

      if (currentStateId === stateId && currentPhase !== "exit") {
        if (options?.autoExit) {
          autoExitRef.current = true;
          autoExitTargetRef.current =
            options.exitToStateId ?? getState(stateId)?.exitToStateId ?? config.defaultStateId;
          autoExitTriggerRef.current = trigger === "sequence" ? "sequence" : "auto";
        }
        return;
      }

      if (currentPhase === "exit") {
        pendingStateRef.current = stateId;
        pendingTriggerRef.current = trigger;
        pendingKeyRef.current = options?.key;
        pendingOptionsRef.current = options;
        return;
      }

      beginExit(stateId, trigger, options);
    },
    [
      beginExit,
      config,
      currentPhase,
      currentStateId,
      getState,
      startState,
    ]
  );

  const releaseState = useCallback(
    (stateId: string, trigger: TransitionTrigger, key?: string) => {
      if (!currentStateId || currentStateId !== stateId) return;
      if (!config) return;

      const state = getState(stateId);
      if (!state) return;

      autoExitRef.current = false;
      const exitTarget =
        state.exitToStateId ?? config.defaultStateId ?? "";
      if (!exitTarget) return;

      beginExit(exitTarget, trigger, { key });
    },
    [beginExit, config, currentStateId, getState]
  );

  const forceState = useCallback(
    (stateId: string) => {
      triggerState(stateId, "force");
    },
    [triggerState]
  );

  const playSequence = useCallback(
    (stateIds: string[]) => {
      if (!config) return;
      if (stateIds.length === 0) return;

      sequenceActiveRef.current = true;
      sequenceRef.current = stateIds;
      sequenceIndexRef.current = 0;

      triggerState(stateIds[0], "sequence", { autoExit: true });
    },
    [config, triggerState]
  );

  const handleClipComplete = useCallback(() => {
    if (!currentStateId) return;

    const state = getState(currentStateId);
    if (!state) return;

    const { entryId, loopId } = getClipIds(state);
    const effectiveLoopId = loopId ?? entryId;
    const hasLoopClip = Boolean(loopId);

    if (currentPhase === "entry") {
      if (hasLoopClip && loopId) {
        setPhase("loop", loopId);
        return;
      }

      if (autoExitRef.current) {
        const target =
          autoExitTargetRef.current ?? config?.defaultStateId ?? "";
        if (target) {
          beginExit(target, autoExitTriggerRef.current);
        }
        return;
      }

      if (effectiveLoopId) {
        setPhase("loop", effectiveLoopId);
      }
      return;
    }

    if (currentPhase === "loop") {
      if (autoExitRef.current) {
        const target =
          autoExitTargetRef.current ?? config?.defaultStateId ?? "";
        if (target) {
          beginExit(target, autoExitTriggerRef.current);
        }
      }
      return;
    }

    if (currentPhase === "exit") {
      const pendingState = pendingStateRef.current;
      if (pendingState) {
        const trigger = pendingTriggerRef.current;
        const pendingOptions = pendingOptionsRef.current;
        const key = pendingKeyRef.current;
        pendingStateRef.current = null;
        pendingTriggerRef.current = "auto";
        pendingKeyRef.current = undefined;
        pendingOptionsRef.current = undefined;
        startState(pendingState, trigger, pendingOptions ?? { key });
      } else if (config?.defaultStateId && currentStateId !== config.defaultStateId) {
        startState(config.defaultStateId, "auto");
      }
    }
  }, [
    beginExit,
    config?.defaultStateId,
    currentPhase,
    currentStateId,
    getClipIds,
    getState,
    setPhase,
    startState,
  ]);

  const clearLog = useCallback(() => {
    setTransitionLog([]);
  }, []);

  useEffect(() => {
    if (!config) return;
    if (currentStateId) return;
    if (!config.defaultStateId) return;
    if (!statesById.has(config.defaultStateId)) return;
    startState(config.defaultStateId, "auto");
  }, [config, currentStateId, startState, statesById]);

  useEffect(() => {
    if (!currentStateId) return;
    if (statesById.has(currentStateId)) return;
    setCurrentStateId(null);
    setCurrentClipId(null);
    setCurrentPhase("loop");
  }, [currentStateId, statesById]);

  useEffect(() => {
    if (!currentStateId) return;
    const state = getState(currentStateId);
    if (!state) return;

    const { entryId, loopId, exitId } = getClipIds(state);
    let nextClipId: string | null = null;

    if (currentPhase === "entry") {
      nextClipId = entryId ?? loopId;
    } else if (currentPhase === "loop") {
      nextClipId = loopId ?? entryId;
    } else if (currentPhase === "exit") {
      nextClipId = exitId ?? loopId ?? entryId;
    }

    if (nextClipId !== currentClipId) {
      setCurrentClipId(nextClipId);
    }
  }, [currentClipId, currentPhase, currentStateId, getClipIds, getState]);

  return {
    currentStateId,
    currentPhase,
    currentClipId,
    transitionLog,
    triggerState,
    releaseState,
    forceState,
    playSequence,
    handleClipComplete,
    clearLog,
  };
}
