import { describe, expect, it } from "vitest";
import { buildAsepriteJson } from "@/lib/aseprite";
import {
  buildIndexJson,
  buildZipAsepriteJson,
  clampAlphaThreshold,
  frameIndexFromName,
  parseBackgroundRemovalMode,
} from "@/lib/exportPipeline";

describe("export pipeline helpers", () => {
  it("clamps alpha thresholds into 0-255", () => {
    expect(clampAlphaThreshold(-10)).toBe(0);
    expect(clampAlphaThreshold(0)).toBe(0);
    expect(clampAlphaThreshold(128.4)).toBe(128);
    expect(clampAlphaThreshold(999)).toBe(255);
    expect(clampAlphaThreshold("foo")).toBeNull();
  });

  it("parses background removal modes", () => {
    expect(parseBackgroundRemovalMode("spritesheet")).toBe("spritesheet");
    expect(parseBackgroundRemovalMode("sheet")).toBe("spritesheet");
    expect(parseBackgroundRemovalMode("per-frame")).toBe("per-frame");
    expect(parseBackgroundRemovalMode("per_frame")).toBe("per-frame");
    expect(parseBackgroundRemovalMode("frames")).toBe("per-frame");
    expect(parseBackgroundRemovalMode("other")).toBeNull();
  });

  it("extracts frame index from filenames", () => {
    expect(frameIndexFromName("frame_012.png")).toBe(12);
    expect(frameIndexFromName("frame_3")).toBe(3);
    expect(frameIndexFromName("nope.png")).toBe(0);
  });

  it("builds frame index JSON with duration", () => {
    const indexJson = buildIndexJson(
      [
        { filename: "frame_000.png", frameIndex: 0 },
        { filename: "frame_001.png", frameIndex: 1 },
      ],
      10
    );
    expect(indexJson.frames).toHaveLength(2);
    expect(indexJson.frames[0].duration).toBe(100);
    expect(indexJson.meta.frameRate).toBe(10);
  });

  it("rewrites aseprite metadata for zip", () => {
    const { arrayJson, hashJson } = buildAsepriteJson({
      imageName: "spritesheet_original.png",
      imageWidth: 32,
      imageHeight: 32,
      frameSize: 16,
      fps: 12,
    });
    const { zipArrayJson, zipHashJson } = buildZipAsepriteJson(
      arrayJson,
      hashJson,
      "spritesheet.png"
    );
    const parsedArray = JSON.parse(zipArrayJson);
    const parsedHash = JSON.parse(zipHashJson);
    expect(parsedArray.meta.image).toBe("spritesheet.png");
    expect(parsedHash.meta.image).toBe("spritesheet.png");
  });
});
