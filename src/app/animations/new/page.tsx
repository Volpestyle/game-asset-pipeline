"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout";
import type {
  AnimationStyle,
  Character,
  GenerationProvider,
  PromptProfile,
} from "@/types";
import { buildVideoPrompt } from "@/lib/ai/promptBuilder";
import {
  EXTRACT_FPS_OPTIONS,
  coerceVideoSizeForModel,
  coerceVideoSecondsForModel,
  getDefaultVideoSize,
  getDefaultVideoSeconds,
  getVideoSizeOptions,
  getVideoSecondsOptions,
  getVideoModelOptions,
  getVideoModelPromptProfile,
  getVideoModelSupportsNegativePrompt,
  isSizeValidForModel,
  getExpectedFrameCount,
} from "@/components/animation";

const STYLE_OPTIONS: { value: AnimationStyle; label: string; code: string }[] = [
  { value: "idle", label: "Idle", code: "IDL" },
  { value: "walk", label: "Walk", code: "WLK" },
  { value: "run", label: "Run", code: "RUN" },
  { value: "attack", label: "Attack", code: "ATK" },
  { value: "jump", label: "Jump", code: "JMP" },
  { value: "custom", label: "Custom", code: "CST" },
];

const LOOP_OPTIONS: { value: "pingpong" | "loop"; label: string }[] = [
  { value: "pingpong", label: "Ping-pong (safe loop)" },
  { value: "loop", label: "Loop (end frame = start frame)" },
];

const PROMPT_PROFILE_OPTIONS: { value: PromptProfile; label: string }[] = [
  { value: "concise", label: "Concise" },
  { value: "verbose", label: "Verbose" },
];

const PROVIDER_OPTIONS: { value: GenerationProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "replicate", label: "Replicate" },
  { value: "fal", label: "Fal" },
  { value: "vertex", label: "Vertex AI" },
];

const NewAnimationForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCharacter = searchParams.get("characterId") ?? "";

  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterId, setCharacterId] = useState(preselectedCharacter);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<AnimationStyle>("idle");
  const defaultModel = "sora-2";
  const [generationProvider, setGenerationProvider] = useState<GenerationProvider>("openai");
  const [generationModel, setGenerationModel] = useState(defaultModel);
  const [generationSeconds, setGenerationSeconds] = useState(() =>
    getDefaultVideoSeconds(defaultModel)
  );
  const [generationSize, setGenerationSize] = useState(() =>
    getDefaultVideoSize(defaultModel)
  );
  const [generationLoop, setGenerationLoop] = useState(false);
  const [tooncrafterInterpolate, setTooncrafterInterpolate] = useState(false);
  const [tooncrafterColorCorrection, setTooncrafterColorCorrection] = useState(true);
  const [tooncrafterSeed, setTooncrafterSeed] = useState("");
  const [tooncrafterNegativePrompt, setTooncrafterNegativePrompt] = useState("");
  const [tooncrafterEmptyPrompt, setTooncrafterEmptyPrompt] = useState(false);
  const [generationNegativePrompt, setGenerationNegativePrompt] = useState("");
  const [promptProfile, setPromptProfile] = useState<PromptProfile>(() =>
    getVideoModelPromptProfile(defaultModel)
  );
  const [promptProfileTouched, setPromptProfileTouched] = useState(false);
  const [promptConcise, setPromptConcise] = useState("");
  const [promptVerbose, setPromptVerbose] = useState("");
  const [isPromptEditing, setIsPromptEditing] = useState(false);
  const [draftPromptConcise, setDraftPromptConcise] = useState("");
  const [draftPromptVerbose, setDraftPromptVerbose] = useState("");
  const [extractFps, setExtractFps] = useState(12);
  const [loopMode, setLoopMode] = useState<"pingpong" | "loop">("loop");
  const [sheetColumns, setSheetColumns] = useState(6);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === characterId),
    [characters, characterId]
  );

  const canCreate =
    Boolean(characterId) &&
    Boolean(name.trim()) &&
    Boolean(generationProvider) &&
    (style !== "custom" || Boolean(description.trim()));
  const expectedFrameCount = getExpectedFrameCount(generationSeconds, extractFps);
  const loopedFrameCount =
    loopMode === "pingpong"
      ? Math.max(1, expectedFrameCount * 2 - 2)
      : expectedFrameCount;
  const supportsNegativePrompt = getVideoModelSupportsNegativePrompt(generationModel);
  const isToonCrafter = generationModel === "tooncrafter";
  const isPikaframes = generationModel === "pikaframes";
  const isWan = generationModel === "wan2.2";

  const frameWidth = selectedCharacter?.baseWidth ?? 253;
  const frameHeight = selectedCharacter?.baseHeight ?? 504;
  const autoPromptConcise = useMemo(
    () =>
      buildVideoPrompt({
        description,
        style,
        artStyle: selectedCharacter?.style ?? "pixel-art",
        bgKeyColor: selectedCharacter?.workingSpec?.bgKeyColor,
        promptProfile: "concise",
      }),
    [description, style, selectedCharacter?.style, selectedCharacter?.workingSpec?.bgKeyColor]
  );
  const autoPromptVerbose = useMemo(
    () =>
      buildVideoPrompt({
        description,
        style,
        artStyle: selectedCharacter?.style ?? "pixel-art",
        bgKeyColor: selectedCharacter?.workingSpec?.bgKeyColor,
        promptProfile: "verbose",
      }),
    [description, style, selectedCharacter?.style, selectedCharacter?.workingSpec?.bgKeyColor]
  );
  const effectivePromptConcise = promptConcise.trim()
    ? promptConcise
    : autoPromptConcise;
  const effectivePromptVerbose = promptVerbose.trim()
    ? promptVerbose
    : autoPromptVerbose;
  const usesEmptyPrompt = isToonCrafter && tooncrafterEmptyPrompt;
  const promptPreview = usesEmptyPrompt
    ? "Empty prompt enabled."
    : isPromptEditing
    ? promptProfile === "concise"
      ? draftPromptConcise
      : draftPromptVerbose
    : promptProfile === "concise"
    ? effectivePromptConcise
    : effectivePromptVerbose;
  const sizeOptions = useMemo(
    () => getVideoSizeOptions(generationModel),
    [generationModel]
  );
  const durationOptions = useMemo(
    () => getVideoSecondsOptions(generationModel),
    [generationModel]
  );
  const allModelOptions = useMemo(() => getVideoModelOptions(), []);
  const modelOptions = useMemo(
    () => allModelOptions.filter((option) => option.provider === generationProvider),
    [allModelOptions, generationProvider]
  );

  const applyModelChange = useCallback((nextModel: string) => {
    const nextSize = isSizeValidForModel(generationSize, nextModel)
      ? generationSize
      : coerceVideoSizeForModel(generationSize, nextModel);
    const nextSeconds = coerceVideoSecondsForModel(generationSeconds, nextModel);
    if (!promptProfileTouched) {
      setPromptProfile(getVideoModelPromptProfile(nextModel));
    }
    setGenerationModel(nextModel);
    setGenerationSize(nextSize);
    setGenerationSeconds(nextSeconds);
  }, [generationSeconds, generationSize, promptProfileTouched]);

  const loadCharacters = async () => {
    try {
      const response = await fetch("/api/characters", { cache: "no-store" });
      const data = await response.json();
      setCharacters(data.characters ?? []);
    } catch {
      setCharacters([]);
    }
  };

  useEffect(() => {
    void loadCharacters();
  }, []);

  useEffect(() => {
    if (!isPromptEditing) {
      setDraftPromptConcise(effectivePromptConcise);
      setDraftPromptVerbose(effectivePromptVerbose);
    }
  }, [effectivePromptConcise, effectivePromptVerbose, isPromptEditing]);

  useEffect(() => {
    if (!modelOptions.length) return;
    const matchesProvider = modelOptions.some(
      (option) => option.value === generationModel
    );
    if (!matchesProvider) {
      applyModelChange(modelOptions[0].value);
    }
  }, [applyModelChange, generationModel, modelOptions]);

  const handleCreate = async () => {
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          name: name.trim(),
          description: description.trim(),
          style,
          generationProvider,
          generationModel,
          promptProfile,
          promptConcise,
          promptVerbose,
          generationNegativePrompt: generationNegativePrompt.trim()
            ? generationNegativePrompt.trim()
            : null,
          generationSeconds,
          generationSize,
          generationLoop,
          tooncrafterInterpolate,
          tooncrafterColorCorrection,
          tooncrafterNegativePrompt: tooncrafterNegativePrompt.trim()
            ? tooncrafterNegativePrompt.trim()
            : null,
          tooncrafterEmptyPrompt,
          tooncrafterSeed: tooncrafterSeed.trim()
            ? Number(tooncrafterSeed)
            : null,
          extractFps,
          loopMode,
          sheetColumns,
          frameCount: expectedFrameCount,
          fps: extractFps,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to create animation.");
      }

      const data = await response.json();
      router.push(`/animations/${data.animation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create animation.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg">
      <Header
        breadcrumb={[
          { label: "Dashboard", href: "/" },
          { label: "Animations", href: "/animations" },
          { label: "New" },
        ]}
      >
        <Button
          onClick={handleCreate}
          disabled={!canCreate || isCreating}
          className="bg-primary hover:bg-primary/80 text-primary-foreground h-7 px-3 text-xs tracking-wider disabled:opacity-40"
        >
          {isCreating ? "PROCESSING..." : "CREATE"}
        </Button>
      </Header>

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground tracking-wider">Animation Configuration</span>
              </div>
              <div className="p-4 text-xs text-muted-foreground leading-relaxed">
                Define the motion prompt and video settings. The generation step produces a video from your character reference and extracts sprite frames.
              </div>
            </div>
            <div className="col-span-4 tech-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground tracking-wider">Status</span>
                <div className="flex items-center gap-2">
                  <div className={`status-dot ${canCreate ? "status-dot-online" : "status-dot-warning"}`} />
                  <span className={`text-xs ${canCreate ? "text-success" : "text-warning"}`}>
                    {canCreate ? "Ready" : "Incomplete"}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Character</span>
                  <span className={selectedCharacter ? "text-success" : "text-warning"}>
                    {selectedCharacter ? "Set" : "Required"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frames</span>
                  <span>{expectedFrameCount} base</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Looped</span>
                  <span>{loopedFrameCount} frames</span>
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-6">
            <div className="grid lg:grid-cols-[200px,1fr] gap-6 items-start">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider mb-1">Target</p>
                <p className="text-sm font-medium">Character</p>
              </div>
              <div>
                <select
                  value={characterId}
                  onChange={(event) => setCharacterId(event.target.value)}
                  className="terminal-input w-full h-10 px-3 text-sm bg-card"
                >
                  <option value="">Select character...</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} ({character.style})
                    </option>
                  ))}
                </select>
                {characters.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    No characters found.{" "}
                    <Link href="/characters/new" className="text-primary hover:underline">
                      Create one first
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-[200px,1fr] gap-6 items-start">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider mb-1">Identifier</p>
                <p className="text-sm font-medium">Animation Name</p>
              </div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="idle_breathing, attack_combo..."
                className="terminal-input w-full h-10 px-3 text-sm bg-card"
              />
            </div>

            <div className="grid lg:grid-cols-[200px,1fr] gap-6 items-start">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider mb-1">Description</p>
                <p className="text-sm font-medium">Action Prompt</p>
              </div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Describe the motion phases and style..."
                className="terminal-input w-full p-3 text-sm bg-card resize-none"
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground tracking-wider mb-1">Animation Style</p>
              <p className="text-sm font-medium">Preset</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStyle(option.value)}
                  className={`tech-border p-4 text-left transition-all duration-150 ${
                    style === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={style === option.value ? "text-primary text-xs font-medium" : "text-xs font-medium"}>
                      {option.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 border ${
                        style === option.value
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {option.code}
                    </span>
                  </div>
                  <div className={style === option.value ? "h-1 w-full bg-primary" : "h-1 w-full bg-border"} />
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground tracking-wider mb-1">Prompt Preview</p>
              <p className="text-sm font-medium">Generation Prompt</p>
            </div>
            <div className="tech-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="tracking-widest">Profile</span>
                <span className="text-primary">{promptProfile}</span>
              </div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {promptPreview}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground tracking-wider mb-1">Prompt Overrides</p>
              <p className="text-sm font-medium">Concise + Verbose</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftPromptConcise(effectivePromptConcise);
                  setDraftPromptVerbose(effectivePromptVerbose);
                  setIsPromptEditing(true);
                }}
                disabled={isPromptEditing}
                className="px-3 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setPromptConcise(draftPromptConcise);
                  setPromptVerbose(draftPromptVerbose);
                  setIsPromptEditing(false);
                }}
                disabled={!isPromptEditing}
                className="px-3 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setPromptConcise("");
                  setPromptVerbose("");
                  setDraftPromptConcise(autoPromptConcise);
                  setDraftPromptVerbose(autoPromptVerbose);
                  setIsPromptEditing(false);
                }}
                className="px-3 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
              >
                Reset
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-wider">Concise Prompt</p>
                <textarea
                  value={isPromptEditing ? draftPromptConcise : effectivePromptConcise}
                  onChange={(event) => {
                    setDraftPromptConcise(event.target.value);
                  }}
                  rows={4}
                  placeholder={autoPromptConcise}
                  disabled={!isPromptEditing}
                  className="terminal-input w-full p-3 text-xs bg-card resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank to auto-generate from description + preset.
                </p>
              </div>
              <div className="tech-border bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground tracking-wider">Verbose Prompt</p>
                <textarea
                  value={isPromptEditing ? draftPromptVerbose : effectivePromptVerbose}
                  onChange={(event) => {
                    setDraftPromptVerbose(event.target.value);
                  }}
                  rows={4}
                  placeholder={autoPromptVerbose}
                  disabled={!isPromptEditing}
                  className="terminal-input w-full p-3 text-xs bg-card resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank to auto-generate with full constraints.
                </p>
              </div>
            </div>
          </section>

          {supportsNegativePrompt && !isToonCrafter && (
            <section className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider mb-1">
                  Negative Prompt
                </p>
                <p className="text-sm font-medium">Optional</p>
              </div>
              <div className="tech-border bg-card p-4 space-y-2">
                <textarea
                  value={generationNegativePrompt}
                  onChange={(event) => setGenerationNegativePrompt(event.target.value)}
                  rows={3}
                  placeholder="Optional: avoid artifacts, extra limbs, blur..."
                  className="terminal-input w-full p-3 text-xs bg-card resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  Sent as negative_prompt for supported models.
                </p>
              </div>
            </section>
          )}

          <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Provider</p>
              <select
                value={generationProvider}
                onChange={(event) => {
                  const nextProvider = event.target.value;
                  if (
                    nextProvider === "openai" ||
                    nextProvider === "replicate" ||
                    nextProvider === "fal" ||
                    nextProvider === "vertex"
                  ) {
                    setGenerationProvider(nextProvider);
                  }
                }}
                className="terminal-input w-full h-9 px-3 text-sm bg-card"
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Provider selection is required. Models below are filtered by provider.
              </p>
            </div>
            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Model</p>
              <select
                value={generationModel}
                onChange={(event) => {
                  applyModelChange(event.target.value);
                }}
                className="terminal-input w-full h-9 px-3 text-sm bg-card"
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Pick the provider and fidelity level that fit your output.
              </p>
              {isPikaframes && (
                <p className="text-[10px] text-muted-foreground">
                  Pikaframes uses 2-5 timeline keyframes and derives timing from frame spacing.
                </p>
              )}
              {isWan && (
                <p className="text-[10px] text-muted-foreground">
                  Wan 2.2 uses the Start/End frames panel for overrides.
                </p>
              )}
            </div>

            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Prompt Profile</p>
              <div className="flex flex-wrap gap-2">
                {PROMPT_PROFILE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setPromptProfile(option.value);
                      setPromptProfileTouched(true);
                    }}
                    className={`px-3 py-1 text-xs border ${
                      promptProfile === option.value
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Concise keeps prompts short. Verbose adds stricter constraints.
              </p>
            </div>

            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Clip Duration</p>
              <div className="flex flex-wrap gap-2">
                {durationOptions.map((value) => (
                  <button
                    key={value}
                    onClick={() => setGenerationSeconds(value)}
                    className={`px-3 py-1 text-xs border ${
                      generationSeconds === value
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {value}s
                  </button>
                ))}
              </div>
            </div>

            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Video Size</p>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => setGenerationSize(size)}
                    className={`px-3 py-1 text-xs border ${
                      generationSize === size
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {isToonCrafter && (
              <div className="tech-border bg-card p-4 space-y-3">
                <p className="text-xs text-muted-foreground tracking-wider">ToonCrafter Options</p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generationLoop}
                    onChange={(event) => setGenerationLoop(event.target.checked)}
                    className="form-checkbox"
                  />
                  Loop output
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tooncrafterInterpolate}
                    onChange={(event) => setTooncrafterInterpolate(event.target.checked)}
                    className="form-checkbox"
                  />
                  Interpolate (2x)
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tooncrafterColorCorrection}
                    onChange={(event) => setTooncrafterColorCorrection(event.target.checked)}
                    className="form-checkbox"
                  />
                  Color correction
                </label>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground tracking-wider">Seed</p>
                  <input
                    type="number"
                    value={tooncrafterSeed}
                    onChange={(event) => setTooncrafterSeed(event.target.value)}
                    placeholder="Random"
                    className="terminal-input w-full h-9 px-3 text-sm bg-card"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Leave blank for random.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground tracking-wider">
                    Negative Prompt
                  </p>
                  <textarea
                    value={tooncrafterNegativePrompt}
                    onChange={(event) => setTooncrafterNegativePrompt(event.target.value)}
                    rows={3}
                    placeholder="Optional: avoid artifacts, extra limbs, blur..."
                    className="terminal-input w-full p-3 text-xs bg-card resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Optional. Leave blank to skip.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tooncrafterEmptyPrompt}
                    onChange={(event) => setTooncrafterEmptyPrompt(event.target.checked)}
                    className="form-checkbox"
                  />
                  Send empty prompt (ignore auto + overrides)
                </label>
              </div>
            )}

            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Extract FPS</p>
              <div className="flex flex-wrap gap-2">
                {EXTRACT_FPS_OPTIONS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setExtractFps(value)}
                    className={`px-3 py-1 text-xs border ${
                      extractFps === value
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {value} fps
                  </button>
                ))}
              </div>
            </div>

            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Loop Mode</p>
              <div className="flex flex-col gap-2">
                {LOOP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setLoopMode(option.value)}
                    className={`px-3 py-1 text-xs border text-left ${
                      loopMode === option.value
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Spritesheet Columns</p>
              <input
                type="number"
                min={2}
                max={12}
                value={sheetColumns}
                onChange={(event) => setSheetColumns(Number(event.target.value) || 6)}
                className="terminal-input w-full h-9 px-3 text-sm bg-card"
              />
              <p className="text-[10px] text-muted-foreground">
                Controls sheet packing for exports.
              </p>
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-4">
            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Derived Frames</p>
              <div className="text-2xl font-bold metric-value">
                {expectedFrameCount}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {loopMode === "pingpong"
                  ? `Ping-pong output: ${loopedFrameCount} frames`
                  : `Loop output: ${loopedFrameCount} frames (end frame = start frame)`}
              </p>
            </div>
            <div className="tech-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground tracking-wider">Sprite Frame</p>
              <div className="text-2xl font-bold metric-value">
                {frameWidth}×{frameHeight}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Derived from character reference dimensions.
              </p>
            </div>
          </section>

          {error && (
            <section className="tech-border bg-card p-4 text-xs text-destructive">
              {error}
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default function NewAnimationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid-bg flex items-center justify-center text-xs text-muted-foreground">LOADING...</div>}>
      <NewAnimationForm />
    </Suspense>
  );
}
