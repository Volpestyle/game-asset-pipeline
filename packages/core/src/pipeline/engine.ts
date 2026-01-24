import fs from "node:fs/promises";
import path from "node:path";
import { PipelineConfigSchema } from "@repo/shared";
import type { PipelineContext, PipelineConfig, StageRunner } from "./types.js";
import { stageIngest } from "./stages/ingest.js";
import { stageStylize } from "./stages/stylize.js";
import { stageTurnaround } from "./stages/turnaround.js";
import { stageActions } from "./stages/actions.js";
import { stageSegment } from "./stages/segment.js";
import { stageSpriteSheet } from "./stages/spritesheet.js";
import { stageManifest } from "./stages/manifest.js";

export type PipelineEvents = {
  onStageStart?: (stageId: string) => void;
  onStageComplete?: (stageId: string) => void;
  onLog?: (message: string) => void;
};

const stageMap: Record<string, StageRunner> = {
  ingest: stageIngest,
  stylize: stageStylize,
  turnaround: stageTurnaround,
  actions: stageActions,
  segment: stageSegment,
  spritesheet: stageSpriteSheet,
  manifest: stageManifest
};

export async function loadPipelineConfig(pipelineId: string, rootDir: string): Promise<PipelineConfig> {
  const cfgPath = path.join(rootDir, "config", "pipelines", `${pipelineId}.json`);
  const raw = await fs.readFile(cfgPath, "utf-8");
  const parsed = PipelineConfigSchema.parse(JSON.parse(raw));
  return parsed;
}

export async function runPipeline(
  ctx: PipelineContext,
  pipelineConfig: PipelineConfig,
  deps: {
    rootDir: string;
    emit: PipelineEvents;
  }
): Promise<{ ok: true; ctx: PipelineContext } | { ok: false; error: string; ctx: PipelineContext }> {
  for (const stage of pipelineConfig.stages) {
    const runner = stageMap[stage.type];
    if (!runner) return { ok: false, error: `Unknown stage type: ${stage.type}`, ctx };

    deps.emit.onStageStart?.(stage.id);
    deps.emit.onLog?.(`Stage ${stage.id} (${stage.type}) started`);

    const res = await runner(ctx);
    if (!res.ok) {
      deps.emit.onLog?.(`Stage ${stage.id} failed: ${res.error}`);
      return { ok: false, error: res.error, ctx };
    }

    deps.emit.onStageComplete?.(stage.id);
    deps.emit.onLog?.(`Stage ${stage.id} complete`);
  }

  return { ok: true, ctx };
}
