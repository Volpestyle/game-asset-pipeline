import type { PipelineContext, StageResult } from "../types.js";
import { getRuntime } from "../../runtime.js";

export async function stageManifest(ctx: PipelineContext): Promise<StageResult> {
  const rt = await getRuntime();
  if (!ctx.spriteSheets || ctx.spriteSheets.length === 0) return { ok: false, error: "No spritesheets generated" };

  const manifest: any = {
    id: ctx.jobId,
    characterName: ctx.characterName,
    pipelineId: ctx.pipelineId,
    frameSize: ctx.frame,
    pivot: ctx.pivot,
    directions: ctx.directions,
    actions: ctx.actionSet.actions,
    sheets: {},
    animations: {}
  };

  for (const sheet of ctx.spriteSheets) {
    manifest.sheets[sheet.action] = {
      url: rt.storage.toFileUrl(sheet.path, rt.apiBaseUrl),
      cols: sheet.cols,
      rows: sheet.rows
    };

    const actionSpec = ctx.actionSet.actions[sheet.action];
    for (const dir of ctx.directions) {
      const key = `${sheet.action}_${dir}`;
      const row = ctx.directions.indexOf(dir);
      const frames = Array.from({ length: actionSpec.frames }).map((_, i) => ({
        // UV rect in pixels within the spritesheet
        x: i * ctx.frame.width,
        y: row * ctx.frame.height,
        w: ctx.frame.width,
        h: ctx.frame.height,
        index: i
      }));

      manifest.animations[key] = {
        action: sheet.action,
        direction: dir,
        fps: actionSpec.fps,
        loop: actionSpec.loop,
        frames,
        events: actionSpec.events ?? {}
      };
    }
  }

  const abs = await rt.storage.putBuffer(ctx.jobId, "artifacts/manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));
  ctx.manifestPath = abs;


  return { ok: true };
}
