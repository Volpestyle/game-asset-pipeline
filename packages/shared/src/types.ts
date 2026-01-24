export type Direction = "N" | "S" | "E" | "W";

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
export type StageStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type ProviderId = "fal" | "replicate" | "mock";

export type CapabilityId =
  | "stylize.img2img"
  | "generate.turnaround"
  | "generate.frame"
  | "mask.segment"
  | "upscale.optional";

export type ArtifactType =
  | "UPLOAD"
  | "STYLIZED"
  | "TURNAROUND"
  | "FRAME"
  | "MASK"
  | "SPRITESHEET"
  | "MANIFEST"
  | "PREVIEW";
