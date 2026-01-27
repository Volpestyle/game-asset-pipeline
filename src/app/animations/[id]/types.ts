export type GenerationPlanMode = "single" | "segments";

export type GenerationPlanSegment = {
  id: string;
  startFrame: number;
  endFrame: number;
  targetFrameCount: number;
  durationSeconds: number;
  startImageUrl: string;
  endImageUrl?: string | null;
  startLabel: string;
  endLabel: string;
};

export type GenerationPlan = {
  mode: GenerationPlanMode;
  segments: GenerationPlanSegment[];
  errors: string[];
  warnings: string[];
};

export type PlanAnchor = {
  frameIndex: number;
  imageUrl: string;
  label: string;
};
