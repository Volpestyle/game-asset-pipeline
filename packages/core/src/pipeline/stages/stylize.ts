import sharp from "sharp";
import type { PipelineContext, StageResult } from "../types.js";
import type { Runtime } from "../../runtime.js";
import { getRuntime } from "../../runtime.js";
import { fetchToBuffer } from "../../utils/fetch.js";

async function buildReferenceSheet(paths: string[], jobId: string, rt: Runtime): Promise<string> {
  const tileSize = 512;
  const cols = Math.ceil(Math.sqrt(paths.length));
  const rows = Math.ceil(paths.length / cols);
  const width = cols * tileSize;
  const height = rows * tileSize;

  const composites = await Promise.all(paths.map(async (p, idx) => {
    const input = await sharp(p)
      .resize(tileSize, tileSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    return {
      input,
      left: (idx % cols) * tileSize,
      top: Math.floor(idx / cols) * tileSize
    };
  }));

  const sheet = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toBuffer();

  return rt.storage.putBuffer(jobId, "uploads/ref_sheet.png", sheet);
}

export async function stageStylize(ctx: PipelineContext): Promise<StageResult> {
  const rt = await getRuntime();
  if (!ctx.uploadPaths || ctx.uploadPaths.length === 0) return { ok: false, error: "Missing uploadPaths" };

  const primaryPath = ctx.uploadPaths[0];
  const secondaryPaths = ctx.uploadPaths.slice(1);
  const inputUrl = rt.storage.toFileUrl(primaryPath, rt.apiBaseUrl);

  let referenceUrl: string | undefined;
  if (secondaryPaths.length === 1) {
    referenceUrl = rt.storage.toFileUrl(secondaryPaths[0], rt.apiBaseUrl);
  } else if (secondaryPaths.length > 1) {
    const sheetAbs = await buildReferenceSheet(secondaryPaths, ctx.jobId, rt);
    referenceUrl = rt.storage.toFileUrl(sheetAbs, rt.apiBaseUrl);
  }

  const res = await rt.providers.run("stylize.img2img", {
    prompt: ctx.prompt,
    negativePrompt: ctx.negativePrompt,
    imageUrl: inputUrl,
    seed: ctx.seed,
    strength: ctx.styleStrength,
    width: 512,
    height: 512,
    reference: referenceUrl ? { imageUrl: referenceUrl, strength: 0.7 } : undefined
  });

  const outUrl = res.images?.[0]?.url;
  if (!outUrl) return { ok: false, error: "Model did not return an image" };

  const buf = await fetchToBuffer(outUrl);
  const abs = await rt.storage.putBuffer(ctx.jobId, "artifacts/stylized.png", buf);
  ctx.stylizedPath = abs;

  return { ok: true };
}
