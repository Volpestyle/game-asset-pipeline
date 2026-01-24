# Architecture Overview

## System Design

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │  Character   │   │  Animation   │   │  Generation  │   │    Export    │ │
│  │   Upload     │   │   Editor     │   │   Preview    │   │    Panel     │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘ │
│         │                  │                  │                  │         │
└─────────┼──────────────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ROUTES (Next.js)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/characters     /api/animations    /api/generate      /api/export     │
│  - POST upload       - POST create      - POST frames      - POST sheet    │
│  - GET list          - PUT update       - GET status       - GET download  │
│  - GET [id]          - GET [id]                                            │
└─────────────────────────────────────────────────────────────────────────────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVICES LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ CharacterService │  │ AnimationService │  │  ExportService   │          │
│  │                  │  │                  │  │                  │          │
│  │ - createIdentity │  │ - parseTimeline  │  │ - toPNG          │          │
│  │ - extractFeatures│  │ - validateFrames │  │ - toSpritesheet  │          │
│  │ - storeRefs      │  │ - buildPrompts   │  │ - toAnimatedWebP │          │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘          │
│           │                     │                                           │
│           └──────────┬──────────┘                                           │
│                      ▼                                                      │
│           ┌──────────────────┐                                              │
│           │    AIService     │                                              │
│           │                  │                                              │
│           │ - generateFrame  │                                              │
│           │ - generateVideo  │                                              │
│           │ - extractFrames  │                                              │
│           └────────┬─────────┘                                              │
│                    │                                                        │
└────────────────────┼────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL AI PROVIDERS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │
│  │    Replicate     │  │      Fal.ai      │  │      Gemini      │        │
│  │                  │  │                  │  │                  │        │
│  │ - IP-Adapter     │  │ - Fast inference │  │ - Image analysis │        │
│  │ - AnimateDiff    │  │ - img2img        │  │ - Style detection│        │
│  │ - SDXL img2img   │  │                  │  │ - Understanding  │        │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Types

```typescript
// Character identity extracted from reference images
interface Character {
  id: string;
  name: string;
  referenceImages: ReferenceImage[];
  identityEmbedding?: string; // Path to IP-Adapter embedding or similar
  style: ArtStyle;
  createdAt: Date;
  updatedAt: Date;
}

interface ReferenceImage {
  id: string;
  url: string;
  type: 'front' | 'side' | 'back' | 'detail' | 'action';
  isPrimary: boolean;
}

type ArtStyle = 'pixel-art' | 'hand-drawn' | '3d-rendered' | 'anime' | 'realistic' | 'custom';

// Animation configuration
interface Animation {
  id: string;
  characterId: string;
  name: string;
  description: string; // "walk cycle", "sword slash", etc.
  frameCount: number;
  fps: number;
  keyframes: Keyframe[];
  generatedFrames: GeneratedFrame[];
  status: 'draft' | 'generating' | 'complete' | 'failed';
  createdAt: Date;
}

interface Keyframe {
  frameIndex: number; // 0-based position in timeline
  image?: string; // URL to user-provided keyframe image
  prompt?: string; // Additional prompt for this specific frame
}

interface GeneratedFrame {
  frameIndex: number;
  url: string;
  isKeyframe: boolean;
  generatedAt: Date;
}

// Generation request
interface GenerationRequest {
  characterId: string;
  animationId: string;
  mode: 'frame-by-frame' | 'video-to-frames';
  options: GenerationOptions;
}

interface GenerationOptions {
  strength: number; // How much to deviate from keyframes (0-1)
  style_fidelity: number; // How closely to match character style (0-1)
  motion_smoothness: number; // For video mode, smoothness of motion (0-1)
}

// Export configuration
interface ExportConfig {
  format: 'png-sequence' | 'spritesheet' | 'webp' | 'apng';
  scale: number; // Output scale multiplier
  padding: number; // For spritesheet, padding between frames
  includeMetadata: boolean; // Generate JSON metadata
}

interface SpritesheetMetadata {
  frames: {
    [key: string]: {
      frame: { x: number; y: number; w: number; h: number };
      sourceSize: { w: number; h: number };
      duration: number; // in milliseconds
    };
  };
  meta: {
    image: string;
    size: { w: number; h: number };
    frameRate: number;
  };
}
```

## Storage Strategy

### MVP (Local Filesystem)
```
storage/
├── characters/
│   └── {characterId}/
│       ├── references/
│       │   ├── ref_001.png
│       │   └── ref_002.png
│       └── identity.json
└── animations/
    └── {animationId}/
        ├── keyframes/
        │   └── frame_005.png
        ├── generated/
        │   ├── frame_000.png
        │   ├── frame_001.png
        │   └── ...
        └── exports/
            ├── spritesheet.png
            └── spritesheet.json
```

### Future (Cloud Storage)
- S3-compatible storage for images
- Database (Postgres/SQLite) for metadata
- CDN for serving assets

## AI Integration Strategy

### Primary: Replicate

**For Character Consistency:**
- IP-Adapter: Condition generation on reference images
- Model: `tencentarc/ip-adapter-sdxl` or similar

**For Frame Generation:**
- img2img with ControlNet for pose guidance
- Model: SDXL-based with appropriate LoRA for art style

**For Video Generation:**
- AnimateDiff for smooth motion
- Model: `lucataco/animate-diff` or `stability-ai/stable-video-diffusion`

### Fallback: Fal.ai
- Similar capabilities, different infrastructure
- Good for A/B testing quality

### Analysis: Gemini API
- Image understanding and description
- Automatic style detection from references
- Character feature extraction for prompts
- Can analyze uploaded refs to suggest optimal generation params

### Generation Pipeline

```
1. Load character identity (reference images + any cached embeddings)
2. Build prompt from animation description + frame-specific prompts
3. For each frame to generate:
   a. If frame-by-frame mode:
      - Find nearest keyframes (before and after)
      - Interpolate between them using img2img
      - Condition on character identity
   b. If video mode:
      - Generate video segment
      - Extract frames at target FPS
4. Post-process frames (color correction, consistency fixes)
5. Return generated frames
```

## UI Component Hierarchy

```
App
├── Layout
│   ├── Sidebar (navigation)
│   └── Main Content
│
├── Dashboard (home)
│   ├── RecentCharacters
│   └── RecentAnimations
│
├── CharacterManager
│   ├── CharacterList
│   ├── CharacterUpload
│   │   ├── DropZone
│   │   ├── ReferenceImageGrid
│   │   └── StyleSelector
│   └── CharacterDetail
│       ├── ReferenceGallery
│       └── AnimationsList
│
├── AnimationEditor
│   ├── Timeline
│   │   ├── TimelineRuler
│   │   ├── FrameTrack
│   │   └── KeyframeMarkers
│   ├── FramePreview
│   ├── AnimationControls
│   │   ├── PlaybackControls
│   │   ├── FrameCountInput
│   │   └── FPSSelector
│   ├── DescriptionInput
│   └── GenerateButton
│
└── ExportPanel
    ├── FormatSelector
    ├── ExportOptions
    └── DownloadButton
```

## State Management

Using React Server Components where possible, client state for interactive elements:

- **Server State**: Character data, animation configs, generated frames
- **Client State**: Timeline position, playback state, UI interactions
- **URL State**: Current character/animation selection

Consider Zustand for complex client state if needed, but start simple.
