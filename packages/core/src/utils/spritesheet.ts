import sharp from "sharp";

export async function packGrid(
  frames: Array<{ buffer: Buffer; width: number; height: number }>,
  cols: number
): Promise<{ sheet: Buffer; rows: number; cols: number; width: number; height: number }> {
  if (frames.length === 0) throw new Error("No frames to pack");

  const { width: fw, height: fh } = frames[0];
  const rows = Math.ceil(frames.length / cols);
  const sheetW = fw * cols;
  const sheetH = fh * rows;

  const base = sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  const composites = frames.map((f, i) => {
    const x = (i % cols) * fw;
    const y = Math.floor(i / cols) * fh;
    return { input: f.buffer, left: x, top: y };
  });

  const out = await base.composite(composites).png().toBuffer();
  return { sheet: out, rows, cols, width: sheetW, height: sheetH };
}
