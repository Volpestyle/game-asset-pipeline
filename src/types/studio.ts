export type ModelCategory = "video" | "image";

export type StudioVideoParameters = {
  prompt: string;
  size: string;
  seconds: number;
  startImage?: string;
  endImage?: string;
  loop?: boolean;
  generateAudio?: boolean;
  negativePrompt?: string;
  seed?: number;
  referenceImages?: string[];
  concepts?: string[];
  effect?: string;
};

export type PikaframesParameters = {
  keyframes: string[];
  size: string;
  seconds: number;
  prompt?: string;
  negativePrompt?: string;
  seed?: number;
};

export type ToonCrafterParameters = {
  prompt: string;
  keyframes: string[];
  maxWidth?: number;
  maxHeight?: number;
  loop?: boolean;
  interpolate?: boolean;
  colorCorrection?: boolean;
  negativePrompt?: string;
  seed?: number;
};

export type StudioImageParameters = {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
  inputImage?: string;
  referenceImages?: string[];
  strength?: number;
  inputPalette?: string;
  tileX?: boolean;
  tileY?: boolean;
  removeBg?: boolean;
  seed?: number;
  bypassPromptExpansion?: boolean;
  aspectRatio?: string;
  resolution?: string;
  numImages?: number;
  outputFormat?: string;
  safetyFilterLevel?: string;
};

export type WanParameters = {
  prompt: string;
  size: string;
  seconds: number;
  startImage: string;
  endImage?: string;
  framesPerSecond?: number;
  negativePrompt?: string;
  seed?: number;
  numInferenceSteps?: number;
  enableSafetyChecker?: boolean;
  enableOutputSafetyChecker?: boolean;
  enablePromptExpansion?: boolean;
  acceleration?: "none" | "regular";
  guidanceScale?: number;
  guidanceScale2?: number;
  shift?: number;
  interpolatorModel?: "none" | "film" | "rife";
  numInterpolatedFrames?: number;
  adjustFpsForInterpolation?: boolean;
  videoQuality?: "low" | "medium" | "high" | "maximum";
  videoWriteMode?: "fast" | "balanced" | "small";
};

export type StudioParameters =
  | StudioVideoParameters
  | PikaframesParameters
  | ToonCrafterParameters
  | StudioImageParameters
  | WanParameters;

export type StudioHistoryEntry = {
  id: string;
  modelCategory: ModelCategory;
  modelId: string;
  createdAt: string;
  result: {
    imageUrls?: string[];
    videoUrl?: string;
    thumbnailUrl?: string;
  };
};

export type StudioHistoryPage = {
  items: StudioHistoryEntry[];
  nextOffset: number | null;
  total: number;
};
