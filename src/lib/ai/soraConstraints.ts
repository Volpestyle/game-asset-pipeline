export type SoraModel = "sora-2" | "sora-2-pro";

const SORA_SIZE_OPTIONS: Record<SoraModel, string[]> = {
  "sora-2": ["720x1280", "1280x720"],
  "sora-2-pro": ["720x1280", "1280x720", "1024x1792", "1792x1024"],
};

export function getVideoSizeOptions(model?: string): string[] {
  if (model === "sora-2-pro") {
    return SORA_SIZE_OPTIONS["sora-2-pro"];
  }
  return SORA_SIZE_OPTIONS["sora-2"];
}

export function getDefaultVideoSize(model?: string): string {
  const options = getVideoSizeOptions(model);
  return options[0];
}

export function isSizeValidForModel(size: string, model?: string): boolean {
  return getVideoSizeOptions(model).includes(size);
}

function parseSize(size: string): { width: number; height: number } | null {
  const [w, h] = size.split("x").map((value) => Number(value));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { width: w, height: h };
}

export function coerceVideoSizeForModel(
  size: string | undefined,
  model?: string
): string {
  const options = getVideoSizeOptions(model);
  if (!size) return options[0];
  if (isSizeValidForModel(size, model)) return size;
  const parsed = parseSize(size);
  if (!parsed) return options[0];
  const wantsLandscape = parsed.width >= parsed.height;
  const match = options.find((option) => {
    const candidate = parseSize(option);
    if (!candidate) return false;
    return (candidate.width >= candidate.height) === wantsLandscape;
  });
  return match ?? options[0];
}
