// Character identity extracted from reference images
export interface Character {
  id: string;
  name: string;
  referenceImages: ReferenceImage[];
  style: ArtStyle;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferenceImage {
  id: string;
  url: string;
  file?: File;
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

// Animation configuration
export interface Animation {
  id: string;
  characterId: string;
  name: string;
  description: string;
  frameCount: number;
  fps: number;
  keyframes: Keyframe[];
  generatedFrames: GeneratedFrame[];
  status: AnimationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type AnimationStatus = 'draft' | 'generating' | 'complete' | 'failed';

export interface Keyframe {
  frameIndex: number;
  image?: string;
  prompt?: string;
}

export interface GeneratedFrame {
  frameIndex: number;
  url: string;
  isKeyframe: boolean;
  generatedAt: Date;
}

// Generation
export type GenerationMode = 'frame-by-frame' | 'video-to-frames';

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
