import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";

export type WorkingSpec = {
  canvasW: number;
  canvasH: number;
  scale: number;
  roi: { x: number; y: number; w: number; h: number };
  bgKeyColor: string;
};

type BuildWorkingReferenceOptions = {
  sourcePath: string;
  outputPath: string;
  canvasW?: number;
  canvasH?: number;
  bgKeyColor?: string;
  baseWidth?: number;
  baseHeight?: number;
};

function parseHexColor(color: string) {
  const cleaned = color.replace("#", "").trim();
  if (cleaned.length !== 6) {
    return { r: 255, g: 0, b: 255 };
  }
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 255,
    g: Number.isFinite(g) ? g : 0,
    b: Number.isFinite(b) ? b : 255,
  };
}

export async function buildWorkingReference(
  options: BuildWorkingReferenceOptions
): Promise<{
  baseWidth: number;
  baseHeight: number;
  workingSpec: WorkingSpec;
  outputWidth: number;
  outputHeight: number;
}> {
  const canvasW = options.canvasW ?? 1024;
  const canvasH = options.canvasH ?? 1792;
  const bgKeyColor = options.bgKeyColor ?? "#FF00FF";
  const metadata = await sharp(options.sourcePath).metadata();
  const baseWidth =
    options.baseWidth ?? metadata.width ?? 253;
  const baseHeight =
    options.baseHeight ?? metadata.height ?? 504;

  const maxScale = Math.min(canvasW / baseWidth, canvasH / baseHeight);
  const scale = maxScale >= 1 ? Math.floor(maxScale) : maxScale;
  const roiW = Math.min(canvasW, Math.max(1, Math.floor(baseWidth * scale)));
  const roiH = Math.min(canvasH, Math.max(1, Math.floor(baseHeight * scale)));
  const roiX = Math.floor((canvasW - roiW) / 2);
  const roiY = Math.floor((canvasH - roiH) / 2);

  const workingSpec: WorkingSpec = {
    canvasW,
    canvasH,
    scale,
    roi: { x: roiX, y: roiY, w: roiW, h: roiH },
    bgKeyColor,
  };

  const sprite = await sharp(options.sourcePath)
    .resize(roiW, roiH, { kernel: "nearest" })
    .png()
    .toBuffer();

  const bg = parseHexColor(bgKeyColor);
  const composed = sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 },
    },
  }).composite([{ input: sprite, left: roiX, top: roiY }]);

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await composed.png().toFile(options.outputPath);

  return {
    baseWidth,
    baseHeight,
    workingSpec,
    outputWidth: canvasW,
    outputHeight: canvasH,
  };
}
