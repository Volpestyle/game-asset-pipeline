import type { PipelineContext, StageResult } from "../types.js";
import { getRuntime } from "../../runtime.js";
import { fetchToBuffer } from "../../utils/fetch.js";
import type { Direction } from "@repo/shared";
import pLimit from "p-limit";

function dirPrompt(base: string, direction: Direction) {
  const map: Record<Direction, string> = {
    N: "facing north / back view (top-down RPG)",
    S: "facing south / front view (top-down RPG)",
    W: "facing west / left view (top-down RPG)",
    E: "facing east / right view (top-down RPG)"
  };

  return `${base}
Output: single character only, centered, consistent proportions, clean silhouette, transparent background.
Direction: ${map[direction]}.`;
}

export async function stageTurnaround(ctx: PipelineContext): Promise<StageResult> {
  const rt = await getRuntime();
  const primaryPath = ctx.uploadPaths?.[0];
  const sourcePath = ctx.stylizedPath ?? primaryPath;
  if (!sourcePath) return { ok: false, error: "Missing stylizedPath/uploadPaths" };

  const sourceUrl = rt.storage.toFileUrl(sourcePath, rt.apiBaseUrl);

  ctx.turnaroundPaths = ctx.turnaroundPaths ?? {};
  const limit = pLimit(2);

  const tasks = ctx.directions.map((d) =>
    limit(async () => {
      const res = await rt.providers.run("generate.turnaround", {
        prompt: dirPrompt(ctx.prompt, d),
        negativePrompt: ctx.negativePrompt,
        imageUrl: sourceUrl,
        seed: ctx.seed ? ctx.seed + d.charCodeAt(0) : undefined,
        strength: 0.55,
        width: 512,
        height: 512,
        reference: { imageUrl: sourceUrl, strength: 0.75 }
      });

      const outUrl = res.images?.[0]?.url;
      if (!outUrl) throw new Error(`No image returned for direction ${d}`);

      const buf = await fetchToBuffer(outUrl);
      const abs = await rt.storage.putBuffer(ctx.jobId, `artifacts/turnaround_${d}.png`, buf);
      ctx.turnaroundPaths![d] = abs;
    })
  );

  try {
    await Promise.all(tasks);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Turnaround generation failed" };
  }
}
