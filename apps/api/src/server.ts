import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ulid } from "ulid";
import { env } from "./config.js";
import { pipelineQueue } from "./queue.js";
import { prisma, JobStatus, StageStatus, ArtifactType } from "@repo/db";
import { CreateJobRequestSchema, PipelineConfigSchema, ModelManifestSchema } from "@repo/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..", ".."); // apps/api/src -> repo root

function resolveDataDir(): string {
  const d = env().DATA_DIR;
  return path.isAbsolute(d) ? d : path.resolve(repoRoot, d);
}

function safeJoin(rootDir: string, rel: string): string {
  const abs = path.resolve(rootDir, rel);
  if (!abs.startsWith(rootDir)) throw new Error("Path traversal blocked");
  return abs;
}

async function readJson(relFromRepoRoot: string): Promise<any> {
  const abs = safeJoin(repoRoot, relFromRepoRoot);
  const raw = await fs.readFile(abs, "utf-8");
  return JSON.parse(raw);
}

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "SYS:standard", ignore: "pid,hostname" }
    }
  }
});

app.register(cors, { origin: true });
app.register(multipart, {
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

app.register(swagger, {
  swagger: {
    info: { title: "Sprite Pipeline API", version: "0.0.1" }
  }
});
app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/health", async () => ({ ok: true }));

/**
 * Serve files from DATA_DIR (generated artifacts).
 * URLs are produced by core via: /files/<encoded-relative-path>
 */
app.get("/files/:rel", async (req, reply) => {
  const dataDir = resolveDataDir();
  const rel = decodeURIComponent((req.params as any).rel);
  const abs = safeJoin(dataDir, rel);

  const stat = await fs.stat(abs);
  if (!stat.isFile()) return reply.code(404).send({ error: "Not found" });

  const buf = await fs.readFile(abs);
  // naive content type
  const ct = abs.endsWith(".png") ? "image/png" : abs.endsWith(".json") ? "application/json" : "application/octet-stream";
  reply.header("Content-Type", ct);
  return reply.send(buf);
});

app.get("/v1/jobs", async () => {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { stages: true, artifacts: true }
  });
  return { jobs };
});

app.get("/v1/jobs/:id", async (req) => {
  const id = (req.params as any).id as string;
  const job = await prisma.job.findUnique({ where: { id }, include: { stages: true, artifacts: true } });
  if (!job) return { error: "Not found" };
  return { job };
});

/**
 * SSE endpoint that pushes job snapshots every ~1s.
 * (Simple + robust across API/worker processes, no extra event bus required.)
 */
app.get("/v1/jobs/:id/events", async (req, reply) => {
  const id = (req.params as any).id as string;

  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.flushHeaders();

  let lastUpdated = 0;

  const timer = setInterval(async () => {
    const job = await prisma.job.findUnique({ where: { id }, include: { stages: true, artifacts: true } });
    if (!job) return;

    const updated = new Date(job.updatedAt).getTime();
    if (updated <= lastUpdated) return;
    lastUpdated = updated;

    const payload = JSON.stringify({ job });
    reply.raw.write(`event: snapshot\n`);
    reply.raw.write(`data: ${payload}\n\n`);
  }, 1000);

  req.raw.on("close", () => {
    clearInterval(timer);
  });

  // initial push
  const job = await prisma.job.findUnique({ where: { id }, include: { stages: true, artifacts: true } });
  if (job) {
    lastUpdated = new Date(job.updatedAt).getTime();
    reply.raw.write(`event: snapshot\n`);
    reply.raw.write(`data: ${JSON.stringify({ job })}\n\n`);
  }

  return reply;
});

/**
 * Read model manifest (capability routing) so the UI can display what's active.
 */
app.get("/v1/models/manifest", async () => {
  const mf = await readJson("config/model-manifest.json");
  const parsed = ModelManifestSchema.parse(mf);
  return { manifest: parsed };
});

/**
 * Update model manifest (hot-swap models as better ones come out).
 * NOTE: For a real deployment, secure this endpoint.
 */
