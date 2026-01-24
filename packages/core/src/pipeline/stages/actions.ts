import type { PipelineContext, StageResult } from "../types.js";
import { getRuntime } from "../../runtime.js";
import { fetchToBuffer } from "../../utils/fetch.js";
import pLimit from "p-limit";
import type { Direction } from "@repo/shared";

function actionPrompt(base: string, action: string, direction: Direction, frameIndex: number, totalFrames: number) {
  // Prompt tuned for AI-first frame generation; in practice you'll iterate a lot here.
  return `${base}
Sprite frame request:
- action: ${action}
- direction: ${direction}
- frame: ${frameIndex + 1}/${totalFrames}
Constraints:
- same character identity, same outfit, no drift
- fixed camera angle (top-down 3/4), same scale
- clean silhouette, no extra props unless specified
- transparent background
`;
}

export async function stageActions(ctx: PipelineContext): Promise<StageResult> {
  const rt = await getRuntime();
  if (!ctx.turnaroundPaths) return { ok: false, error: "Missing turnaroundPaths" };

  ctx.frames = [];

  // Generate at higher res, downscale later to sprite resolution.
  const genW = 256;
  const genH = 256;

  const limit = pLimit(2);

  const actionEntries = Object.entries(ctx.actionSet.actions);

  // We'll generate frames sequentially per (action,direction) to reduce shimmer: each frame uses previous as init.
  const tasks: Array<Promise<void>> = [];
  for (const [actionName, actionSpec] of actionEntries as [string, (typeof ctx.actionSet.actions)[string]][]) {
    for (const direction of ctx.directions) {
      tasks.push(limit(async () => {
        const baseAbs = ctx.turnaroundPaths![direction];
        if (!baseAbs) throw new Error(`Missing turnaround image for direction ${direction}`);

        let prevAbs = baseAbs;
        for (let i = 0; i < actionSpec.frames; i++) {
          const prevUrl = rt.storage.toFileUrl(prevAbs, rt.apiBaseUrl);

          const res = await rt.providers.run("generate.frame", {
            prompt: actionPrompt(ctx.prompt, actionName, direction, i, actionSpec.frames),
            negativePrompt: ctx.negativePrompt,
            imageUrl: prevUrl,
            seed: ctx.seed ? ctx.seed + i + direction.charCodeAt(0) + actionName.length : undefined,
            strength: i === 0 ? 0.45 : 0.3,
            width: genW,
            height: genH,
            reference: { imageUrl: rt.storage.toFileUrl(baseAbs, rt.apiBaseUrl), strength: 0.8 }
          });

          const outUrl = res.images?.[0]?.url;
          if (!outUrl) throw new Error(`No image returned for ${actionName}/${direction} frame ${i}`);

          const buf = await fetchToBuffer(outUrl);
          const abs = await rt.storage.putBuffer(ctx.jobId, `artifacts/frames/${actionName}/${direction}/${i}.png`, buf);
          ctx.frames!.push({ action: actionName, direction, index: i, path: abs });
          prevAbs = abs;
        }
      }));
    }
  }

  try {
    await Promise.all(tasks);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Action frame generation failed" };
  }
}
