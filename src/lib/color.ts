export const DEFAULT_BG_KEY = "#FF00FF";

export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export function parseHexColor(color: string): RgbColor {
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
