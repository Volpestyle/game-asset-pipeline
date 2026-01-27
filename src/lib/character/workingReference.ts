import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";
import { DEFAULT_BG_KEY, parseHexColor } from "@/lib/color";

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

export type NormalizeImageOptions = BuildWorkingReferenceOptions;

export async function normalizeImageToCanvas(
  options: NormalizeImageOptions
): Promise<{
  baseWidth: number;
  baseHeight: number;
  workingSpec: WorkingSpec;
  outputWidth: number;
  outputHeight: number;
}> {
  const canvasW = options.canvasW ?? 1024;
  const canvasH = options.canvasH ?? 1792;
  const bgKeyColor = options.bgKeyColor ?? DEFAULT_BG_KEY;
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

export async function buildWorkingReference(
  options: BuildWorkingReferenceOptions
): Promise<{
  baseWidth: number;
  baseHeight: number;
  workingSpec: WorkingSpec;
  outputWidth: number;
  outputHeight: number;
}> {
  return normalizeImageToCanvas(options);
}
