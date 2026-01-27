import { describe, expect, it } from "vitest";
import {
  normalizeSegmentPlan,
  sampleEvenly,
  selectFrameIndices,
  validateSegmentPlan,
  type SegmentPlan,
} from "@/lib/generationUtils";

describe("generation utils", () => {
  it("samples evenly across items", () => {
    const result = sampleEvenly([0, 1, 2, 3, 4], 3);
    expect(result).toEqual([0, 2, 4]);
  });

  it("selects frame indices across a range", () => {
    const indices = selectFrameIndices(5, 3);
    expect(indices).toEqual([0, 2, 4]);
  });

  it("normalizes segment plan order", () => {
    const segments: SegmentPlan[] = [
      {
        id: "b",
        startFrame: 3,
        endFrame: 5,
        targetFrameCount: 3,
        durationSeconds: 1,
        startImageUrl: "b-start",
        endImageUrl: "b-end",
      },
      {
        id: "a",
        startFrame: 0,
        endFrame: 2,
        targetFrameCount: 3,
        durationSeconds: 1,
        startImageUrl: "a-start",
        endImageUrl: "a-end",
      },
    ];
    const normalized = normalizeSegmentPlan(segments);
    expect(normalized[0].id).toBe("a");
    expect(normalized[1].id).toBe("b");
  });

  it("validates segment plan constraints", () => {
    const segments: SegmentPlan[] = [
      {
        id: "segment-1",
        startFrame: 0,
        endFrame: 2,
        targetFrameCount: 3,
        durationSeconds: 1,
        startImageUrl: "start.png",
        endImageUrl: "end.png",
      },
    ];
    const message = validateSegmentPlan({
      segments,
      totalFrameCount: 3,
      extractFps: 3,
      allowedSeconds: [1, 2],
      supportsStartEnd: true,
      modelLabel: "TestModel",
    });
    expect(message).toBeNull();
  });

  it("rejects segment plans that do not start at frame 0", () => {
    const segments: SegmentPlan[] = [
      {
        id: "segment-1",
        startFrame: 1,
        endFrame: 2,
        targetFrameCount: 2,
        durationSeconds: 1,
        startImageUrl: "start.png",
        endImageUrl: "end.png",
      },
    ];
    const message = validateSegmentPlan({
      segments,
      totalFrameCount: 3,
      extractFps: 3,
      allowedSeconds: [1],
      supportsStartEnd: true,
      modelLabel: "TestModel",
    });
    expect(message).toBe("Segment plan must start at frame 0.");
  });
});
