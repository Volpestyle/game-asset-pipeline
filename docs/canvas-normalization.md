# Canvas Normalization System

## Problem

When building a game with multiple characters and animations, consistency is critical:
- Characters need consistent sizing relative to each other
- Sprites need predictable dimensions for the game engine
- Animations need consistent anchor points so characters don't "float" or "jump" between states

Without normalization, each animation might have different frame dimensions based on the source video or character reference, making integration into a game engine difficult.

## Solution

A three-part normalization system applied during export:

1. **Project Canvas Size** - Standard output dimensions for all sprites
2. **Character Anchor Point** - Where the character is positioned within the canvas
3. **Character Scale** - How much of the canvas the character fills

```
┌─────────────────────────────────────────┐
│              Canvas (256×512)           │
│                                         │
│         ┌───────────────────┐           │
│         │                   │           │
│         │     Character     │           │
│         │     (scaled to    │           │
│         │      80% height)  │           │
│         │                   │           │
│         └─────────┬─────────┘           │
│                   │                     │
│                   ▼ anchor: bottom-center
└─────────────────────────────────────────┘
```

## Data Model

### Project Settings

Stored in `storage/project.json`:

```typescript
interface ProjectSettings {
  canvasWidth: number;      // e.g., 256
  canvasHeight: number;     // e.g., 512
  defaultAnchor: AnchorPoint;
  defaultScale: number;
}
```

### Character Settings

Added to the Character type:

```typescript
interface Character {
  // ... existing fields

  // Canvas normalization (optional, uses project defaults if not set)
  anchor?: AnchorPoint;     // Where to position character in canvas
  scale?: number;           // 0.0-1.0, how much of canvas height to fill
}

type AnchorPoint =
  | "bottom-center"   // Feet at bottom-center (most common for platformers)
  | "center"          // Center of sprite (good for top-down games)
  | "bottom-left"     // Feet at bottom-left
  | "bottom-right"    // Feet at bottom-right
  | "top-center"      // Head at top-center (for hanging sprites)
```

## Normalization Process

Applied during export (or optionally during frame generation):

### Step 1: Detect Content Bounds

For each frame, find the bounding box of non-transparent pixels:

```typescript
function detectContentBounds(image: Sharp): Promise<{
  x: number;      // Left edge of content
  y: number;      // Top edge of content
  width: number;  // Content width
  height: number; // Content height
}>
```

### Step 2: Calculate Scaled Size

Based on character scale setting, calculate target size:

```typescript
// If scale = 0.8 and canvas is 256×512
// Character should be 80% of canvas height = 409.6px tall
// Width scales proportionally to maintain aspect ratio

const targetHeight = canvasHeight * scale;
const aspectRatio = contentWidth / contentHeight;
const targetWidth = targetHeight * aspectRatio;
```

### Step 3: Position Based on Anchor

Calculate where to place the scaled content:

```typescript
// For anchor = "bottom-center":
const x = (canvasWidth - targetWidth) / 2;   // Centered horizontally
const y = canvasHeight - targetHeight;        // Bottom edge at canvas bottom

// For anchor = "center":
const x = (canvasWidth - targetWidth) / 2;
const y = (canvasHeight - targetHeight) / 2;
```

### Step 4: Compose Final Frame

1. Create transparent canvas at project dimensions
2. Extract content from original frame (using detected bounds)
3. Scale content to target size (using nearest-neighbor for pixel art)
4. Composite onto canvas at calculated position

## Configuration UI

### Project Settings Panel

Located in project settings or a global config page:

```
┌─────────────────────────────────────────┐
│ CANVAS SETTINGS                         │
├─────────────────────────────────────────┤
│ Output Size:  [256] × [512]             │
│ Default Anchor: [bottom-center ▼]       │
│ Default Scale:  [0.8] (80%)             │
└─────────────────────────────────────────┘
```

### Character Settings Panel

On the character detail page:

```
┌─────────────────────────────────────────┐
│ NORMALIZATION                           │
├─────────────────────────────────────────┤
│ Anchor: [bottom-center ▼]               │
│ Scale:  [0.85] (85% of canvas)          │
│                                         │
│ Preview: [====CHARACTER====]            │
│          [      within     ]            │
│          [      canvas     ]            │
└─────────────────────────────────────────┘
```

## Export Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Generated  │───▶│   Detect     │───▶│    Scale &   │───▶│   Compose    │
│    Frames    │    │   Bounds     │    │    Anchor    │    │  Spritesheet │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                    │
                                                                    ▼
                                                            ┌──────────────┐
                                                            │   Aseprite   │
                                                            │     JSON     │
                                                            └──────────────┘
```

## API

### Normalize Single Frame

```typescript
async function normalizeFrame(options: {
  inputPath: string;
  outputPath: string;
  canvasWidth: number;
  canvasHeight: number;
  anchor: AnchorPoint;
  scale: number;
}): Promise<void>
```

### Normalize Animation Frames

```typescript
async function normalizeAnimationFrames(options: {
  animationId: string;
  projectSettings: ProjectSettings;
  characterSettings?: { anchor?: AnchorPoint; scale?: number };
}): Promise<NormalizedFrame[]>
```

## Considerations

### Pixel Art Preservation

- Use nearest-neighbor interpolation when scaling
- Consider snapping to integer pixel positions
- Optionally support "pixel-perfect" mode that only allows 1x, 2x, 4x scaling

### Batch Consistency

When normalizing multiple animations for the same character:
- Use consistent bounds detection (or allow manual override)
- Consider using the "largest" bounding box across all animations to prevent size shifts

### Performance

- Bounds detection requires reading every pixel (can be slow for large images)
- Consider caching bounds data per animation
- Run normalization as a background task for large batches

## Future Enhancements

1. **Animation-specific overrides** - Allow per-animation anchor/scale for special cases
2. **Bounds preview** - Show detected bounds in the UI before export
3. **Batch normalization** - Normalize all animations for a character at once
4. **Manual bounds** - Allow manually drawing/adjusting the content bounds
5. **Size classes** - Define "small", "medium", "large" character size presets
