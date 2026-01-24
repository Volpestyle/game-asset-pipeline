import sharp from "sharp";
import type { PipelineContext, StageResult } from "../types.js";
import { getRuntime } from "../../runtime.js";

export async function stageSpriteSheet(ctx: PipelineContext): Promise<StageResult> {
  const rt = await getRuntime();
  if (!ctx.frames || ctx.frames.length === 0) return { ok: false, error: "No frames to pack" };

  const fw = ctx.frame.width;
  const fh = ctx.frame.height;
  const directions = ctx.directions;

  const byAction: Record<string, Array<typeof ctx.frames[number]>> = {};
  for (const f of ctx.frames) {
    byAction[f.action] = byAction[f.action] ?? [];
    byAction[f.action].push(f);
  }

  ctx.spriteSheets = [];

  for (const [action, frames] of Object.entries(byAction)) {
    // Determine number of columns for this action (max frame index + 1).
    const cols = Math.max(...frames.map((f) => f.index)) + 1;
    const rows = directions.length;

    const sheetW = fw * cols;
    const sheetH = fh * rows;

    const base = sharp({
      create: {
        width: sheetW,
        height: sheetH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const composites: Array<{ input: Buffer; left: number; top: number }> = [];

    for (const dir of directions) {
      for (let i = 0; i < cols; i++) {
        const frame = frames.find((f) => f.direction === dir && f.index === i);
        if (!frame) continue;

        const buf = await rt.storage.readFile(frame.path);
        // Downscale using nearest neighbor to preserve crispness.
        const resized = await sharp(buf)
          .resize(fw, fh, { kernel: "nearest", fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        const row = directions.indexOf(dir);
        composites.push({
          input: resized,
          left: i * fw,
          top: row * fh
        });
      }
    }

    const out = await base.composite(composites).png().toBuffer();
    const abs = await rt.storage.putBuffer(ctx.jobId, `artifacts/sheets/${action}.png`, out);
    ctx.spriteSheets.push({ action, path: abs, cols, rows });
  }

  return { ok: true };
}
