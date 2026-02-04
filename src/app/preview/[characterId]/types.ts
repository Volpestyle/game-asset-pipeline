// Preview state machine configuration types

export interface PreviewConfig {
  characterId: string;
  defaultStateId: string;
  states: PreviewState[];
  keyBindings: KeyBinding[];
  createdAt: string;
  updatedAt: string;
}

export interface PreviewState {
  id: string;
  name: string;
  entryAnimationId?: string;
  loopAnimationId?: string;
  exitAnimationId?: string;
  exitToStateId?: string;
}

export interface KeyBinding {
  id: string;
  stateId: string;
  key: string;
  modifiers: KeyModifier[];
  behavior: KeyBehavior;
}

export type KeyModifier = "shift" | "ctrl" | "alt";
export type KeyBehavior = "trigger-once" | "hold" | "toggle";

export type StatePhase = "entry" | "loop" | "exit";

export interface TransitionLogEntry {
  id: string;
  timestamp: number;
  fromState: string;
  toState: string;
  trigger: TransitionTrigger;
  key?: string;
}

export type TransitionTrigger = "key" | "release" | "sequence" | "force" | "auto";

export interface AnimationState {
  id: string;
  name: string;
  frameCount: number;
  fps: number;
  spritesheetUrl?: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
}

export interface QueuedState {
  id: string;
  stateId: string;
  stateName: string;
}

export function createDefaultConfig(characterId: string): PreviewConfig {
  return {
    characterId,
    defaultStateId: "",
    states: [],
    keyBindings: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
