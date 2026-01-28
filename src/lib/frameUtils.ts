import type { SpritesheetLayout } from "@/lib/spritesheet";

export type LoopMode = "loop" | "pingpong";

export function frameIndexFromName(filename: string): number {
  const match = filename.match(/frame_(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function formatFrameFilename(index: number, extension = ".png"): string {
  const suffix = extension.startsWith(".") ? extension : `.${extension}`;
  return `frame_${String(index).padStart(3, "0")}${suffix}`;
}

export function buildFrameSequence<T>(frames: T[], loopMode: LoopMode): T[] {
  if (loopMode !== "pingpong") return frames;
  if (frames.length <= 1) return frames;
  return frames.concat(frames.slice(1, -1).reverse());
}

export function sortFrameFiles(files: string[]): string[] {
  return files
    .filter((file) => file.endsWith(".png"))
    .sort((a, b) => {
      return frameIndexFromName(a) - frameIndexFromName(b);
    });
}

export function buildSpritesheetLayout(options: {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  frameCount: number;
}): SpritesheetLayout {
  const columns = Math.max(1, options.columns);
  const rows = Math.max(1, Math.ceil(options.frameCount / columns));
  return {
    frameSize:
      options.frameWidth === options.frameHeight ? options.frameWidth : undefined,
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    columns,
    rows,
    width: columns * options.frameWidth,
    height: rows * options.frameHeight,
  };
}
