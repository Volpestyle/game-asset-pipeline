# AI Integration Guide

## Overview

This document details the AI models and integration strategies for generating animation frames.

## The Challenge: Character Consistency

The core technical challenge is maintaining character visual identity across generated frames. A character should look like *themselves* in every frame, not just "a similar character."

### Solution (Current): Working Reference + Prompt Constraints

The current pipeline keeps identity by generating a “working reference” canvas
from the uploaded sprite (scaled with nearest-neighbor), then strongly constraining
the prompt (static camera, centered character, crisp pixel edges, magenta background).

**Future enhancement**: IP-Adapter or similar reference-conditioning models could
further lock identity across frames.

## AI Providers Overview

| Provider | Role | Use Case |
|----------|------|----------|
| OpenAI | Primary generation | Image → video → frames (Sora) |
| Replicate | Secondary generation | Keyframe interpolation (rd-fast/rd-plus), legacy spritesheet fallback |
| Fal.ai | Planned/optional | Fast inference experiments (not wired in) |
| Gemini | Planned/optional | Image understanding, style detection (not wired in) |

## OpenAI Video API (Primary)

**Purpose**: Generate a short video from a reference image + motion prompt, then extract frames.

**Usage (current code)**:
```typescript
// lib/ai/openai.ts
const job = await createVideoJob({
  prompt,
  model: "sora-2" | "sora-2-pro",
  seconds: 4 | 8 | 12,
  size: "720x1280" | "1280x720" | "1024x1792" | "1792x1024",
  inputReferencePath,
});

const finalJob = await pollVideoJob({ videoId: job.id });
const videoBuffer = await downloadVideoContent({ videoId: job.id });
```

**Notes**:
- `sora-2` supports `720x1280` and `1280x720`.
- `sora-2-pro` also supports `1024x1792` and `1792x1024`.
- The app will auto-coerce invalid sizes to a supported size.
- The pipeline uses a “working reference” canvas with a magenta key background so frames can be keyed out.

---

## Gemini API (Analysis & Understanding) — Planned

**Purpose**: Analyze uploaded references to extract character details, detect art style, and optimize generation prompts.

**Usage**:
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function analyzeCharacterReference(imageUrl: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "image/png",
        data: await fetchImageAsBase64(imageUrl),
      },
    },
    `Analyze this character reference image and extract:
    1. Art style (pixel art, anime, hand-drawn, 3D rendered, etc.)
    2. Key visual features (colors, proportions, distinctive elements)
    3. Suggested prompt keywords for consistent generation
    4. Any notable accessories or details to preserve

    Return as JSON.`,
  ]);

  return JSON.parse(result.response.text());
}
```

**Use Cases**:
- Auto-detect art style from uploaded refs
- Extract character description for generation prompts
- Suggest optimal generation parameters
- Validate consistency between multiple reference images

---

## Replicate Models (Current Usage)

### 1. rd-animation (Legacy fallback)

**Model**: `retro-diffusion/rd-animation`

**Purpose**: Generate a spritesheet directly (used only if OpenAI is not selected or unavailable).

### 2. rd-fast (Keyframe interpolation)

**Model**: `retro-diffusion/rd-fast`

**Purpose**: Fast in-between frame refinement between user keyframes.

### 3. rd-plus (Keyframe interpolation)

**Model**: `retro-diffusion/rd-plus`

**Purpose**: Higher fidelity in-between frame refinement.

---

## Replicate Ideas (Planned / Optional)

- IP-Adapter for tighter character consistency
- AnimateDiff for alternate video generation
- SDXL img2img for per-frame control

## Generation Strategies

### Strategy 1: Frame-by-Frame with Keyframe Interpolation

Best for: Precise control, technical animations (attack moves, specific poses)

```
Keyframe 0 ──────────────────────────────────── Keyframe 8
     │                                               │
     ▼                                               ▼
  Frame 0 → Frame 1 → Frame 2 → ... → Frame 7 → Frame 8
     │         │         │               │         │
     └─────────┴─────────┴───────────────┴─────────┘
                         │
              rd-fast/rd-plus interpolation
              + progressive prompt changes
              + keyframe blending
