// Canvas normalization anchor points
export type AnchorPoint =
  | "bottom-center"   // Feet at bottom-center (platformers)
  | "center"          // Center of sprite (top-down games)
  | "bottom-left"     // Feet at bottom-left
  | "bottom-right"    // Feet at bottom-right
  | "top-center";     // Head at top-center (hanging sprites)

// Project-wide settings for canvas normalization
export interface ProjectSettings {
  canvasWidth: number;       // Standard output width (e.g., 256)
  canvasHeight: number;      // Standard output height (e.g., 512)
  defaultAnchor: AnchorPoint;
  defaultScale: number;      // 0.0-1.0, default character scale
  updatedAt?: string;
}

// Character identity extracted from reference images
export interface Character {
  id: string;
  name: string;
  referenceImages: ReferenceImage[];
  style: ArtStyle;
  baseWidth?: number;
  baseHeight?: number;
  workingReference?: WorkingReference;
  workingSpec?: WorkingSpec;
  // Canvas normalization settings (uses project defaults if not set)
  anchor?: AnchorPoint;
  scale?: number;            // 0.0-1.0, how much of canvas height to fill
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceImage {
  id: string;
  url: string;
  file?: File;
  filename?: string;
  type: ReferenceImageType;
  isPrimary: boolean;
  backgroundRemoved?: boolean;
}

export type ReferenceImageType = 'front' | 'side' | 'back' | 'detail' | 'action' | 'other';

export type ArtStyle =
  | 'pixel-art'
  | 'hand-drawn'
  | '3d-rendered'
  | 'anime'
  | 'realistic'
  | 'custom';

export interface SpritesheetLayout {
  frameSize?: number;
  frameWidth?: number;
  frameHeight?: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
}

export type BackgroundRemovalMode = "spritesheet" | "per-frame";

export type GenerationProvider = "openai" | "replicate" | "fal" | "vertex";

export interface WorkingReference {
  url: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface WorkingSpec {
  canvasW: number;
  canvasH: number;
  scale: number;
  roi: { x: number; y: number; w: number; h: number };
  bgKeyColor: string;
}

// Animation-level reference images (for multi-image models like nano-banana-pro or flux-2-max)
export interface AnimationReference {
  id: string;
  url: string;
  filename: string;
  createdAt: string;
}

// Animation configuration
export interface Animation {
  id: string;
  characterId: string;
  referenceImageId?: string | null;
  references?: AnimationReference[];
  name: string;
  description: string;
  frameCount: number;
  fps: number;
  style: AnimationStyle;
  spriteSize: number;
  frameWidth?: number;
  frameHeight?: number;
  generationProvider?: GenerationProvider;
  generationModel?: string;
  promptProfile?: PromptProfile;
  promptConcise?: string;
  promptVerbose?: string;
  generationSeconds?: number;
  generationSize?: string;
  generationLoop?: boolean;
  generationStartImageUrl?: string | null;
  generationEndImageUrl?: string | null;
  generationContinuationEnabled?: boolean;
  generationContinuationVideoUrl?: string | null;
  generationNegativePrompt?: string | null;
  generationSeed?: number | null;
  generationReferenceImageUrls?: string[];
  generationConcepts?: string[];
  generationEffect?: string | null;
  tooncrafterInterpolate?: boolean;
  tooncrafterColorCorrection?: boolean;
  tooncrafterSeed?: number | null;
  tooncrafterNegativePrompt?: string | null;
  tooncrafterEmptyPrompt?: boolean;
  wanSeed?: number | null;
  wanNumInferenceSteps?: number | null;
  wanEnableSafetyChecker?: boolean;
  wanEnableOutputSafetyChecker?: boolean;
  wanEnablePromptExpansion?: boolean;
  wanAcceleration?: "none" | "regular";
  wanGuidanceScale?: number | null;
  wanGuidanceScale2?: number | null;
  wanShift?: number | null;
  wanInterpolatorModel?: "none" | "film" | "rife";
  wanNumInterpolatedFrames?: number | null;
  wanAdjustFpsForInterpolation?: boolean;
  wanVideoQuality?: "low" | "medium" | "high" | "maximum";
  wanVideoWriteMode?: "fast" | "balanced" | "small";
  extractFps?: number;
  loopMode?: "loop" | "pingpong";
  sheetColumns?: number;
  generationJob?: GenerationJob;
  generationQueue?: GenerationQueueItem[];
  sourceVideoUrl?: string;
  sourceProviderSpritesheetUrl?: string;
  sourceThumbnailUrl?: string;
  keyframes: Keyframe[];
  generatedFrames: GeneratedFrame[];
  status: AnimationStatus;
  versions?: AnimationVersion[];
  activeVersionId?: string | null;
  versionCounter?: number;
  generatedSpritesheet?: string;
  generationNote?: string;
  spritesheetLayout?: SpritesheetLayout;
  exports?: {
    spritesheetUrl?: string;
    asepriteJsonHashUrl?: string;
    asepriteJsonArrayUrl?: string;
    pngSequenceUrl?: string;
    pngSequenceIndexUrl?: string;
    zipBundleUrl?: string;
    normalized?: boolean;
    backgroundRemoved?: boolean;
    backgroundRemovalMode?: BackgroundRemovalMode;
    alphaThreshold?: number;
    lastExportedAt?: string;
  };
  actualFrameCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type AnimationStatus = 'draft' | 'generating' | 'complete' | 'failed';

export type AnimationVersionSource = "manual" | "generation";
export type PromptProfile = 'verbose' | 'concise';

export interface AnimationVersion {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  source?: AnimationVersionSource;
}

export interface Keyframe {
  frameIndex: number;
  image?: string;
  prompt?: string;
  model?: 'rd-fast' | 'rd-plus' | 'nano-banana-pro' | 'flux-2-max';
  strength?: number;
  generations?: KeyframeGeneration[];
  // Advanced rd-fast/rd-plus options
  inputPalette?: string;
  tileX?: boolean;
  tileY?: boolean;
  removeBg?: boolean;
  seed?: number;
  bypassPromptExpansion?: boolean;
  easing?: EasingType;
  updatedAt?: string;
}

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';

export interface KeyframeGeneration {
  id: string;
  image: string;
  createdAt: string;
  source: "generate" | "refine" | "upload" | "select";
  prompt?: string;
  model?: 'rd-fast' | 'rd-plus' | 'nano-banana-pro' | 'flux-2-max';
  style?: string;
  strength?: number;
  inputPalette?: string;
  tileX?: boolean;
  tileY?: boolean;
  removeBg?: boolean;
  seed?: number;
  bypassPromptExpansion?: boolean;
  numImages?: number;
  outputFormat?: string;
  safetyFilterLevel?: string;
  saved?: boolean;
}

export interface GeneratedFrame {
  frameIndex: number;
  url: string;
  isKeyframe: boolean;
  generatedAt: string;
  source?: string;
}

export interface GenerationJob {
  provider: string;
  providerJobId: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "canceled";
  progress?: number;
  expiresAt?: string;
  error?: string;
  outputs?: {
    videoUrl?: string;
    spritesheetUrl?: string;
    thumbnailUrl?: string;
  };
}

export type GenerationQueueStatus = "queued" | "in_progress" | "completed" | "failed";

export interface GenerationQueueItem {
  id: string;
  status: GenerationQueueStatus;
  startFrame: number;
  endFrame: number;
  targetFrameCount: number;
  durationSeconds: number;
  model: string;
  provider: GenerationProvider;
  startImageUrl?: string;
  endImageUrl?: string | null;
  progress?: number;
  error?: string;
  outputs?: {
    videoUrl?: string;
    spritesheetUrl?: string;
    thumbnailUrl?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

// Generation
export type GenerationMode = 'frame-by-frame' | 'video-to-frames';
export type AnimationStyle = 'idle' | 'walk' | 'run' | 'attack' | 'jump' | 'custom';

export interface GenerationRequest {
  characterId: string;
  animationId: string;
  mode: GenerationMode;
  options: GenerationOptions;
}

export interface GenerationOptions {
  strength: number;
  styleFidelity: number;
  motionSmoothness: number;
}

// Export
export type ExportFormat = 'png-sequence' | 'spritesheet' | 'webp' | 'apng';

export interface ExportConfig {
  format: ExportFormat;
  scale: number;
  padding: number;
  includeMetadata: boolean;
}

export interface SpritesheetMetadata {
  frames: Record<string, {
    frame: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
    duration: number;
  }>;
  meta: {
    image: string;
    size: { w: number; h: number };
    frameRate: number;
  };
}
