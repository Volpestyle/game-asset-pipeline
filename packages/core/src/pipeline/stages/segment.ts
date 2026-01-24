import type { PipelineContext, StageResult } from "../types.js";
import { getRuntime } from "../../runtime.js";
import { fetchToBuffer } from "../../utils/fetch.js";
import pLimit from "p-limit";

export async function stageSegment(ctx: PipelineContext): Promise<StageResult> {
  const rt = await getRuntime();
  if (!ctx.frames || ctx.frames.length === 0) return { ok: false, error: "No frames to segment" };

  ctx.masks = [];
  const limit = pLimit(3);

  const tasks = ctx.frames.map((f) =>
    limit(async () => {
      const frameUrl = rt.storage.toFileUrl(f.path, rt.apiBaseUrl);
      const res = await rt.providers.run("mask.segment", {
        prompt: "segment the character (foreground) from transparent background",
        imageUrl: frameUrl,
        width: 512,
        height: 512
      });

      const maskUrl = res.masks?.[0]?.url;
      if (!maskUrl) {
        // Not all providers return masks; treat as non-fatal.
        return;
      }

      const buf = await fetchToBuffer(maskUrl);
      const abs = await rt.storage.putBuffer(ctx.jobId, `artifacts/masks/${f.action}/${f.direction}/${f.index}.png`, buf);
      ctx.masks!.push({ action: f.action, direction: f.direction, index: f.index, path: abs });
    })
  );

  try {
    await Promise.all(tasks);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Segmentation failed" };
  }
}
