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

// Animation configuration
export interface Animation {
  id: string;
  characterId: string;
  referenceImageId?: string | null;
  name: string;
  description: string;
  frameCount: number;
  fps: number;
  style: AnimationStyle;
  spriteSize: number;
  frameWidth?: number;
  frameHeight?: number;
  generationProvider?: "openai" | "replicate";
  generationModel?: string;
  promptProfile?: PromptProfile;
  promptConcise?: string;
  promptVerbose?: string;
  generationSeconds?: number;
  generationSize?: string;
  generationLoop?: boolean;
  generationStartImageUrl?: string | null;
  generationEndImageUrl?: string | null;
  tooncrafterInterpolate?: boolean;
  tooncrafterColorCorrection?: boolean;
  tooncrafterSeed?: number | null;
  extractFps?: number;
  loopMode?: "loop" | "pingpong";
  sheetColumns?: number;
  generationJob?: GenerationJob;
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
    alphaThreshold?: number;
  };
  // rd-animation model outputs fixed frame counts
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
  model?: 'rd-fast' | 'rd-plus' | 'nano-banana-pro';
  strength?: number;
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
