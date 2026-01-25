Below is a practical, end‑to‑end guide for building a character → animation → generation → timeline editor → looping spritesheet export workflow, tuned for your 253×504 sprite and for Web + React Native.

I’ll center the “AI motion” stage around OpenAI’s Sora Video API because it:
	•	is designed for async jobs (easy to integrate into a “Generate” button + progress UI)  ￼
	•	supports downloading different assets from one job, including a spritesheet variant (video | thumbnail | spritesheet)  ￼
	•	exposes video job metadata including expires_at, so you can copy assets to your own storage promptly  ￼

You can still keep the architecture provider‑agnostic so you can swap in Luma/Runway/etc later.

⸻

1) The core pipeline (what happens when a user clicks “Generate”)

Stage A — “Character” (your app’s concept, not Sora’s)

User picks/ uploads reference sprite(s). You store:
	•	original sprite: 253×504 PNG (ideally transparent BG)
	•	working reference image sized to the video model’s required resolutions
	•	cropping + scaling metadata (to get back to 253×504 frames cleanly)

Stage B — AI video generation (async job)

Your backend calls POST /v1/videos with:
	•	model: sora-2 (drafts) or sora-2-pro (final)
	•	size:
		•	sora-2 → 720x1280 or 1280x720
		•	sora-2-pro → 720x1280, 1280x720, 1024x1792, 1792x1024
	•	seconds: 4 | 8 | 12
	•	input_reference: your working reference image (first-frame guidance)  ￼

Sora video generation is asynchronous: create job → poll status or use webhooks → download content when status=completed.  ￼

Stage C — Frame extraction + “pixel enforcement”

After the job completes, your worker:
	1.	downloads the MP4 (and optionally the spritesheet/thumbnail)  ￼
	2.	extracts frames at your desired sprite FPS (e.g., 6–12 fps)
	3.	crops the character region, scales down to 253×504, disables smoothing (nearest neighbor), keys out magenta for transparency
	4.	packs frames into a looping spritesheet + exports metadata JSON
	5.	stores raw frames in frames_raw so loop mode can be rebuilt without re-generating

Stage D — Animation editor UI

Editor loads:
	•	spritesheet image
	•	metadata JSON
	•	per-frame thumbnails
Then provides:
	•	timeline (frame strip)
	•	scrubber/playback
	•	frame inspector (crop/anchor/duration)
	•	re-export

⸻

2) Recommended “working resolution” for your 253×504 sprite

Sora size support depends on the model:

- sora-2: 720x1280, 1280x720
- sora-2-pro: 720x1280, 1280x720, 1024x1792, 1792x1024

Your sprite is portrait (253/504 ≈ 0.502), so for **sora-2** the best portrait choice is **720×1280**.

Key trick: use an integer scale factor to preserve pixel edges.

For 720×1280, find max integer k such that:
	•	253*k <= 720
	•	504*k <= 1280

k=2 works:
	•	253×2 = 506
	•	504×2 = 1008

So your “working reference image” is:
	•	canvas: 720×1280
	•	your sprite scaled to 506×1008 (nearest neighbor)
	•	placed centered on the canvas
	•	on a solid magenta key background

If you use **sora-2-pro**, 1024×1792 is also valid (k=3 → 759×1512).  
The app auto-coerces invalid sizes to a supported size and builds the working reference for you.

⸻

3) Prompt + constraints for “pixel sprite animation” (so it doesn’t turn into smooth art)

Sora prompting best practices: be explicit about shot type, subject, action, camera, lighting.  ￼
Also note Sora API has content restrictions (under‑18 only, copyrighted characters rejected, real people not allowed, etc.).  ￼

A reliable prompt template for sprites:

Base prompt (your app generates this):
	•	Style constraints:
	•	“pixel art sprite”
	•	“limited color palette”
	•	“crisp hard edges”
	•	“no anti-aliasing”
	•	“no motion blur”
	•	Motion constraints:
	•	“static camera”
	•	“character stays centered, no camera movement”
	•	“keep proportions and identity identical to reference”
	•	Loop constraints:
	•	“seamless looping animation, first and last pose match”