app.put("/v1/models/manifest", async (req, reply) => {
  const body = req.body as any;
  const parsed = ModelManifestSchema.parse(body);
  const abs = safeJoin(repoRoot, "config/model-manifest.json");
  await fs.writeFile(abs, JSON.stringify(parsed, null, 2), "utf-8");
  reply.send({ ok: true });
});

/**
 * Create a job:
 * multipart/form-data with:
 * - images: file (repeatable)
 * - payload: JSON string (CreateJobRequest)
 */
app.post("/v1/jobs", async (req: FastifyRequest, reply: FastifyReply) => {
  const parts = req.parts();
  let payloadJson: string | null = null;
  const images: Array<{ buf: Buffer; filename: string | null }> = [];

  for await (const part of parts) {
    if (part.type === "file" && (part.fieldname === "images" || part.fieldname === "image")) {
      images.push({ buf: await part.toBuffer(), filename: part.filename ?? null });
    } else if (part.type === "field" && part.fieldname === "payload") {
      payloadJson = String(part.value);
    }
  }

  if (!payloadJson) return reply.code(400).send({ error: "Missing payload field" });
  if (images.length === 0) return reply.code(400).send({ error: "Missing image file(s)" });

  const payload = CreateJobRequestSchema.parse(JSON.parse(payloadJson));
  const pipelineCfg = PipelineConfigSchema.parse(await readJson(`config/pipelines/${payload.pipelineId}.json`));

  const jobId = ulid();
  const dataDir = resolveDataDir();

  // Write uploads to job folder
  const uploadAbsList: string[] = [];
  const uploadUrlList: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const ext = image.filename?.toLowerCase().endsWith(".jpg") || image.filename?.toLowerCase().endsWith(".jpeg") ? ".jpg" : ".png";
    const refId = String(i).padStart(2, "0");
    const uploadRel = path.join("jobs", jobId, "uploads", `ref_${refId}${ext}`);
    const uploadAbs = safeJoin(dataDir, uploadRel);
    await fs.mkdir(path.dirname(uploadAbs), { recursive: true });
    await fs.writeFile(uploadAbs, image.buf);

    uploadAbsList.push(uploadAbs);
    uploadUrlList.push(`${env().API_BASE_URL.replace(/\/$/, "")}/files/${encodeURIComponent(uploadRel.split(path.sep).join("/"))}`);
  }

  // Create DB records
  await prisma.job.create({
    data: {
      id: jobId,
      pipelineId: payload.pipelineId,
      characterName: payload.characterName,
      prompt: payload.prompt,
      negativePrompt: payload.negativePrompt,
      seed: payload.seed,
      styleStrength: payload.styleStrength,
      status: JobStatus.QUEUED,
      stages: {
        create: pipelineCfg.stages.map((s) => ({
          id: ulid(),
          stageId: s.id,
          type: s.type,
          status: StageStatus.PENDING
        }))
      },
      artifacts: {
        create: uploadAbsList.map((absPath, index) => ({
          id: ulid(),
          type: ArtifactType.UPLOAD,
          name: `upload_${index}`,
          absPath,
          url: uploadUrlList[index]
        }))
      }
    }
  });

  await pipelineQueue.add("run", {
    jobId,
    uploadAbsList,
    payload
  }, { attempts: 1 });

  return reply.code(201).send({ jobId });
});

const port = env().API_PORT;
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Shutting down API...");

  const timeout = setTimeout(() => {
    app.log.error("Shutdown timed out; forcing exit.");
    process.exit(1);
  }, 10_000);

  const results = await Promise.allSettled([app.close(), pipelineQueue.close(), prisma.$disconnect()]);
  for (const result of results) {
    if (result.status === "rejected") {
      app.log.error(result.reason);
    }
  }

  clearTimeout(timeout);
  process.exit(0);
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => void shutdown(signal));
});

async function start(): Promise<void> {
  try {
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`API listening on ${env().API_BASE_URL}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
