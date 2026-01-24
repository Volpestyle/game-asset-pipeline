import { z } from "zod";

export const DirectionSchema = z.enum(["N", "S", "E", "W"]);

export const ActionSchema = z.object({
  fps: z.number().int().nonnegative(),
  frames: z.number().int().positive(),
  loop: z.boolean(),
  events: z.record(z.array(z.number().int().nonnegative()))
});

export const ActionSetSchema = z.object({
  id: z.string(),
  directions: z.array(DirectionSchema).min(1),
  actions: z.record(ActionSchema)
});

export const StyleProfileSchema = z.object({
  frame: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  pivot: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative()
  }),
  directions: z.array(DirectionSchema).min(1),
  palette: z.object({
    mode: z.enum(["restricted", "free"]).default("restricted"),
    maxColors: z.number().int().positive().default(24)
  })
});

export const PipelineConfigSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  styleProfile: StyleProfileSchema,
  actionSet: ActionSetSchema,
  stages: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum([
          "ingest",
          "stylize",
          "turnaround",
          "actions",
          "segment",
          "spritesheet",
          "manifest"
        ]),
        capability: z.string().optional()
      })
    )
    .min(1)
});

export const CreateJobRequestSchema = z.object({
  pipelineId: z.string().default("topdown2d.v1"),
  characterName: z.string().min(1).max(64),
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  seed: z.number().int().optional(),
  styleStrength: z.number().min(0).max(1).default(0.6),
  actionOverrides: z.record(z.any()).optional()
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export const ModelManifestSchema = z.object({
  version: z.number().int(),
  defaults: z.object({
    provider: z.enum(["fal", "replicate", "mock"]),
    timeoutMs: z.number().int().positive()
  }),
  capabilities: z.record(
    z.object({
      provider: z.enum(["fal", "replicate", "mock"]),
      endpointId: z.string().optional(),
      model: z.string().optional(),
      version: z.string().optional(),
      notes: z.string().optional()
    })
  )
});

export type ModelManifest = z.infer<typeof ModelManifestSchema>;