Action text (user input):
	•	ex: “idle breathing, subtle blinking, slight cloak flutter”

Background constraint (important for transparency):
	•	“pure solid magenta background (#FF00FF), perfectly uniform, no gradients/shadows”

That background lets you key it out later and export transparent PNG spritesheets.

⸻

4) Data model (so your UI + backend stays clean)

A good minimal schema:

Character
	•	id
	•	name
	•	baseWidth=253, baseHeight=504
	•	references[] (original uploaded sprites)
	•	workingReference (the 1024×1792 image you send to Sora)
	•	workingSpec:
	•	canvasW=1024, canvasH=1792
	•	scale=3
	•	roi = { x, y, w: 759, h: 1512 } (where the sprite lives on the canvas)
	•	bgKeyColor = #FF00FF
	•	optional palette[]

Animation
	•	id
	•	characterId
	•	name
	•	description
	•	settings:
	•	provider: "openai"
	•	model: "sora-2" | "sora-2-pro"
	•	seconds: 4 | 8 | 12  ￼
	•	size: model-specific (auto-coerced)
	•	extractFps: 6 | 8 | 12
	•	loopMode: "loop" | "pingpong"
	•	sheetColumns (spritesheet packing)
	•	frameWidth / frameHeight (derived from reference)
	•	sourceVideoUrl / sourceProviderSpritesheetUrl / sourceThumbnailUrl
	•	generationNote (e.g., size coercions, errors)

GenerationJob
	•	status: queued | in_progress | completed | failed
	•	progress (0–100)
	•	providerJobId (e.g. video_...)
	•	expiresAt (from video job metadata)  ￼
	•	error (if failed)
	•	outputs:
	•	videoMp4Url
	•	spritesheetUrl
	•	thumbnailUrl

⸻

5) Backend architecture (works for Web + RN)

Components
	•	API server (Node/Fastify/Express, or Next.js route handlers)
	•	Queue + worker (BullMQ + Redis, or SQS + Lambda, etc.)
	•	Object storage (S3/R2/GCS)
	•	DB (Postgres)

Why a worker?

Video generation is async and can take minutes. The Sora docs explicitly describe create → poll/webhook → download.  ￼
You don’t want your UI request to sit open.

**Current app behavior**: `POST /api/generate` starts an async job in-process and the UI polls
`/api/animations/:id` while `status=generating`. A dedicated worker/queue is a future upgrade.

Status updates to the UI

Current app:
	•	Poll `/api/animations/:id` every ~2s while status=generating

Future options:
	•	SSE
	•	WebSocket
	•	Provider webhooks → your server → push to client
Sora docs recommend webhooks as a more efficient approach than polling the provider.  ￼

⸻

6) API endpoints your app should expose

Character flows
	•	POST /characters
	•	upload reference image(s)
	•	returns character + processed workingReference
	•	GET /characters
	•	GET /characters/:id

Animation flows
	•	POST /animations
	•	{ characterId, name, description, settings }
	•	GET /animations/:id
	•	POST /generate
	•	POST /animations/:id/rebuild (repack spritesheet from raw frames)
	•	POST /export
	•	returns spritesheet + json URLs

⸻

7) Worker implementation details (the “make it a spritesheet” part)

7.1 Create + monitor a Sora job

Sora video generation uses POST /v1/videos, and you either poll GET /v1/videos/{video_id} or use webhooks.  ￼

Parameters you’ll likely set:
	•	model: sora-2 (fast iteration) vs sora-2-pro (final quality)  ￼
	•	seconds: 4 | 8 | 12  ￼
	•	size: model-specific (see section 2)  ￼
	•	input_reference file  ￼

7.2 Download assets before they expire

The video job includes expires_at (“when the downloadable assets expire”).  ￼
So your worker should download immediately after completion.

