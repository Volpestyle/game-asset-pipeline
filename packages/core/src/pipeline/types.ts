import { ActionSetSchema, PipelineConfigSchema } from "@repo/shared";
import { z } from "zod";
import type { CapabilityId, Direction, ProviderId } from "@repo/shared";

export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;
export type ActionSet = z.infer<typeof ActionSetSchema>;

export type PipelineContext = {
  jobId: string;
  pipelineId: string;
  characterName: string;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  styleStrength: number;

  // Derived from pipeline config
  frame: { width: number; height: number };
  pivot: { x: number; y: number };
  directions: Direction[];
  actionSet: ActionSet;

  // Storage root for this job
  jobDir: string;

  // Provider routing
  providerHint?: ProviderId;
  capabilityOverrides?: Partial<Record<CapabilityId, { provider: ProviderId }>>;

  // Runtime state written by stages
  uploadPaths?: string[];
  stylizedPath?: string;
  turnaroundPaths?: Partial<Record<Direction, string>>;
  frames?: Array<{
    action: string;
    direction: Direction;
    index: number;
    path: string;
  }>;
  masks?: Array<{
    action: string;
    direction: Direction;
    index: number;
    path: string;
  }>;
  spriteSheets?: Array<{
    action: string;
    path: string;
    cols: number;
    rows: number;
  }>;
  manifestPath?: string;
};

export type StageResult = { ok: true } | { ok: false; error: string };

export type StageRunner = (ctx: PipelineContext) => Promise<StageResult>;

export type ProviderCall = {
  capability: CapabilityId;
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;
  seed?: number;
  strength?: number;

  // Optional structural controls
  control?: {
    type: "canny" | "depth" | "pose" | "lineart" | "none";
    imageUrl?: string;
    strength?: number;
  };

  // Optional reference identity conditioning
  reference?: {
    imageUrl: string;
    strength?: number;
  };

  // Provider routing (capability -> endpoint/model is resolved via manifest)
  routing?: {
    endpointId?: string; // fal
    model?: string; // replicate
    version?: string; // replicate
  };

  // Output hinting
  width?: number;
  height?: number;
};

export type ProviderResult = {
  images: Array<{ url: string; width?: number; height?: number }>;
  // Some models may output masks or extra artifacts
  masks?: Array<{ url: string }>;
  raw?: unknown;
};

export type Provider = {
  id: ProviderId;
  supports: (capability: CapabilityId) => boolean;
  run: (call: ProviderCall) => Promise<ProviderResult>;
};
