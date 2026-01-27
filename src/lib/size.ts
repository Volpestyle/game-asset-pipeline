export type Dimensions = {
  width: number;
  height: number;
};

export function parseSize(size: string, fallback: Dimensions = { width: 0, height: 0 }) {
  const [w, h] = size.split("x").map((value) => Number(value));
  return {
    width: Number.isFinite(w) ? w : fallback.width,
    height: Number.isFinite(h) ? h : fallback.height,
  };
}
