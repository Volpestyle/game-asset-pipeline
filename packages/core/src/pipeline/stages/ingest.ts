import fs from "node:fs/promises";
import path from "node:path";
import type { PipelineContext, StageResult } from "../types.js";
import { getRuntime } from "../../runtime.js";

export async function stageIngest(ctx: PipelineContext): Promise<StageResult> {
  const rt = await getRuntime();
  const jobDir = await rt.storage.ensureJobDir(ctx.jobId);
  ctx.jobDir = jobDir;

  if (!ctx.uploadPaths || ctx.uploadPaths.length === 0) return { ok: false, error: "Missing uploadPaths in pipeline context" };

  for (const uploadPath of ctx.uploadPaths) {
    try {
      await fs.access(uploadPath);
    } catch {
      return { ok: false, error: `Upload file not found: ${uploadPath}` };
    }
  }

  // Normalize upload location under the job dir (so everything is self-contained).
  const normalized: string[] = [];
  for (let i = 0; i < ctx.uploadPaths.length; i++) {
    const uploadPath = ctx.uploadPaths[i];
    const ext = path.extname(uploadPath) || ".png";
    const refId = String(i).padStart(2, "0");
    const relPath = `uploads/ref_${refId}${ext}`;
    const destAbs = path.join(jobDir, relPath);
    if (path.resolve(uploadPath) === path.resolve(destAbs)) {
      normalized.push(destAbs);
      continue;
    }
    const dest = await rt.storage.putFile(ctx.jobId, relPath, uploadPath);
    normalized.push(dest);
  }
  ctx.uploadPaths = normalized;

  return { ok: true };
}
