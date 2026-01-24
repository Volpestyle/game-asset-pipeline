# Character Sprite Pipeline — Input Production Guide

This doc explains **exactly what you need to provide** to run the 2D pipeline (AI-generated sprites → optional polish), including how to define an **ActionSet** (idle/walk/etc).

> Goal: you should be able to hand this guide to “future you” (or other artists) and get consistent, game‑ready sprites every time.

---

## 1) What you provide to the pipeline

### Required
1) **Reference image(s)** (`.png` strongly recommended)
2) **Job payload** (at minimum: character name + prompts)

### Recommended (for best consistency)
- 2–4 reference images (front/side/back or S/W/N/E pixel refs)
- A short **structured character brief** (colors, silhouette constraints)
- A defined **ActionSet** (what animations to generate)

---

## 2) Reference images

### 2.1 Best input formats

#### Option A — Single “character sheet” image (works even if UI accepts one file)
A single sheet is great if it contains:
- hi‑res **front/side/back** concept (or turnaround)
- one or more **pixel sprite refs** (even small ones help)
- optional item/prop icons (palette + material hints)

✅ This is often the most practical “one upload” format.

#### Option B — Multi-image “reference pack” (best overall)
If your UI/API supports multiple uploads, aim for:

| File | Purpose | Notes |
|---|---|---|
| `ref_00_primary.png` | Primary identity anchor | clean, centered |
| `ref_01_back.png` | Back view | helps N/back direction |
| `ref_02_side.png` | Side view | helps E/W |
| `ref_03_pixel_ref.png` | Pixel style anchor | 2×2 grid of N/S/E/W idle if possible |

---

### 2.2 Image quality rules (do these every time)

**Do**
- Use **PNG** when possible (JPEG introduces edge noise and makes pixel outputs worse)
- Export **only the canvas** (no Procreate/UI chrome)
- Keep character **centered**, with clear silhouette
- Prefer **plain background** (or clean alpha)

**Avoid**
- screenshots with toolbars / UI
- heavy compression artifacts
- motion blur / dramatic lighting changes
- cluttered backgrounds (unless you intend to inpaint/cutout)

---

### 2.3 If your input is already pixel art
That’s great — it becomes your “pixel language anchor”.

Recommended:
- Provide at least one **canonical idle** frame (usually facing South)
- Ideally provide a tiny grid of **N/S/E/W idle** frames
- If you only have one frame, include an extra **silhouette-only** version (filled) as a structure guide

---

### 2.4 If your input is a camera photo of pixel art (screen photo)
Still usable, but you should expect a cleanup stage:
- crop / dewarp (perspective correction)
- remove moiré
- re-sample onto a clean grid
- then proceed as normal

If possible, try to get the original digital PNG.

---

## 3) Prompts and “character brief”

The pipeline is easiest to control with:
- **Structured controls** (frame size, directions, action set, palette lock)
- plus a **light prompt** to describe intent

### 3.1 Prompt template (safe default)
Use this as a starting point:

**Prompt**
- “Match the provided character. Keep outfit, colors, and silhouette. Top‑down JRPG sprite style. Generate clean, consistent frames for the specified action and direction. No text.”

**Negative prompt**
- “text, watermark, logo, extra limbs, extra fingers, deformed hands, blurry, noisy, jpeg artifacts, inconsistent outfit, different face, different hair, different colors”

### 3.2 Structured “character brief” (recommended fields)
Even if you store these in a JSON/YAML, keep them short:

- **Silhouette keys:** “high ponytail, shoulder plates, slim waist”
- **Must keep:** “helmet strap, red accent lights, backpack”
- **Palette constraints:** “white/gray armor + red accents; avoid new colors”
- **Readability:** “face should read from 48×48”

---

## 4) Defining Actions for Sprite Sheet Generation (ActionSet)

An **ActionSet** is the contract that tells the pipeline:
- which animations to generate
- how many frames each has
- fps / loop behavior
- events (footstep, hit, use)

### 4.1 Where ActionSets live
Depending on your repo setup, you will define one of these:

- A pipeline config file, e.g.:
  - `config/pipelines/topdown2d.v1.json`

or a standalone actionset file, e.g.:
- `config/actionsets/actionset_topdown_v1.json`

> If you don’t see an `actionsets/` folder, put it there—ActionSets are meant to be reusable and versioned.

---

### 4.2 ActionSet schema (recommended)

