import type { VertexVeoModelId } from "@/lib/ai/vertexVeo";

export type VideoProvider = "openai" | "replicate" | "fal" | "vertex";
export type VideoModelId =
  | "sora-2"
  | "sora-2-pro"
  | "ray2"
  | "pixverse-v5"
  | "tooncrafter"
  | "pikaframes"
  | "wan2.2"
  | "veo-3.1"
  | "veo-3.1-fast"
  | "veo-3.1-generate-preview"
  | "veo-3.1-fast-generate-preview";

export type VideoReferenceConstraints = {
  aspectRatio: "16:9" | "9:16";
  seconds: number;
};

type VideoModelConfig = {
  id: VideoModelId;
  label: string;
  provider: VideoProvider;
  sizeOptions: string[];
  secondsOptions: number[];
  promptProfile?: "verbose" | "concise";
  replicateModel?: string;
  vertexModelId?: VertexVeoModelId;
  supportsStartEnd?: boolean;
  supportsLoop?: boolean;
  supportsNegativePrompt?: boolean;
  startImageKey?: string;
  endImageKey?: string;
  replicateResolutionKey?: "quality" | "resolution" | null;
  replicateSupportsAudio?: boolean;
  supportsSeed?: boolean;
  supportsReferenceImages?: boolean;
  referenceImageLimit?: number;
  referenceImageConstraints?: VideoReferenceConstraints;
  supportsConcepts?: boolean;
  conceptOptions?: string[];
  supportsEffect?: boolean;
};

const RAY2_CONCEPTS = [
  "truck_left",
  "pan_right",
  "pedestal_down",
  "low_angle",
  "pedestal_up",
  "selfie",
  "pan_left",
  "roll_right",
  "zoom_in",
  "over_the_shoulder",
  "orbit_right",
  "orbit_left",
  "static",
  "tiny_planet",
  "high_angle",
  "bolt_cam",
  "dolly_zoom",
  "overhead",
  "zoom_out",
  "handheld",
  "roll_left",
  "pov",
  "aerial_drone",
  "push_in",
  "crane_down",
  "truck_right",
  "tilt_down",
  "elevator_doors",
  "tilt_up",
  "ground_level",
  "pull_out",
  "aerial",
  "crane_up",
  "eye_level",
] as const;

const VIDEO_MODEL_LIST: VideoModelId[] = [
  "sora-2",
  "sora-2-pro",
  "ray2",
  "pixverse-v5",
  "tooncrafter",
  "pikaframes",
  "wan2.2",
  "veo-3.1-fast",
  "veo-3.1",
  "veo-3.1-fast-generate-preview",
  "veo-3.1-generate-preview",
];

