import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

export type SpritesheetLayout = {
  frameSize?: number;
  frameWidth?: number;
  frameHeight?: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
};

export async function getSpritesheetLayout(
  spritesheetPath: string,
  frameSize: number | { frameWidth: number; frameHeight: number }
): Promise<SpritesheetLayout> {
  const metadata = await sharp(spritesheetPath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const resolvedFrameWidth =
    typeof frameSize === "number" ? frameSize : frameSize.frameWidth;
  const resolvedFrameHeight =
    typeof frameSize === "number" ? frameSize : frameSize.frameHeight;
  const columns =
    resolvedFrameWidth > 0 ? Math.floor(width / resolvedFrameWidth) : 0;
  const rows =
    resolvedFrameHeight > 0 ? Math.floor(height / resolvedFrameHeight) : 0;

  if (!width || !height || !columns || !rows) {
    throw new Error("Invalid spritesheet layout.");
  }

  return {
    frameSize: typeof frameSize === "number" ? frameSize : undefined,
    frameWidth: resolvedFrameWidth,
    frameHeight: resolvedFrameHeight,
    columns,
    rows,
    width,
    height,
  };
}

export async function extractFrames(options: {
  spritesheetPath: string;
  outputDir: string;
  frameSize?: number;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
}) {
  const fallbackSize =
    options.frameSize ??
    (options.frameWidth && options.frameHeight
      ? Math.max(options.frameWidth, options.frameHeight)
      : 0);
  const frameWidth = options.frameWidth ?? options.frameSize ?? fallbackSize;
  const frameHeight = options.frameHeight ?? options.frameSize ?? fallbackSize;
  const layout = await getSpritesheetLayout(
    options.spritesheetPath,
    { frameWidth, frameHeight }
  );

  await fs.mkdir(options.outputDir, { recursive: true });
  const frames: { frameIndex: number; filename: string; path: string }[] = [];

  const maxFrames =
    typeof options.frameCount === "number" && options.frameCount > 0
      ? options.frameCount
      : layout.columns * layout.rows;

  let index = 0;
  outer: for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.columns; col += 1) {
      if (index >= maxFrames) break outer;
      const left = col * (layout.frameWidth ?? 0);
      const top = row * (layout.frameHeight ?? 0);
      const filename = `frame_${String(index).padStart(3, "0")}.png`;
      const framePath = path.join(options.outputDir, filename);

      await sharp(options.spritesheetPath)
        .extract({
          left,
          top,
          width: layout.frameWidth ?? 0,
          height: layout.frameHeight ?? 0,
        })
        .png()
        .toFile(framePath);

      frames.push({ frameIndex: index, filename, path: framePath });
      index += 1;
    }
  }

  return { layout, frames };
}

export async function composeSpritesheet(options: {
  framesDir: string;
  outputPath: string;
  layout: SpritesheetLayout;
}) {
  const { layout } = options;
  const frameWidth = layout.frameWidth ?? layout.frameSize ?? 0;
  const frameHeight = layout.frameHeight ?? layout.frameSize ?? 0;
  if (!frameWidth || !frameHeight) {
    throw new Error("Invalid spritesheet layout.");
  }
  const base = sharp({
    create: {
      width: layout.columns * frameWidth,
      height: layout.rows * frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const composites: sharp.OverlayOptions[] = [];
  const totalFrames = layout.columns * layout.rows;

  for (let index = 0; index < totalFrames; index += 1) {
    const filename = `frame_${String(index).padStart(3, "0")}.png`;
    const framePath = path.join(options.framesDir, filename);
    try {
      await fs.access(framePath);
    } catch {
      continue;
    }

    const left = (index % layout.columns) * frameWidth;
    const top = Math.floor(index / layout.columns) * frameHeight;

    composites.push({ input: framePath, left, top });
  }

  await base.composite(composites).png().toFile(options.outputPath);
}

export async function writeFrameImage(options: {
  buffer: Buffer;
  outputPath: string;
  frameSize?: number;
  frameWidth?: number;
  frameHeight?: number;
}) {
  const fallbackSize =
    options.frameSize ??
    (options.frameWidth && options.frameHeight
      ? Math.max(options.frameWidth, options.frameHeight)
      : 0);
  const frameWidth = options.frameWidth ?? options.frameSize ?? fallbackSize;
  const frameHeight = options.frameHeight ?? options.frameSize ?? fallbackSize;
  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await sharp(options.buffer)
    .resize(frameWidth, frameHeight, {
      fit: "contain",
      kernel: "nearest",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(options.outputPath);
}