```json
{
  "id": "actionset_topdown_v1",
  "directions": ["N", "S", "W", "E"],
  "actions": {
    "idle": {
      "fps": 6,
      "frames": 4,
      "loop": true,
      "events": {}
    },
    "walk": {
      "fps": 10,
      "frames": 6,
      "loop": true,
      "events": { "footstep": [1, 4] }
    },
    "interact": {
      "fps": 10,
      "frames": 4,
      "loop": false,
      "events": { "use": [2] }
    }
  }
}
```

**Fields**
- `fps`: playback speed (frames per second)
- `frames`: number of frames **per direction**
- `loop`: whether it loops
- `events`: map of `{ eventName: [frameIndices...] }` (0-based indices)

---

### 4.3 A good Pokémon-style overworld ActionSet (v1)
This is a solid v1 without exploding cost:

```json
{
  "id": "actionset_overworld_v1",
  "directions": ["N", "S", "W", "E"],
  "actions": {
    "idle":     { "fps": 6,  "frames": 4, "loop": true,  "events": {} },
    "walk":     { "fps": 10, "frames": 6, "loop": true,  "events": { "footstep": [1,4] } },
    "run":      { "fps": 14, "frames": 6, "loop": true,  "events": { "footstep": [1,4] } },
    "interact": { "fps": 10, "frames": 4, "loop": false, "events": { "use": [2] } }
  }
}
```

---

### 4.4 Cost / frame count sanity check

Total frames generated per character:

```
total_frames = num_directions * sum(action.frames for each action)
```

Example (idle 4 + walk 6 + interact 4) with 4 directions:

- `(4 + 6 + 4) * 4 = 56 frames`

If you add `run (6)`:

- `(4 + 6 + 4 + 6) * 4 = 80 frames`

This matters because AI generation cost scales nearly linearly with frame count.

---

### 4.5 Direction order and mirroring
Define your direction order once, and keep it consistent across the whole game:
- recommended: `["N", "S", "W", "E"]`

Mirroring policy:
- Many games mirror **W → E** to save work, but if your character has asymmetry (holster, cape, etc.), generate both.

---

### 4.6 Event markers (why they matter)
Events let your engine trigger:
- footsteps (sound, dust)
- “use”/interaction moment
- attack “hit frame”
- impact flashes

Example:

```json
"attack": {
  "fps": 12,
  "frames": 6,
  "loop": false,
  "events": { "hit": [3] }
}
```

---

## 5) Per-job overrides (optional)
If you want the UI to keep a default ActionSet but allow overrides per job, support:

```json
{
  "actionOverrides": {
    "walk": { "fps": 10, "frames": 8, "loop": true, "events": { "footstep": [1,5] } }
  }
}
```

This should merge into the base actionset at runtime.

---

## 6) What you should expect as output

### Artifacts (typical)
- **Frames**
  - `frames/<action>_<direction>/<000..N>.png`
- **Spritesheets**
  - `spritesheets/<action>.png` (rows = directions, cols = frames)
- **Manifest / metadata**
  - `character_export.json` or `manifest.json` (fps, pivot, frame rects, events)
- **Previews**
  - `preview/<action>_<direction>.gif`

### “Game-ready” means
- fixed frame size
- stable pivot (feet anchored)
- consistent palette (if pixel mode is enabled)
- engine can play animations using the manifest only

---

## 7) Common problems & how to fix them

### Identity drift (face/outfit changes frame-to-frame)
- Provide 2–4 refs (front/back/side)
- Use reference conditioning (IP‑Adapter) or train a small LoRA once you have enough samples
- Reduce strength / denoise; generate each frame from the previous frame with low change

### Pixel shimmer (outlines crawl between frames)
- Generate in HD, then **deterministically pixelize + palette lock**
- Keep a locked palette (global or per character)
- If needed, polish in Aseprite for the 5% of frames that shimmer

### Palette drift (new colors appear)
- Enforce a palette quantization step
- Run a palette validator in CI (max colors per frame)

---

## 8) “Starter checklist” for your first character

1) Export a **clean PNG canvas** (no UI)
2) Use this ActionSet:
   - `idle(4)`, `walk(6)`, `interact(4)` with 4 directions
3) Use a prompt like:
   - “Keep the exact character design and colors. Generate consistent top-down sprite frames.”
4) Run the job and inspect:
   - preview GIFs
   - spritesheet layout
   - manifest correctness

If the walk cycle looks stable, your pipeline is healthy.

---