const VIDEO_MODELS: Record<VideoModelId, VideoModelConfig> = {
  "sora-2": {
    id: "sora-2",
    label: "sora-2 (draft)",
    provider: "openai",
    sizeOptions: ["720x1280", "1280x720"],
    secondsOptions: [4, 8, 12],
    promptProfile: "verbose",
  },
  "sora-2-pro": {
    id: "sora-2-pro",
    label: "sora-2-pro (final)",
    provider: "openai",
    sizeOptions: ["720x1280", "1280x720", "1024x1792", "1792x1024"],
    secondsOptions: [4, 8, 12],
    promptProfile: "verbose",
  },
  ray2: {
    id: "ray2",
    label: "Ray2 Flash (720p)",
    provider: "replicate",
    sizeOptions: ["1280x720", "720x1280"],
    secondsOptions: [5, 9],
    promptProfile: "concise",
    replicateModel: "luma/ray-flash-2-720p",
    supportsStartEnd: true,
    supportsLoop: true,
    startImageKey: "start_image",
    endImageKey: "end_image",
    replicateResolutionKey: null,
    replicateSupportsAudio: false,
    supportsConcepts: true,
    conceptOptions: [...RAY2_CONCEPTS],
  },
  "pixverse-v5": {
    id: "pixverse-v5",
    label: "PixVerse v5",
    provider: "replicate",
    sizeOptions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
    secondsOptions: [5, 8],
    promptProfile: "concise",
    replicateModel: "pixverse/pixverse-v5",
    supportsStartEnd: true,
    supportsLoop: false,
    supportsNegativePrompt: true,
    startImageKey: "image",
    endImageKey: "last_frame_image",
    replicateResolutionKey: "quality",
    replicateSupportsAudio: false,
    supportsSeed: true,
    supportsEffect: true,
  },
  tooncrafter: {
    id: "tooncrafter",
    label: "ToonCrafter",
    provider: "replicate",
    sizeOptions: [
      "512x512",
      "768x768",
      "768x432",
      "432x768",
      "native",
    ],
    secondsOptions: [4, 6, 8],
    promptProfile: "concise",
    replicateModel: "fofr/tooncrafter",
    supportsStartEnd: false,
    supportsLoop: false,
    supportsNegativePrompt: true,
    replicateResolutionKey: null,
    replicateSupportsAudio: false,
  },
  pikaframes: {
    id: "pikaframes",
    label: "Pikaframes (Keyframes)",
    provider: "fal",
    sizeOptions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
    secondsOptions: [4, 8, 12, 16, 20, 24],
    promptProfile: "concise",
    supportsNegativePrompt: true,
    supportsSeed: true,
  },
  "wan2.2": {
    id: "wan2.2",
    label: "Wan 2.2 (Fal)",
    provider: "fal",
    sizeOptions: ["1280x720", "720x1280"],
    secondsOptions: [4, 6, 8],
    promptProfile: "concise",
    supportsNegativePrompt: true,
    supportsStartEnd: true,
    supportsSeed: true,
  },
  "veo-3.1-fast": {
    id: "veo-3.1-fast",
    label: "Veo 3.1 Fast",
    provider: "replicate",
    sizeOptions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
    secondsOptions: [4, 6, 8],
    promptProfile: "concise",
    replicateModel: "google/veo-3.1-fast",
    supportsStartEnd: true,
    supportsLoop: false,
    supportsNegativePrompt: true,
    startImageKey: "image",
    endImageKey: "last_frame",
    replicateResolutionKey: "resolution",
    replicateSupportsAudio: true,
    supportsSeed: true,
    supportsReferenceImages: true,
    referenceImageLimit: 3,
    referenceImageConstraints: { aspectRatio: "16:9", seconds: 8 },
  },
  "veo-3.1": {
    id: "veo-3.1",
    label: "Veo 3.1",
    provider: "replicate",
    sizeOptions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
    secondsOptions: [4, 6, 8],
    promptProfile: "concise",
    replicateModel: "google/veo-3.1",
    supportsStartEnd: true,
    supportsLoop: false,
    supportsNegativePrompt: true,
    startImageKey: "image",
    endImageKey: "last_frame",
    replicateResolutionKey: "resolution",
    replicateSupportsAudio: true,
    supportsSeed: true,
    supportsReferenceImages: true,
    referenceImageLimit: 3,
    referenceImageConstraints: { aspectRatio: "16:9", seconds: 8 },
  },
  "veo-3.1-fast-generate-preview": {
    id: "veo-3.1-fast-generate-preview",
    label: "Veo 3.1 Fast Preview (Vertex)",
    provider: "vertex",
    sizeOptions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
    secondsOptions: [7],
    promptProfile: "concise",
    vertexModelId: "veo-3.1-fast-generate-preview",
    supportsStartEnd: false,
    supportsLoop: false,
    supportsNegativePrompt: true,
  },
  "veo-3.1-generate-preview": {
    id: "veo-3.1-generate-preview",
    label: "Veo 3.1 Preview (Vertex)",
    provider: "vertex",
    sizeOptions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
    secondsOptions: [7],
    promptProfile: "concise",
    vertexModelId: "veo-3.1-generate-preview",
    supportsStartEnd: false,
    supportsLoop: false,
    supportsNegativePrompt: true,
  },
};

const DEFAULT_MODEL: VideoModelId = "sora-2";

export function isVideoModelId(value: string): value is VideoModelId {
  return VIDEO_MODEL_LIST.some((id) => id === value);
}

function resolveVideoModelId(model?: string): VideoModelId {
  const cleaned = (model ?? "").trim();
  if (isVideoModelId(cleaned)) return cleaned;
  if (cleaned) {
    const match = VIDEO_MODEL_LIST.find(
      (id) => VIDEO_MODELS[id].replicateModel === cleaned
    );
    if (match) return match;
  }
  return DEFAULT_MODEL;
}

export function getVideoModelConfig(model?: string): VideoModelConfig {
  return VIDEO_MODELS[resolveVideoModelId(model)];
}

export function getVideoModelOptions(): Array<{
  value: VideoModelId;
  label: string;
  provider: VideoProvider;
}> {
  return VIDEO_MODEL_LIST.map((id) => {
    const config = VIDEO_MODELS[id];
    return { value: id, label: config.label, provider: config.provider };
  });
}

export function getVideoProviderForModel(model?: string): VideoProvider {
  return getVideoModelConfig(model).provider;
}

export function getVideoModelLabel(model?: string): string {
  return getVideoModelConfig(model).label;
}

export function getReplicateModelForVideo(model?: string): string | undefined {
  return getVideoModelConfig(model).replicateModel;
}

