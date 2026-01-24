import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-pipeline-data-"));
const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-pipeline-src-"));

process.env.REPO_ROOT_DIR = repoRoot;
process.env.DATA_DIR = dataDir;
process.env.API_BASE_URL = "http://localhost:4000";
process.env.PIPELINE_PROVIDER = "mock";

const { loadPipelineConfig, runPipeline } = await import("../dist/index.js");

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

async function writePng(dir, name) {
  const abs = path.join(dir, name);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(tinyPngBase64, "base64"));
  return abs;
}

function buildContext(jobId, uploadPaths, pipelineConfig) {
  return {
    jobId,
    pipelineId: pipelineConfig.id,
    characterName: "Test Hero",
    prompt: "Top-down RPG pixel character, consistent proportions.",
    negativePrompt: "blurry, extra limbs, background",
    seed: 42,
    styleStrength: 0.6,
    frame: pipelineConfig.styleProfile.frame,
    pivot: pipelineConfig.styleProfile.pivot,
    directions: pipelineConfig.styleProfile.directions,
    actionSet: pipelineConfig.actionSet,
    jobDir: "",
    uploadPaths
  };
}

after(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
  await fs.rm(sourceDir, { recursive: true, force: true });
});

test("pipeline runs end-to-end with a single reference image", async () => {
  const pipelineConfig = await loadPipelineConfig("topdown2d.v1", repoRoot);
  const jobId = `test-single-${Date.now()}`;
  const uploadAbs = await writePng(sourceDir, "single.png");

  const ctx = buildContext(jobId, [uploadAbs], pipelineConfig);
  const result = await runPipeline(ctx, pipelineConfig, { rootDir: repoRoot, emit: {} });

  assert.equal(result.ok, true, result.ok ? "pipeline succeeded" : result.error);
  const outCtx = result.ctx;

  assert.equal(outCtx.uploadPaths?.length, 1);
  const expectedUpload = path.join(dataDir, "jobs", jobId, "uploads", "ref_00.png");
  assert.equal(path.resolve(outCtx.uploadPaths[0]), path.resolve(expectedUpload));
  await fs.access(outCtx.uploadPaths[0]);

  assert.ok(outCtx.stylizedPath);
  await fs.access(outCtx.stylizedPath);

  const directions = pipelineConfig.styleProfile.directions;
  assert.ok(outCtx.turnaroundPaths);
  for (const dir of directions) {
    assert.ok(outCtx.turnaroundPaths[dir]);
    await fs.access(outCtx.turnaroundPaths[dir]);
  }

  const totalFramesPerDir = Object.values(pipelineConfig.actionSet.actions).reduce((sum, a) => sum + a.frames, 0);
  const expectedFrames = totalFramesPerDir * directions.length;
  assert.equal(outCtx.frames?.length, expectedFrames);

  assert.equal(outCtx.masks?.length, expectedFrames);
  assert.equal(outCtx.spriteSheets?.length, Object.keys(pipelineConfig.actionSet.actions).length);

  assert.ok(outCtx.manifestPath);
  const manifestRaw = await fs.readFile(outCtx.manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.pipelineId, pipelineConfig.id);
  assert.deepEqual(manifest.directions, directions);
  for (const action of Object.keys(pipelineConfig.actionSet.actions)) {
    assert.ok(manifest.sheets[action]);
  }
});

test("multiple reference images create a stitched secondary sheet", async () => {
  const pipelineConfig = await loadPipelineConfig("topdown2d.v1", repoRoot);
  const jobId = `test-multi-${Date.now()}`;
  const uploads = await Promise.all([
    writePng(sourceDir, "ref-a.png"),
    writePng(sourceDir, "ref-b.png"),
    writePng(sourceDir, "ref-c.png")
  ]);

  const ctx = buildContext(jobId, uploads, pipelineConfig);
  const miniConfig = {
    ...pipelineConfig,
    stages: pipelineConfig.stages.filter((s) => s.type === "ingest" || s.type === "stylize")
  };

  const result = await runPipeline(ctx, miniConfig, { rootDir: repoRoot, emit: {} });
  assert.equal(result.ok, true, result.ok ? "pipeline succeeded" : result.error);

  const outCtx = result.ctx;
  assert.equal(outCtx.uploadPaths?.length, 3);
  for (let i = 0; i < outCtx.uploadPaths.length; i++) {
    const expected = path.join(dataDir, "jobs", jobId, "uploads", `ref_${String(i).padStart(2, "0")}.png`);
    assert.equal(path.resolve(outCtx.uploadPaths[i]), path.resolve(expected));
  }

  const sheetPath = path.join(dataDir, "jobs", jobId, "uploads", "ref_sheet.png");
  await fs.access(sheetPath);
  assert.ok(outCtx.stylizedPath);
});
