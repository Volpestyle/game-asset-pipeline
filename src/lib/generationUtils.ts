export type SegmentInput = {
  id: string;
  startFrame: number;
  endFrame: number;
  durationSeconds: number;
  startImageUrl: string;
  endImageUrl?: string | null;
};

export type SegmentPlan = SegmentInput & {
  targetFrameCount: number;
};

export type SegmentValidationOptions = {
  segments: SegmentPlan[];
  totalFrameCount: number;
  extractFps: number;
  allowedSeconds: number[];
  supportsStartEnd: boolean;
  modelLabel: string;
};

export function sampleEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const lastIndex = items.length - 1;
  const selected = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i * lastIndex) / (count - 1));
    selected.add(idx);
  }
  if (selected.size < count) {
    for (let i = 0; i < items.length && selected.size < count; i += 1) {
      selected.add(i);
    }
  }
  return Array.from(selected)
    .sort((a, b) => a - b)
    .map((index) => items[index]);
}

export function selectFrameIndices(sourceCount: number, targetCount: number): number[] {
  if (sourceCount <= 0 || targetCount <= 0) return [];
  if (targetCount === 1) return [0];
  if (sourceCount < targetCount) return [];
  const indices: number[] = [];
  const ratio = (sourceCount - 1) / (targetCount - 1);
  for (let i = 0; i < targetCount; i += 1) {
    indices.push(Math.round(i * ratio));
  }
  return indices;
}

export function normalizeSegmentPlan(segments: SegmentPlan[]): SegmentPlan[] {
  return [...segments].sort((a, b) => a.startFrame - b.startFrame);
}

export function validateSegmentPlan(options: SegmentValidationOptions): string | null {
  const {
    segments,
    totalFrameCount,
    extractFps,
    allowedSeconds,
    supportsStartEnd,
    modelLabel,
  } = options;
  if (segments.length === 0) return null;
  if (!allowedSeconds.length) {
    return `No duration options available for ${modelLabel}.`;
  }
  if (!Number.isFinite(totalFrameCount) || totalFrameCount <= 0) {
    return "Invalid frame count for segmented generation.";
  }
  if (segments[0].startFrame !== 0) {
    return "Segment plan must start at frame 0.";
  }
  const lastFrameIndex = totalFrameCount - 1;
  if (segments[segments.length - 1].endFrame !== lastFrameIndex) {
    return `Segment plan must end at frame ${lastFrameIndex}.`;
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!Number.isInteger(segment.startFrame) || !Number.isInteger(segment.endFrame)) {
      return "Segment frame indices must be integers.";
    }
    if (segment.startFrame < 0 || segment.endFrame < segment.startFrame) {
      return `Invalid segment frame range ${segment.startFrame}-${segment.endFrame}.`;
    }
    if (segment.endFrame > lastFrameIndex) {
      return `Segment end frame ${segment.endFrame} exceeds ${lastFrameIndex}.`;
    }
    if (!segment.startImageUrl) {
      return `Missing start image for segment ${segment.startFrame}-${segment.endFrame}.`;
    }
    if (!supportsStartEnd && segment.endImageUrl) {
      return `${modelLabel} does not support explicit end frames.`;
    }
    if (segments.length > 1 && !segment.endImageUrl) {
      return `Missing end image for segment ${segment.startFrame}-${segment.endFrame}.`;
    }
    if (!allowedSeconds.includes(segment.durationSeconds)) {
      return `Duration ${segment.durationSeconds}s is not supported by ${modelLabel}.`;
    }
    if (segment.targetFrameCount !== segment.endFrame - segment.startFrame + 1) {
      return `Segment ${segment.startFrame}-${segment.endFrame} has mismatched frame count.`;
    }
    const expectedFrames = Math.round(segment.durationSeconds * extractFps);
    if (expectedFrames < segment.targetFrameCount) {
      return `Segment ${segment.startFrame}-${segment.endFrame} duration is too short.`;
    }
    if (index > 0) {
      const prev = segments[index - 1];
      if (segment.startFrame !== prev.endFrame) {
        return "Segments must overlap on the end frame to keep timing aligned.";
      }
    }
  }
  return null;
}