export function getVertexModelForVideo(
  model?: string
): VertexVeoModelId | undefined {
  return getVideoModelConfig(model).vertexModelId;
}

export function getVideoModelSupportsStartEnd(model?: string): boolean {
  return Boolean(getVideoModelConfig(model).supportsStartEnd);
}

export function getVideoModelSupportsLoop(model?: string): boolean {
  return Boolean(getVideoModelConfig(model).supportsLoop);
}

export function getVideoModelSupportsNegativePrompt(model?: string): boolean {
  return Boolean(getVideoModelConfig(model).supportsNegativePrompt);
}

export function getVideoModelSupportsSeed(model?: string): boolean {
  return Boolean(getVideoModelConfig(model).supportsSeed);
}

export function getVideoModelSupportsReferenceImages(model?: string): boolean {
  return Boolean(getVideoModelConfig(model).supportsReferenceImages);
}

export function getVideoModelReferenceImageLimit(model?: string): number {
  return getVideoModelConfig(model).referenceImageLimit ?? 0;
}

export function getVideoModelReferenceConstraints(
  model?: string
): VideoReferenceConstraints | undefined {
  return getVideoModelConfig(model).referenceImageConstraints;
}

export function getVideoModelSupportsConcepts(model?: string): boolean {
  return Boolean(getVideoModelConfig(model).supportsConcepts);
}

export function getVideoModelConceptOptions(model?: string): string[] {
  return getVideoModelConfig(model).conceptOptions ?? [];
}

export function getVideoModelSupportsEffect(model?: string): boolean {
  return Boolean(getVideoModelConfig(model).supportsEffect);
}

export function getVideoModelStartImageKey(model?: string): string | undefined {
  return getVideoModelConfig(model).startImageKey;
}

export function getVideoModelEndImageKey(model?: string): string | undefined {
  return getVideoModelConfig(model).endImageKey;
}

export function getVideoModelResolutionKey(
  model?: string
): "quality" | "resolution" | null | undefined {
  return getVideoModelConfig(model).replicateResolutionKey;
}

export function getVideoModelSupportsAudio(model?: string): boolean {
  return Boolean(getVideoModelConfig(model).replicateSupportsAudio);
}

export function getVideoModelPromptProfile(
  model?: string
): "verbose" | "concise" {
  return getVideoModelConfig(model).promptProfile ?? "verbose";
}

export function getVideoSizeOptions(model?: string): string[] {
  return getVideoModelConfig(model).sizeOptions;
}

export function getVideoSecondsOptions(model?: string): number[] {
  return getVideoModelConfig(model).secondsOptions;
}

export function getDefaultVideoSize(model?: string): string {
  const options = getVideoSizeOptions(model);
  return options[0];
}

export function getDefaultVideoSeconds(model?: string): number {
  const options = getVideoSecondsOptions(model);
  return options[0] ?? 4;
}

export function isSizeValidForModel(size: string, model?: string): boolean {
  return getVideoSizeOptions(model).includes(size);
}

export function coerceVideoSecondsForModel(
  seconds: number | undefined,
  model?: string
): number {
  const options = getVideoSecondsOptions(model);
  if (!options.length) return 4;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return options[0];
  }
  if (options.includes(seconds)) return seconds;
  return options.reduce((closest, option) => {
    return Math.abs(option - seconds) < Math.abs(closest - seconds)
      ? option
      : closest;
  }, options[0]);
}

function parseSize(size: string): { width: number; height: number } | null {
  const [w, h] = size.split("x").map((value) => Number(value));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { width: w, height: h };
}

export function getVideoAspectRatio(size: string): "16:9" | "9:16" {
  const parsed = parseSize(size);
  if (!parsed) return "16:9";
  return parsed.width >= parsed.height ? "16:9" : "9:16";
}

export function getVideoResolution(size: string): "720p" | "1080p" {
  const parsed = parseSize(size);
  if (!parsed) return "720p";
  const maxDim = Math.max(parsed.width, parsed.height);
  return maxDim >= 1600 ? "1080p" : "720p";
}

export function coerceVideoSizeForModel(
  size: string | undefined,
  model?: string
): string {
  const options = getVideoSizeOptions(model);
  if (!size) return options[0];
  if (isSizeValidForModel(size, model)) return size;
  const parsed = parseSize(size);
  if (!parsed) return options[0];
  const wantsLandscape = parsed.width >= parsed.height;
  const match = options.find((option) => {
    const candidate = parseSize(option);
    if (!candidate) return false;
    return (candidate.width >= candidate.height) === wantsLandscape;
  });
  return match ?? options[0];
}