Supported download variants include:
	•	"video" (MP4)
	•	"thumbnail"
	•	"spritesheet"  ￼

Even if you plan to build your own spritesheet, grabbing the official spritesheet can be useful for quick previews.

7.3 Extract frames with ffmpeg (crop → downscale → nearest)

Assuming:
	•	input: 720×1280 MP4
	•	ROI: x=107, y=136, w=506, h=1008 (centered, k=2)
	•	output: 253×504 (scale down by 2)

Example ffmpeg filter chain:
	•	crop ROI
	•	scale down (nearest neighbor)
	•	output PNG sequence

Conceptually:

ffmpeg -i input.mp4 \
  -vf "crop=506:1008:107:136,scale=253:504:flags=neighbor,fps=8" \
  out/frame_%03d.png

You can set fps here to your extraction FPS (e.g., 6–12). This is separate from the source video FPS.

7.4 Key out the background for transparency

If you used a pure magenta BG, you can do a simple pixel threshold key:
	•	if pixel is “close to #FF00FF”, set alpha=0
	•	else alpha=255

For best sprite crispness, I usually do this after the nearest-neighbor scale down (less noise, fewer edge artifacts).

7.5 Stabilize/anchor (optional but very helpful)

Even with “static camera”, models sometimes introduce tiny drift. For game sprites, drift feels bad.

Two lightweight options:
	•	Phase correlation / template match to align each frame to frame 0 (small x/y shifts)
	•	Anchor point lock (user sets “feet point”; you align that point across frames)

Expose “Lock Position” as a toggle in the editor. If enabled, run stabilization in worker and regenerate spritesheet.

7.6 Make it loop

Offer loop modes:
	•	Loop: frame1→frameN→frame1 (requires start/end match)
	•	Ping‑pong: frame1→frameN→frame1 by reversing frames (almost always smooth, cheap)

In practice, “ping‑pong” is the easiest “always works” option to ship.

7.7 Pack into spritesheet + metadata JSON

Output:
	•	spritesheet.png
	•	spritesheet.json

Metadata should include:
	•	frame size: 253×504
	•	frame count
	•	per-frame rectangles (x,y,w,h)
	•	frame durations (ms) or FPS
	•	anchor point (optional but great for game use)

For web engines, a TexturePacker‑like JSON format is widely supported.

⸻

8) UI: how to structure the screens you described

Screen 1 — Character Library

Goal: “create character via reference image selection”

Key UI elements:
	•	grid of characters
	•	“New Character” button
	•	character detail: references, palette preview, “Set default pose”

New character flow:
	1.	Upload sprite (253×504 PNG)
	2.	Choose:
	•	Working size: default 1024×1792
	•	Scale: default 3×
	•	Background: “transparent” or “magenta key”
	3.	Preview how it will be embedded into the working canvas (shows ROI box)
	4.	Save character

Screen 2 — Animation List (for a character)

Goal: “create an animation (name, action description)”

Fields:
	•	name (“Idle”, “Walk”, “Attack”)
	•	action description (free text)
	•	settings:
	•	extract FPS (6/8/12)
	•	loop mode (loop/pingpong)
	•	model quality (draft/final)
	•	optional “Lock Position”

Screen 3 — Animation Editor (timeline + scrub)

Goal: “Generate from the animation editor page where we have a timeline and frame preview and can scrub”

Layout suggestion:

Left panel (inputs)
	•	name
	•	action description
	•	generation settings (model, seconds, size, fps)
	•	buttons:
	•	“Generate”
	•	“Regenerate” (keeps same settings)
	•	“Export spritesheet”

Center (preview)
	•	canvas preview at 1× (pixel crisp)
	•	zoom controls (2×, 4×)
	•	onion skin toggle (advanced)
	•	“background view”: transparent / checkerboard

Bottom (timeline)
	•	scrollable strip of frame thumbnails
	•	playhead scrubber
	•	play/pause
	•	loop toggle / pingpong
	•	frame duration editor (optional)

