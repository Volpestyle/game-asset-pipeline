import type { SpritesheetLayout } from "@/lib/spritesheet";

export function sortFrameFiles(files: string[]): string[] {
  return files
    .filter((file) => file.endsWith(".png"))
    .sort((a, b) => {
      const matchA = a.match(/frame_(\d+)/);
      const matchB = b.match(/frame_(\d+)/);
      const indexA = matchA ? Number(matchA[1]) : 0;
      const indexB = matchB ? Number(matchB[1]) : 0;
      return indexA - indexB;
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
