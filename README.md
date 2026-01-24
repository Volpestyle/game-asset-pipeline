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
- Animated WebP/APNG
- Ready for web (React) and mobile (React Native/Expo)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **AI Backend**:
  - Primary: Replicate (AnimateDiff, IP-Adapter, img2img models)
  - Secondary: Fal.ai
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
│   │   ├── replicate.ts
│   │   └── fal.ts
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

# Set up environment variables
cp .env.example .env.local
# Add your API keys (REPLICATE_API_TOKEN, etc.)

# Run development server
npm run dev
```

## Environment Variables

```
REPLICATE_API_TOKEN=       # Replicate API token
FAL_KEY=                   # Fal.ai API key (optional)
```

## Roadmap

### Phase 1: Foundation (Current)
- [x] Project setup and documentation
- [ ] Character upload and management UI
- [ ] Basic character identity storage

### Phase 2: Animation Editor
- [ ] Timeline-based animation configurator
- [ ] Keyframe placement
- [ ] Animation preview

### Phase 3: AI Generation
- [ ] Replicate integration
- [ ] Frame-by-frame generation
- [ ] Video-to-frames generation

### Phase 4: Export & Polish
- [ ] Export to multiple formats
- [ ] Spritesheet generation with metadata
- [ ] Mobile-ready exports

## Key Concepts

### Character Identity
A character identity captures the visual essence of a character from reference images. This is used to maintain consistency when generating new frames/poses. Implemented using techniques like IP-Adapter or similar reference-image conditioning.

### Keyframes
User-provided frames that act as "anchors" in the animation. The AI generates intermediate frames that smoothly transition between keyframes while maintaining character identity.

### Generation Pipeline
```
Character Identity + Animation Description + Keyframes
                          ↓
              AI Generation (Replicate/Fal)
                          ↓
                   Raw Generated Frames
                          ↓
              Post-processing & Assembly
                          ↓
                  Export-ready Assets
```

## License

MIT
