import { promises as fs } from "fs";

export type AsepriteFrame = {
  filename: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  duration: number;
};

export function getPngDimensions(buffer: Buffer) {
  const isPng =
    buffer.length > 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  if (!isPng) {
    throw new Error("Invalid PNG file.");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return { width, height };
}

export function inferFrameSize(
  imageWidth: number,
  imageHeight: number,
  preferred: number
) {
  const candidates = [preferred, 96, 64, 48, 32, 24, 16, 8];
  for (const size of candidates) {
    if (size > 0 && imageWidth % size === 0 && imageHeight % size === 0) {
      return size;
    }
  }
  return preferred;
}

export function buildAsepriteFrames(options: {
  imageWidth: number;
  imageHeight: number;
  frameSize?: number;
  frameWidth?: number;
  frameHeight?: number;
  fps: number;
  frameCount?: number;
}) {
  const frameWidth = options.frameWidth ?? options.frameSize ?? 0;
  const frameHeight = options.frameHeight ?? options.frameSize ?? 0;
  const { imageWidth, imageHeight, fps, frameCount } = options;
  const cols = Math.max(1, Math.floor(imageWidth / Math.max(1, frameWidth)));
  const rows = Math.max(1, Math.floor(imageHeight / Math.max(1, frameHeight)));
  const duration = Math.round(1000 / Math.max(1, fps));
  const frames: AsepriteFrame[] = [];

  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (typeof frameCount === "number" && index >= frameCount) {
        return frames;
      }
      const x = col * frameWidth;
      const y = row * frameHeight;
      frames.push({
        filename: `frame_${String(index).padStart(3, "0")}`,
        frame: { x, y, w: frameWidth, h: frameHeight },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
        sourceSize: { w: frameWidth, h: frameHeight },
        duration,
      });
      index += 1;
    }
  }

  return frames;
}

export function buildAsepriteJson(options: {
  imageName: string;
  imageWidth: number;
  imageHeight: number;
  frameSize?: number;
  frameWidth?: number;
  frameHeight?: number;
  fps: number;
  frameCount?: number;
}) {
  const frames = buildAsepriteFrames(options);

  const meta = {
    app: "Sprite Forge",
    version: "1.0",
    image: options.imageName,
    size: { w: options.imageWidth, h: options.imageHeight },
    scale: "1",
    frameTags: [],
    layers: [],
    slices: [],
  };

  const arrayJson = {
    frames,
    meta,
  };

  const hashFrames: Record<string, Omit<AsepriteFrame, "filename">> = {};
  for (const frame of frames) {
    const { filename, ...rest } = frame;
    hashFrames[filename] = rest;
  }

  const hashJson = {
    frames: hashFrames,
    meta,
  };

  return { arrayJson, hashJson };
}

export async function loadPngDimensions(filePath: string) {
  const buffer = await fs.readFile(filePath);
  return getPngDimensions(buffer);
}
