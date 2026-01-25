# Game Asset Pipeline

AI-powered sprite animation pipeline for creating consistent character animations from reference images.

## Vision

Upload character reference images → Define animation parameters → Generate complete animation frames using AI → Export for web/mobile.

### Core Workflow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Upload Refs    │ ──▶ │ Create Character │ ──▶ │ Define Animation│ ──▶ │   Generate   │
│  (concept art)  │     │    Identity      │     │   (timeline)    │     │    Frames    │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
                                                                                 │
                                                                                 ▼
                                                                        ┌──────────────┐
                                                                        │    Export    │
                                                                        │ (PNG/Sheet)  │
                                                                        └──────────────┘
```

## Features

### Character Identity System
- Upload multiple reference images (concept art, multi-angle views)
- System extracts character "identity" for consistent generation
- Supports various art styles (pixel art, hand-drawn, 3D rendered, etc.)
- Character style is injected into the generation prompt

### Animation Configuration
- Text description of desired animation ("walk cycle", "attack slash", etc.)
- Configurable frame count
- Keyframe support - set specific frames as anchors
- Timeline-based editor for precise control

### Generation Modes
1. **Frame-by-frame (img2img)**: Keyframes as anchors, AI interpolates between
2. **Video-to-frames**: Generate smooth video, extract frames (better for fluid motion)

### Export Options
- Individual PNG frames
- Spritesheet + JSON metadata (frame positions, dimensions, timing)
- ZIP bundle with spritesheet + metadata + frames
- Ready for web (React) and mobile (React Native/Expo)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **AI Backend**:
  - Primary: OpenAI Sora Video API (image → video → frames)
  - Secondary: Replicate (rd-animation legacy fallback, rd-fast/rd-plus for keyframe interpolation)
- **Storage**: Local filesystem (MVP), S3-compatible (future)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home/dashboard
│   ├── characters/        # Character management
│   ├── animations/        # Animation editor
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── character/         # Character-related components
│   ├── animation/         # Animation editor components
│   └── export/            # Export functionality
├── lib/
│   ├── ai/                # AI provider integrations
│   │   ├── openai.ts
│   │   ├── replicate.ts
│   │   └── soraConstraints.ts
│   ├── character/         # Character identity logic
│   ├── animation/         # Animation generation logic
│   └── export/            # Export utilities (spritesheet, etc.)
├── types/                 # TypeScript types
└── hooks/                 # React hooks
```

## Getting Started

```bash
# Install dependencies
npm install

# Ensure ffmpeg is installed (required for video frame extraction)
# macOS: brew install ffmpeg
# Ubuntu: sudo apt-get install ffmpeg
# Windows: choco install ffmpeg

# Set up environment variables
cp .env.example .env.local
# Add your API keys (REPLICATE_API_TOKEN, etc.)

# Run development server
npm run dev
```

## Environment Variables

```
OPENAI_API_KEY=            # OpenAI API key (Sora video generation)
REPLICATE_API_TOKEN=       # Replicate API token
FAL_KEY=                   # Fal.ai API key (planned/unused)
GOOGLE_AI_API_KEY=         # Gemini API key (planned/unused)
RD_ANIMATION_VERSION=      # Replicate rd-animation model version (optional)
RD_ANIMATION_MODEL=        # Replicate rd-animation model (optional, defaults to retro-diffusion/rd-animation)
RD_FAST_MODEL=             # Replicate rd-fast model (optional, defaults to retro-diffusion/rd-fast)
RD_FAST_VERSION=           # Replicate rd-fast version (optional)
RD_PLUS_MODEL=             # Replicate rd-plus model (optional, defaults to retro-diffusion/rd-plus)
RD_PLUS_VERSION=           # Replicate rd-plus version (optional)
```

## Local Storage (MVP)

Assets and metadata are stored locally under:

```
storage/
├── characters/{id}/character.json
├── characters/{id}/references/
├── characters/{id}/working/            # working reference + spec JSON
└── animations/{id}/
    ├── animation.json
    ├── generated/
    │   ├── frames_raw/                 # extracted frames (pre-loop)
    │   └── frames/                     # final frames (loop applied)
    ├── exports/
    └── keyframes/
```

Generated files are served via `/api/storage/...` for local preview.

## Generation Defaults

### Video-to-Frames (default)
- Default model: `sora-2`
- Video size: `720x1280` (sora-2 default). `sora-2-pro` also supports `1024x1792` and `1792x1024`.
- Duration: 4 seconds
- Extract FPS: 6
- Loop mode: ping-pong
- Frame size derived from character reference (default 253×504)
- Invalid sizes are automatically coerced to a supported size for the selected model
- If `OPENAI_API_KEY` is missing, generation will fail (fallback still available via Replicate)
- Rebuild: you can re-pack spritesheets from `frames_raw` without re-running generation

### Replicate fallback (legacy)
- `retro-diffusion/rd-animation` generates a spritesheet directly
- Uses the primary reference image
- If `REPLICATE_API_TOKEN` is missing, a local fallback copies the primary reference image

### Keyframe Refinement

Single-frame and keyframe refinement use:

- `retro-diffusion/rd-fast` for fast iterations
- `retro-diffusion/rd-plus` for higher fidelity results

Supported advanced inputs (rd-fast/rd-plus):

- `input_palette` (palette reference image)
- `tile_x`, `tile_y`
- `seed`
- `bypass_prompt_expansion`

## Export Formats

The export endpoint produces:

- `spritesheet.png`
- `spritesheet-array.json` (Aseprite JSON Array)
- `spritesheet-hash.json` (Aseprite JSON Hash)
- `frames/` PNG sequence + `frames/index.json` (if spritesheet frames are available)
- `export_{animationId}.zip` bundle with all export assets

## Roadmap

### Phase 1: Foundation (Current)
- [x] Project setup and documentation
- [x] Character upload and management UI
- [x] Basic character identity storage

### Phase 2: Animation Editor
- [x] Timeline-based animation configurator
- [x] Keyframe placement
- [x] Animation preview

### Phase 3: AI Generation
- [x] Replicate integration
- [x] Frame-by-frame generation
- [x] Video-to-frames generation

### Phase 4: Export & Polish
- [x] Export to multiple formats
- [x] Spritesheet generation with metadata
- [ ] Mobile-ready exports

## Key Concepts

### Character Identity
A character identity captures the visual essence of a character from reference images. The current pipeline enforces consistency via a working reference canvas and prompt constraints; advanced conditioning (e.g., IP-Adapter) is a possible future enhancement.

### Keyframes
User-provided frames that act as "anchors" in the animation. The AI generates intermediate frames that smoothly transition between keyframes while maintaining character identity.

### Generation Pipeline
```
Character Identity + Animation Description + Keyframes
                          ↓
              AI Generation (OpenAI/Replicate)
                          ↓
                   Raw Generated Frames
                          ↓
              Post-processing & Assembly
                          ↓
                  Export-ready Assets
```

## License

MIT
