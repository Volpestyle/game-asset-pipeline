# AI Integration Guide

## Overview

This document details the AI models and integration strategies for generating animation frames.

## The Challenge: Character Consistency

The core technical challenge is maintaining character visual identity across generated frames. A character should look like *themselves* in every frame, not just "a similar character."

### Solution: IP-Adapter + Reference Conditioning

IP-Adapter allows us to condition image generation on reference images, essentially telling the AI "generate an image that looks like THIS character."

## AI Providers Overview

| Provider | Role | Use Case |
|----------|------|----------|
| Replicate | Primary generation | Frame generation, video-to-frames, IP-Adapter |
| Fal.ai | Secondary/fallback | Fast inference, A/B testing |
| Gemini | Analysis | Image understanding, style detection, prompt optimization |

## Gemini API (Analysis & Understanding)

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

## Replicate Models

### 1. IP-Adapter (Character Consistency)

**Model**: `tencentarc/ip-adapter-sdxl` or similar

**Purpose**: Condition generation on character reference images

**Usage**:
```typescript
const output = await replicate.run(
  "tencentarc/ip-adapter-sdxl:...",
  {
    input: {
      prompt: "character walking, side view, pixel art style",
      image: characterReferenceUrl,
      scale: 0.7, // How strongly to apply the reference
      // ...other params
    }
  }
);
```

### 2. AnimateDiff (Video Generation)

**Model**: `lucataco/animate-diff` or `stability-ai/stable-video-diffusion`

**Purpose**: Generate smooth animation videos from a single image + motion prompt

**Usage**:
```typescript
const output = await replicate.run(
  "lucataco/animate-diff:...",
  {
    input: {
      prompt: "character performing walk cycle animation",
      image: keyframeImage,
      motion_module: "mm_sd_v15_v2",
      frames: 16,
      // ...other params
    }
  }
);
// Returns video URL, needs frame extraction
```

### 3. SDXL img2img (Frame-by-Frame)

**Model**: Various SDXL models on Replicate

**Purpose**: Generate individual frames with fine control

**Usage**:
```typescript
const output = await replicate.run(
  "stability-ai/sdxl:...",
  {
    input: {
      prompt: "character mid-step walking pose, frame 5 of 8",
      image: previousFrameOrKeyframe,
      prompt_strength: 0.6, // Lower = closer to input image
      // ...other params
    }
  }
);
```

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
              IP-Adapter conditioning
              + progressive prompt changes
              + img2img from nearest keyframe
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

    // Generate frame
    const frame = await generateWithIPAdapter({
      characterRef: character.referenceImages[0].url,
      baseImage: prevKeyframe?.image || frames[i - 1]?.url,
      prompt,
      strength: 0.4 + (t * 0.3), // More freedom in the middle
    });

    frames.push(frame);
  }

  return frames;
}
```

### Strategy 2: Video Generation + Frame Extraction

Best for: Fluid motion, natural movement (walks, runs, flowing animations)

```
Single Keyframe + Motion Prompt
              │
              ▼
     ┌─────────────────┐
     │   AnimateDiff   │
     │  or SVD model   │
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

  // Generate video
  const videoUrl = await generateVideo({
    image: seedImage,
    prompt: `${animation.description}, smooth animation, consistent character`,
    frames: animation.frameCount,
    fps: animation.fps,
  });

  // Extract frames from video
  const frames = await extractFramesFromVideo(videoUrl, animation.frameCount);

  return frames;
}
```

### Strategy 3: Hybrid Approach

Combine both for best results:

1. Use video generation for smooth motion base
2. Use frame-by-frame refinement with IP-Adapter to fix character consistency issues
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

### Replicate Client Setup

```typescript
// lib/ai/replicate.ts
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function generateFrame(options: {
  characterRef: string;
  prompt: string;
  baseImage?: string;
  strength?: number;
}): Promise<string> {
  const output = await replicate.run(
    "tencentarc/ip-adapter-sdxl:...",
    {
      input: {
        prompt: options.prompt,
        image: options.characterRef,
        // ...
      }
    }
  );

  return output as string;
}

export async function generateAnimationVideo(options: {
  seedImage: string;
  prompt: string;
  frames: number;
  fps: number;
}): Promise<string> {
  const output = await replicate.run(
    "lucataco/animate-diff:...",
    {
      input: {
        prompt: options.prompt,
        image: options.seedImage,
        frames: options.frames,
        // ...
      }
    }
  );

  return output as string;
}
```

### Fal.ai Client Setup (Alternative)

```typescript
// lib/ai/fal.ts
import * as fal from "@fal-ai/serverless-client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function generateWithFal(options: {
  prompt: string;
  imageUrl: string;
}): Promise<string> {
  const result = await fal.subscribe("fal-ai/fast-sdxl", {
    input: {
      prompt: options.prompt,
      image_url: options.imageUrl,
    },
  });

  return result.images[0].url;
}
```

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

- Replicate charges per second of compute time
- IP-Adapter runs are typically $0.01-0.05 per generation
- AnimateDiff can be $0.10-0.50 per video depending on length
- Budget ~$0.50-2.00 per complete animation (8-16 frames)

Consider:
- Caching successful generations
- Allowing users to regenerate specific frames vs entire animation
- Quality presets (fast/cheap vs slow/quality)
