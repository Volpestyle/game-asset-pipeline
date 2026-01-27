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
│  │ - Sora Video API │  │ - video models   │  │ - Fal.ai         │        │
│  │ - image→video    │  │ - rd-fast/plus   │  │ - Gemini         │        │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **Implementation note:** The current codebase uses Next.js route handlers under
> `src/app/api/*` and shared utilities in `src/lib/*`. A separate services layer
> (e.g., `CharacterService`, `AnimationService`) is not implemented yet.

## API Routes (Current)

- `/api/characters` (list + create)
- `/api/characters/[id]` (read/update/delete)
- `/api/animations` (list + create)
- `/api/animations/[id]` (read/update/delete)
- `/api/generate` (start generation)
- `/api/export` (export spritesheet + metadata)
- `/api/project` (project-wide canvas settings)
- `/api/animations/[id]/keyframes` (upload/generate/refine keyframes)
- `/api/animations/[id]/interpolate` (generate in-betweens)
- `/api/animations/[id]/rebuild` (rebuild spritesheet from raw frames)
- `/api/animations/[id]/import-video` (import MP4 and extract frames)
- `/api/animations/[id]/generation-frames` (upload start/end frames)
- `/api/animations/[id]/versions` + `/load` (versioning)

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
  anchor?: AnchorPoint;
  scale?: number;
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

type AnchorPoint =
  | "bottom-center"
  | "center"
  | "bottom-left"
  | "bottom-right"
  | "top-center";

interface Animation {
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
  promptProfile?: "concise" | "verbose";
  promptConcise?: string;
  promptVerbose?: string;
  generationSeconds?: number;
  generationSize?: string;
  generationLoop?: boolean;
  generationStartImageUrl?: string | null;
  generationEndImageUrl?: string | null;
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
        ├── generation/
        ├── keyframes/
        │   └── frame_005.png
        ├── generated/
        │   ├── frames_raw/
        │   ├── frames/
        │   └── spritesheet_*.png
        └── exports/
            ├── spritesheet.png
            └── spritesheet.json
        └── versions/
            └── {versionId}/
                ├── generated/
                ├── keyframes/
                └── version.json
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

- Video generation models (Ray2, PixVerse v5, ToonCrafter, Veo 3.1/fast)
- rd-fast / rd-plus and nano-banana-pro for keyframe refinement

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