```

**Algorithm**:
```typescript
async function generateFrameByFrame(
  character: Character,
  animation: Animation
): Promise<GeneratedFrame[]> {
  const frames: GeneratedFrame[] = [];

  for (let i = 0; i < animation.frameCount; i++) {
    // Find nearest keyframes
    const prevKeyframe = findPreviousKeyframe(animation.keyframes, i);
    const nextKeyframe = findNextKeyframe(animation.keyframes, i);

    // Calculate interpolation factor
    const t = calculateInterpolation(prevKeyframe, nextKeyframe, i);

    // Build frame-specific prompt
    const prompt = buildFramePrompt(animation.description, i, animation.frameCount, t);

    // Generate in-between frame (rd-fast/rd-plus)
    const frame = await generateWithReplicate({
      baseImage: blendKeyframes(prevKeyframe?.image, nextKeyframe?.image, t),
      prompt,
      strength: 0.2 + (t * 0.2),
    });

    frames.push(frame);
  }

  return frames;
}
```

### Strategy 2: Video Generation + Frame Extraction (current default)

Best for: Fluid motion, natural movement (walks, runs, flowing animations)

```
Single Keyframe + Motion Prompt
              │
              ▼
     ┌─────────────────┐
     │      Sora       │
     │ (OpenAI Video)  │
     └────────┬────────┘
              │
              ▼
         Video Output
              │
              ▼
     ┌─────────────────┐
     │ Frame Extraction│
     │ at target FPS   │
     └────────┬────────┘
              │
              ▼
    Individual Frames (PNG)
```

**Algorithm**:
```typescript
async function generateVideoToFrames(
  character: Character,
  animation: Animation
): Promise<GeneratedFrame[]> {
  // Use primary keyframe or first reference as seed
  const seedImage = animation.keyframes[0]?.image
    || character.referenceImages[0].url;

  // Generate video (OpenAI Sora)
  const job = await createVideoJob({ prompt, model, seconds, size, inputReferencePath });
  await pollVideoJob({ videoId: job.id });
  const videoBuffer = await downloadVideoContent({ videoId: job.id });

  // Extract frames from video (ffmpeg), then key out magenta and pack spritesheet
  const frames = await extractFramesFromVideo(videoBuffer, animation.extractFps);

  return frames;
}
```

### Strategy 3: Hybrid Approach

Combine both for best results:

1. Use video generation for smooth motion base
2. Use keyframe interpolation (rd-fast/rd-plus) to refine specific frames
3. User can mark frames that need "fixing" and regenerate those specifically

## Prompt Engineering

### Base Prompt Template
```
{character_description}, {pose_description}, {action_phase},
{art_style} style, consistent character design,
animation frame {frame_number} of {total_frames}
```

### Animation-Specific Prompts

**Walk Cycle (8 frames)**:
```typescript
const walkCyclePhases = [
  "contact pose, right foot forward, left arm forward",
  "passing position, right leg bearing weight",
  "high point, right leg straight, left leg swinging forward",
  "contact pose, left foot forward, right arm forward",
  "passing position, left leg bearing weight",
  "high point, left leg straight, right leg swinging forward",
  // ... continues
];
```

**Attack Animation**:
```typescript
const attackPhases = [
  "wind-up pose, weapon pulled back",
  "mid-swing, weapon in motion",
  "impact frame, weapon extended",
  "follow-through, weapon past target",
  "recovery pose, returning to idle",
];
```

## API Integration Code

### OpenAI Client Setup (Current)

```typescript
// lib/ai/openai.ts (excerpt)
const job = await createVideoJob({
  model: "sora-2",
  prompt,
  seconds: 4,
  size: "720x1280",
  inputReferencePath,
});

await pollVideoJob({ videoId: job.id });
const videoBuffer = await downloadVideoContent({ videoId: job.id });
```

### Replicate Client Setup (Keyframes)

```typescript
// lib/ai/replicate.ts (excerpt)
const prediction = await runReplicateModel({
  model: "retro-diffusion/rd-plus",
  input: {
    prompt,
    input_image: dataUrl,
    strength: 0.25,
  },
});
```

### Fal.ai Client Setup (Planned)

Fal is not wired into the current app, but the repo keeps links and placeholders
for future experimentation.

## Error Handling & Retries

AI generation can fail. Handle gracefully:

```typescript
async function generateWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Generation attempt ${attempt + 1} failed:`, error);

      // Exponential backoff
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw new Error(`Generation failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

## Cost Considerations

- OpenAI video jobs are billed per output size and duration.
- Replicate keyframe runs are billed per compute.
- Keep frames cached and allow partial rebuilds (e.g., spritesheet rebuild from raw frames)
  to avoid unnecessary re-generation.
