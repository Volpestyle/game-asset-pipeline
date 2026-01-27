export type AspectRatioLabel = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
export type ResolutionLabel = "1K" | "2K" | "4K";

const ASPECT_RATIOS: Array<{ value: AspectRatioLabel; ratio: number }> = [
  { value: "1:1", ratio: 1 },
  { value: "4:3", ratio: 4 / 3 },
  { value: "3:4", ratio: 3 / 4 },
  { value: "16:9", ratio: 16 / 9 },
  { value: "9:16", ratio: 9 / 16 },
];

export function inferAspectRatio(width: number, height: number): AspectRatioLabel | undefined {
  if (!width || !height) return undefined;
  const ratio = width / height;
  let best = ASPECT_RATIOS[0];
  let bestDelta = Math.abs(ratio - best.ratio);
  for (const preset of ASPECT_RATIOS.slice(1)) {
    const delta = Math.abs(ratio - preset.ratio);
    if (delta < bestDelta) {
      best = preset;
      bestDelta = delta;
    }
  }
  return best.value;
}

export function inferResolution(width: number, height: number): ResolutionLabel | undefined {
  const maxDim = Math.max(width, height);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return undefined;
  if (maxDim >= 3500) return "4K";
  if (maxDim >= 1800) return "2K";
  return "1K";
}