Right panel (frame inspector)
	•	current frame #
	•	anchor point editor (set feet origin)
	•	crop/offset adjustments
	•	delete/duplicate frame
	•	“Trim start/end”

Scrubbing behavior (what “feels right”)
	•	dragging in timeline updates frame index immediately (no lag)
	•	preview always renders from spritesheet (fast drawImage) rather than loading dozens of separate images

⸻

9) Frontend rendering approach (Web + React Native)

Web: render from spritesheet on <canvas>
	•	load spritesheet image
	•	ctx.imageSmoothingEnabled = false
	•	draw correct frame rect based on playhead position

Pseudo-logic:

const frame = frames[i]; // {x,y,w,h}
ctx.imageSmoothingEnabled = false;
ctx.clearRect(0,0,canvasW,canvasH);
ctx.drawImage(sheetImg, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w * zoom, frame.h * zoom);

Timeline thumbnails:
	•	either use pre-generated thumb images, or reuse the spritesheet and draw to small canvases

React Native: render sub-rect from spritesheet

RN’s <Image> doesn’t crop a sub-rect efficiently by itself. Two solid options:
	1.	@shopify/react-native-skia (recommended)

	•	load spritesheet
	•	drawImageRect using source rect → dest rect
	•	disable filtering for crisp pixels

	2.	WebGL (expo-gl / three)

	•	texture = spritesheet
	•	update UVs per frame

⸻

10) Provider integration notes (Sora-specific)

Endpoints & params you’ll actually rely on
	•	POST /v1/videos with model, prompt, optional input_reference, seconds, size  ￼
	•	GET /v1/videos/{video_id} for status/progress  ￼
	•	GET /v1/videos/{video_id}/content?variant=... for downloads  ￼
	•	expires_at tells you when downloads expire  ￼

Guardrails you should surface in the UI

Sora API restrictions include:
	•	only content suitable for audiences under 18
	•	copyrighted characters/music rejected
	•	real people cannot be generated
	•	input images with faces of humans are currently rejected  ￼

Add a tooltip near “Generate” and a clean error display when jobs fail.

⸻

11) “Workflow plug-ins” (so you can add interpolation later)

Since you mentioned the interpolation workflow earlier, design your pipeline with stages:

Pipeline stages:
	1.	Generate motion (image→video)
	2.	Extract frames
	3.	Stabilize
	4.	Pixel enforce (nearest + palette)
	5.	Loop finalize (pingpong or loop-close)
	6.	Pack spritesheet

Then later, you can add:
	•	Interpolation stage between frames (for smoother motion)
	•	or a “keyframe mode” where the user uploads 2–4 poses and you generate in-betweens

UI-wise, that becomes an “Enhance” tab:
	•	“Generate in-betweens: 2× / 3×”
	•	“Smooth loop seam”

⸻

12) Suggested defaults to ship first (simple, works well)

For a first version, I’d ship these defaults:

Generation
	•	size = 720x1280 (sora-2 default)  ￼
	•	seconds = 4  ￼
	•	model = sora-2 for drafts, sora-2-pro for “final”  ￼
	•	prompt includes pixel + loop + magenta background constraints

Extraction
	•	extractFps = 6 → 4 sec gives ~24 frames (nice for sprites)
	•	loopMode = pingpong (makes loops easy)
	•	stabilization ON (optional but recommended)

Export
	•	spritesheet columns = 6 (→ 24 frames = 4 rows)
	•	JSON metadata includes fps: 6, frameW: 253, frameH: 504

⸻

If you want, I can also provide:
	•	a concrete TypeScript API contract (zod schemas for Character/Animation/Job)
	•	an example BullMQ worker that calls Sora, downloads content, runs ffmpeg, and writes spritesheet + JSON
	•	a sample Animation Editor component for web (canvas preview + timeline scrub)
	•	a sample Skia-based RN SpritePlayer that takes {spritesheetUrl, meta} and plays/scrubs.
