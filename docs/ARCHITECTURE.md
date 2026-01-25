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
│  - POST upload       - POST create      - POST async job   - POST bundle   │
│  - GET list          - PUT update       - (poll /animations/:id)           │
│  - GET [id]          - GET [id]        /api/animations/:id/rebuild         │
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
│  │ - createIdentity │  │ - parseTimeline  │  │ - toFrames       │          │
│  │ - extractFeatures│  │ - validateFrames │  │ - toSpritesheet  │          │
│  │ - storeRefs      │  │ - buildPrompts   │  │ - toAsepriteJson │          │
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
│  │     OpenAI       │  │    Replicate     │  │  Optional/Planned│        │
│  │                  │  │                  │  │                  │        │
│  │ - Sora Video API │  │ - rd-fast/plus   │  │ - Fal.ai         │        │
│  │ - image→video    │  │ - rd-animation   │  │ - Gemini         │        │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Types

```typescript
interface Character {
  id: string;
  name: string;
  referenceImages: ReferenceImage[];
  style: ArtStyle;
  baseWidth?: number;
  baseHeight?: number;
  workingReference?: { url: string; width: number; height: number; createdAt: string };
  workingSpec?: {
    canvasW: number;
    canvasH: number;
    scale: number;
    roi: { x: number; y: number; w: number; h: number };
    bgKeyColor: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ReferenceImage {
  id: string;
  url: string;
  type: "front" | "side" | "back" | "detail" | "action" | "other";
  isPrimary: boolean;
}

type ArtStyle =
  | "pixel-art"
  | "hand-drawn"
  | "3d-rendered"
  | "anime"
  | "realistic"
  | "custom";

interface Animation {
  id: string;
  characterId: string;
  referenceImageId?: string | null;
  name: string;
  description: string;
  frameCount: number;
  fps: number;
  style: AnimationStyle;
  frameWidth?: number;
  frameHeight?: number;
  generationProvider?: "openai" | "replicate";
  generationModel?: string;
  generationSeconds?: number;
  generationSize?: string;
  extractFps?: number;
  loopMode?: "loop" | "pingpong";
  sheetColumns?: number;
  generationJob?: GenerationJob;
  sourceVideoUrl?: string;
  sourceProviderSpritesheetUrl?: string;
  sourceThumbnailUrl?: string;
  keyframes: Keyframe[];
  generatedFrames: GeneratedFrame[];
  status: "draft" | "generating" | "complete" | "failed";
  generatedSpritesheet?: string;
  spritesheetLayout?: SpritesheetLayout;
  exports?: Record<string, string | undefined>;
  actualFrameCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface GenerationJob {
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
```

## Storage Strategy

### MVP (Local Filesystem)
```
storage/
├── characters/
│   └── {characterId}/
│       ├── references/
│       ├── working/
│       ├── character.json
│       └── reference_*.png
└── animations/
    └── {animationId}/
        ├── keyframes/
        │   └── frame_005.png
        ├── generated/
        │   ├── frames_raw/
        │   ├── frames/
        │   └── spritesheet_*.png
        └── exports/
            ├── spritesheet.png
            └── spritesheet.json
```

### Future (Cloud Storage)
- S3-compatible storage for images
- Database (Postgres/SQLite) for metadata
- CDN for serving assets

## AI Integration Strategy

### Primary: OpenAI (Sora Video API)

- Image → video → frames pipeline
- Async job creation, polling, download of MP4 (+ optional spritesheet/thumbnail)
- Working reference uses magenta key background for easy transparency keying

### Secondary: Replicate

- rd-fast / rd-plus for keyframe interpolation
- rd-animation as legacy fallback spritesheet generation

### Optional/Planned

- Fal.ai and Gemini integrations are not wired in but referenced for future experiments.

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
