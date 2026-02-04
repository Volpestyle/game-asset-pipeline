"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { ArrowLeft } from "lucide-react";
import type { Character, Animation } from "@/types";
import type { AnimationState, KeyBinding } from "./types";
import { logger } from "@/lib/logger";

import { usePreviewConfig } from "./hooks/usePreviewConfig";
import { useStateMachine } from "./hooks/useStateMachine";
import { useKeyboardController } from "./hooks/useKeyboardController";

import { InteractivePreview } from "./components/InteractivePreview";
import { StateList } from "./components/StateList";
import { CurrentStatePanel } from "./components/CurrentStatePanel";
import { KeyBindingModal } from "./components/KeyBindingModal";
import { StateEditor } from "./components/StateEditor";
import { SequenceQueuePanel } from "./components/SequenceQueuePanel";
import { TransitionLog } from "./components/TransitionLog";

interface PageProps {
  params: Promise<{ characterId: string }>;
}

export default function PreviewCharacterPage({ params }: PageProps) {
  const { characterId } = use(params);

  const [character, setCharacter] = useState<Character | null>(null);
  const [animationStates, setAnimationStates] = useState<AnimationState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showKeyBindingModal, setShowKeyBindingModal] = useState(false);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Load character and animations
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Load character
        const charResponse = await fetch(`/api/characters/${characterId}`);
        if (!charResponse.ok) {
          throw new Error("Failed to load character");
        }
        const charData = await charResponse.json();
        setCharacter(charData.character);

        // Load all animations
        const animResponse = await fetch("/api/animations");
        if (!animResponse.ok) {
          throw new Error("Failed to load animations");
        }
        const animData = await animResponse.json();

        // Filter animations for this character
        const characterAnimations = (animData.animations as Animation[]).filter(
          (anim) => anim.characterId === characterId
        );

        // Convert to AnimationState format
        const states: AnimationState[] = characterAnimations
          .filter((anim) => anim.generatedSpritesheet)
          .map((anim) => ({
            id: anim.id,
            name: anim.name,
            frameCount: anim.actualFrameCount ?? anim.frameCount,
            fps: anim.fps,
            spritesheetUrl: anim.generatedSpritesheet,
            frameWidth: anim.spritesheetLayout?.frameWidth ?? anim.frameWidth ?? 64,
            frameHeight: anim.spritesheetLayout?.frameHeight ?? anim.frameHeight ?? 64,
            columns: anim.spritesheetLayout?.columns ?? anim.sheetColumns ?? 6,
          }));

        setAnimationStates(states);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        logger.error("Preview: failed to load character or animations", {
          characterId,
          error: message,
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [characterId]);

  // Preview config hook
  const {
    config,
    isLoading: configLoading,
    error: configError,
    setDefaultState,
    addState,
    updateState,
    removeState,
    addKeyBinding,
    removeKeyBinding,
  } = usePreviewConfig({ characterId });

  // State machine hook
  const {
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
  } = useStateMachine({
    config,
    animations: animationStates,
  });

  // Keyboard controller hook
  const handleKeyTrigger = useCallback(
    (binding: KeyBinding, key: string) => {
      const autoExit = binding.behavior === "trigger-once";
      triggerState(binding.stateId, "key", { key, autoExit });
    },
    [triggerState]
  );

  const handleKeyRelease = useCallback(
    (binding: KeyBinding, key: string) => {
      releaseState(binding.stateId, "release", key);
    },
    [releaseState]
  );

  useKeyboardController({
    keyBindings: config?.keyBindings ?? [],
    onKeyTrigger: handleKeyTrigger,
    onKeyRelease: handleKeyRelease,
    enabled: !showKeyBindingModal,
  });

  const currentClip =
    animationStates.find((clip) => clip.id === currentClipId) ?? null;
  const currentState =
    config?.states.find((state) => state.id === currentStateId) ?? null;

  const selectedState =
    config?.states.find((state) => state.id === selectedStateId) ?? null;

  const handleSelectState = useCallback(
    (stateId: string) => {
      setSelectedStateId(stateId);
      forceState(stateId);
    },
    [forceState]
  );

  const handlePlaySequence = useCallback(
    (sequence: string[]) => {
      if (sequence.length === 0) return;
      playSequence(sequence);
    },
    [playSequence]
  );

  useEffect(() => {
    if (!config?.states.length) {
      setSelectedStateId(null);
      return;
    }

    if (selectedStateId && config.states.some((state) => state.id === selectedStateId)) {
      return;
    }

    const nextSelected = config.defaultStateId || config.states[0]?.id || null;
    setSelectedStateId(nextSelected);
  }, [config?.defaultStateId, config?.states, selectedStateId]);

  useEffect(() => {
    if (!currentStateId) return;
    setSelectedStateId((prev) => prev ?? currentStateId);
  }, [currentStateId]);

  if (isLoading || configLoading) {
    return (
      <div className="min-h-screen grid-bg">
        <Header breadcrumb="Loading..." />
        <main className="pt-14 pb-6 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
            <span className="text-xs text-muted-foreground animate-pulse">
              Loading preview...
            </span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="min-h-screen grid-bg">
        <Header breadcrumb="Error" />
        <main className="pt-14 pb-6 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="tech-border bg-card p-6 text-center space-y-4">
              <p className="text-xs text-destructive">{error ?? "Character not found"}</p>
              <Link href="/preview">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="size-3 mr-2" />
                  Back to Preview
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg">
      <Header
        breadcrumb={[
          { label: "Preview", href: "/preview" },
          { label: character.name },
        ]}
      >
        <div className="flex items-center gap-2">
          <div className="status-dot status-dot-online animate-pulse-terminal" />
          <span className="text-xs text-muted-foreground">ACTIVE</span>
        </div>
      </Header>

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {configError && (
            <div className="tech-border bg-card p-4 text-xs text-destructive">
              Failed to load preview config. Using defaults until it can be saved.
            </div>
          )}
          {animationStates.length === 0 && (
            <div className="tech-border bg-card p-4 text-xs text-muted-foreground">
              No generated spritesheets found for this character. Create animations
              and generate spritesheets before wiring states.
            </div>
          )}

          {/* Top row: State list + Interactive Preview */}
          <div className="grid grid-cols-12 gap-4">
            {/* Left column: State list and bindings */}
            <div className="col-span-3 space-y-4">
              <StateList
                states={config?.states ?? []}
                defaultStateId={config?.defaultStateId ?? ""}
                currentStateId={currentStateId}
                selectedStateId={selectedStateId}
                keyBindings={config?.keyBindings ?? []}
                onSetDefault={setDefaultState}
                onSelect={handleSelectState}
                onAddState={addState}
              />

              <div className="tech-border bg-card">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground tracking-wider">
                    KEY BINDINGS
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {config?.keyBindings.length ?? 0}
                  </span>
                </div>
                <div className="p-3">
                  <button
                    onClick={() => setShowKeyBindingModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] text-muted-foreground bg-secondary/50 hover:bg-secondary transition-colors"
                    disabled={!config?.states.length}
                  >
                    EDIT BINDINGS
                  </button>
                </div>
              </div>

              <CurrentStatePanel
                currentState={currentState}
                currentClip={currentClip}
                phase={currentPhase}
                isDefault={currentState?.id === config?.defaultStateId}
              />
            </div>

            {/* Center column: Interactive Preview */}
            <div className="col-span-6">
              <InteractivePreview
                clip={currentClip}
                stateName={currentState?.name ?? null}
                phase={currentPhase}
                onClipComplete={handleClipComplete}
              />
            </div>

            {/* Right column: State editor */}
            <div className="col-span-3 space-y-4">
              <StateEditor
                state={selectedState}
                states={config?.states ?? []}
                animations={animationStates}
                onUpdate={updateState}
                onDelete={removeState}
              />
            </div>
          </div>

          {/* Bottom row: Sequence Queue and Transition Log */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-5">
              <SequenceQueuePanel
                states={config?.states ?? []}
                onPlaySequence={handlePlaySequence}
              />
            </div>
            <div className="col-span-7">
              <TransitionLog
                entries={transitionLog}
                states={config?.states ?? []}
                startTime={startTimeRef.current}
                onClear={clearLog}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Key Binding Modal */}
      <KeyBindingModal
        open={showKeyBindingModal}
        onOpenChange={setShowKeyBindingModal}
        states={config?.states ?? []}
        keyBindings={config?.keyBindings ?? []}
        onAdd={addKeyBinding}
        onRemove={removeKeyBinding}
      />
    </div>
  );
}
