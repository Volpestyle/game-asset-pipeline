import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import { ulid } from "ulid";
import { env } from "./config.js";
import { prisma, JobStatus, StageStatus, ArtifactType } from "@repo/db";
import { loadPipelineConfig, runPipeline } from "@repo/core";
import type { PipelineContext } from "@repo/core";
import type { CreateJobRequest } from "@repo/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..", ".."); // apps/worker/src -> repo root

// Ensure core runtime resolves paths relative to the monorepo, not apps/worker.
process.env.REPO_ROOT_DIR = process.env.REPO_ROOT_DIR ?? repoRoot;
if (process.env.DATA_DIR && !path.isAbsolute(process.env.DATA_DIR)) {
  process.env.DATA_DIR = path.resolve(repoRoot, process.env.DATA_DIR);
}

function fileUrlFor(absPath: string): string {
  const base = env().API_BASE_URL.replace(/\/$/, "");
  const dataDir = path.isAbsolute(env().DATA_DIR) ? env().DATA_DIR : path.resolve(repoRoot, env().DATA_DIR);
  const rel = path.relative(dataDir, absPath).split(path.sep).join("/");
  return `${base}/files/${encodeURIComponent(rel)}`;
}

async function upsertArtifacts(jobId: string, ctx: PipelineContext) {
  const existing = await prisma.artifact.findMany({ where: { jobId } });
  const existingNames = new Set(existing.map((a) => `${a.type}:${a.name}`));

  const pending: Array<{ type: ArtifactType; name: string; absPath: string; url: string }> = [];

  if (ctx.uploadPaths?.length) {
    ctx.uploadPaths.forEach((absPath, index) => {
      pending.push({ type: ArtifactType.UPLOAD, name: `upload_${index}`, absPath, url: fileUrlFor(absPath) });
    });
  }
  if (ctx.stylizedPath) pending.push({ type: ArtifactType.STYLIZED, name: "stylized", absPath: ctx.stylizedPath, url: fileUrlFor(ctx.stylizedPath) });

  if (ctx.turnaroundPaths) {
    for (const [dir, abs] of Object.entries(ctx.turnaroundPaths)) {
      if (!abs) continue;
      pending.push({ type: ArtifactType.TURNAROUND, name: `turnaround_${dir}`, absPath: abs, url: fileUrlFor(abs) });
    }
  }

  if (ctx.frames) {
    for (const f of ctx.frames) {
      pending.push({ type: ArtifactType.FRAME, name: `frame_${f.action}_${f.direction}_${f.index}`, absPath: f.path, url: fileUrlFor(f.path) });
    }
  }

  if (ctx.masks) {
    for (const m of ctx.masks) {
      pending.push({ type: ArtifactType.MASK, name: `mask_${m.action}_${m.direction}_${m.index}`, absPath: m.path, url: fileUrlFor(m.path) });
    }
  }

  if (ctx.spriteSheets) {
    for (const s of ctx.spriteSheets) {
      pending.push({ type: ArtifactType.SPRITESHEET, name: `sheet_${s.action}`, absPath: s.path, url: fileUrlFor(s.path) });
    }
  }

  if (ctx.manifestPath) pending.push({ type: ArtifactType.MANIFEST, name: "manifest", absPath: ctx.manifestPath, url: fileUrlFor(ctx.manifestPath) });

  const toCreate = pending.filter((p) => !existingNames.has(`${p.type}:${p.name}`));
  if (toCreate.length === 0) return;

  await prisma.artifact.createMany({
    data: toCreate.map((a) => ({
      id: ulid(),
      jobId,
      type: a.type,
      name: a.name,
      absPath: a.absPath,
      url: a.url
    }))
  });
}

async function setStage(jobId: string, stageId: string, status: StageStatus, message?: string) {
  const data: any = { status, message: message ?? null };
  if (status === StageStatus.RUNNING) data.startedAt = new Date();
  if (status === StageStatus.SUCCEEDED || status === StageStatus.FAILED) data.endedAt = new Date();

  await prisma.jobStage.updateMany({
    where: { jobId, stageId },
    data
  });
}

let worker: Worker | null = null;
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Shutting down worker (${signal})...`);

  const timeout = setTimeout(() => {
    console.error("Shutdown timed out; forcing exit.");
    process.exit(1);
  }, 10_000);

  const results = await Promise.allSettled([worker?.close(), prisma.$disconnect()]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(result.reason);
    }
  }

  clearTimeout(timeout);
  process.exit(0);
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => void shutdown(signal));
});

async function main() {
  worker = new Worker(
    "pipeline",
    async (job) => {
      const { jobId, uploadAbsList, payload } = job.data as { jobId: string; uploadAbsList: string[]; payload: CreateJobRequest };

      const pipelineConfig = await loadPipelineConfig(payload.pipelineId, repoRoot);

      // Merge action overrides (if present)
      const actionSet = payload.actionOverrides
        ? { ...pipelineConfig.actionSet, actions: { ...pipelineConfig.actionSet.actions, ...payload.actionOverrides } }
        : pipelineConfig.actionSet;

      const ctx: PipelineContext = {
        jobId,
        pipelineId: payload.pipelineId,
        characterName: payload.characterName,
        prompt: payload.prompt,
        negativePrompt: payload.negativePrompt,
        seed: payload.seed,
        styleStrength: payload.styleStrength,
        frame: pipelineConfig.styleProfile.frame,
        pivot: pipelineConfig.styleProfile.pivot,
        directions: pipelineConfig.styleProfile.directions,
        actionSet,
        jobDir: "",
        uploadPaths: uploadAbsList
      };

      await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });

      const result = await runPipeline(ctx, pipelineConfig, {
        rootDir: repoRoot,
        emit: {
          onStageStart: async (stageId) => {
            await setStage(jobId, stageId, StageStatus.RUNNING);
            await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });
          },
          onStageComplete: async (stageId) => {
            await setStage(jobId, stageId, StageStatus.SUCCEEDED);
            await upsertArtifacts(jobId, ctx);
          },
          onLog: async (msg) => {
            // Keep a breadcrumb for UI
            await prisma.jobStage.updateMany({
              where: { jobId, status: StageStatus.RUNNING },
              data: { message: msg }
            });
          }
        }
      });

      if (!result.ok) {
        await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.FAILED } });
        // Mark any running stage failed
        await prisma.jobStage.updateMany({
          where: { jobId, status: StageStatus.RUNNING },
          data: { status: StageStatus.FAILED, endedAt: new Date(), message: result.error }
        });
        throw new Error(result.error);
      }

      await upsertArtifacts(jobId, ctx);
      await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.SUCCEEDED } });

      return { ok: true };
    },
    { connection: { url: env().REDIS_URL }, concurrency: 1 }
  );

  worker.on("completed", (job) => {
    console.log(`Job completed: ${job.id}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`Job failed: ${job?.id}`, err);
  });

  console.log("Worker started.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
