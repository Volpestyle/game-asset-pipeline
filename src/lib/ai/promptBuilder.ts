import type { PromptProfile } from "@/types";
import type { LoopMode } from "@/lib/frameUtils";

const ANIMATION_STYLE_HINTS_VERBOSE: Record<string, string> = {
  idle: "subtle breathing, gentle sway, standing in relaxed pose",
};

const ANIMATION_STYLE_HINTS_CONCISE: Record<string, string> = {
  idle: "idling animation loop, subtle idle movements",
  walk: "looping walk cycle",
  run: "looping run cycle",
  attack: "attack animation",
  jump: "jump animation",
};

const ANIMATION_STYLE_HINTS_CONCISE_NO_LOOP: Record<string, string> = {
  idle: "idle animation, subtle idle movements",
  walk: "walk animation",
  run: "run animation",
  attack: "attack animation",
  jump: "jump animation",
};

type ArtStyleConfig = {
  label: string;
  conciseLabel: string;
  constraints: string[];
};

const ART_STYLE_PROMPTS: Record<string, ArtStyleConfig> = {
  "pixel-art": {
    label: "pixel art sprite",
    conciseLabel: "pixel art character animation",
    constraints: [
      "limited color palette",
      "crisp hard edges",
      "no anti-aliasing",
      "no motion blur",
    ],
  },
  "hand-drawn": {
    label: "hand-drawn 2d sprite",
    conciseLabel: "hand-drawn 2d character animation",
    constraints: ["clean linework", "flat shading", "no motion blur"],
  },
  "3d-rendered": {
    label: "3d rendered character sprite",
    conciseLabel: "3d rendered character animation",
    constraints: ["clean lighting", "no motion blur"],
  },
  anime: {
    label: "anime-style character sprite",
    conciseLabel: "anime-style character animation",
    constraints: ["clean lineart", "cel shading", "no motion blur"],
  },
  realistic: {
    label: "realistic character sprite",
    conciseLabel: "realistic character animation",
    constraints: ["natural lighting", "no motion blur"],
  },
  custom: {
    label: "character sprite",
    conciseLabel: "character animation",
    constraints: ["no motion blur"],
  },
};

const DEFAULT_CHARACTER_TYPE = "video game character";

export function buildVideoPrompt(options: {
  description: string;
  style?: string;
  artStyle?: string;
  bgKeyColor?: string;
  promptProfile?: PromptProfile;
  loopMode?: LoopMode;
}) {
  const styleKey = options.style ?? "";
  const promptProfile = options.promptProfile ?? "verbose";
  const resolvedLoopMode: LoopMode =
    options.loopMode === "none" || options.loopMode === "pingpong"
      ? options.loopMode
      : "loop";
  const styleHintSource =
    promptProfile === "concise"
      ? resolvedLoopMode === "none"
        ? ANIMATION_STYLE_HINTS_CONCISE_NO_LOOP
        : ANIMATION_STYLE_HINTS_CONCISE
      : ANIMATION_STYLE_HINTS_VERBOSE;
  const styleHint =
    styleHintSource[styleKey] ?? (styleKey ? `${styleKey} animation` : "");
  const artStyleKey = options.artStyle ?? "pixel-art";
  const artConfig =
    ART_STYLE_PROMPTS[artStyleKey] ?? ART_STYLE_PROMPTS.custom;

  if (promptProfile === "concise") {
    const base = options.description.trim();
    const parts = [
      base,
      artConfig.conciseLabel || artConfig.label,
      DEFAULT_CHARACTER_TYPE,
      styleHint,
    ].filter(Boolean);
    if (resolvedLoopMode === "none") {
      parts.push("non-looping");
    }
    return parts.join(", ");
  }

  const loopConstraint =
    resolvedLoopMode === "none"
      ? "non-looping animation, start and end poses can differ"
      : "seamless looping animation, first and last pose match";
  const parts = [
    options.description,
    DEFAULT_CHARACTER_TYPE,
    styleHint,
    artConfig.label,
    ...artConfig.constraints,
    "static camera",
    "character stays centered, no camera movement",
    "keep proportions and identity identical to reference",
    loopConstraint,
  ]
    .filter(Boolean)
    .join(", ");

  return parts;
}
