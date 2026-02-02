import path from "path";
import { fileToDataUrl } from "@/lib/dataUrl";
import { storagePath } from "@/lib/storage";

export type FalMediaSource = "asset" | "data";

function storageUrlFromPath(filePath: string): string | null {
  const root = storagePath();
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  const normalized = relative.split(path.sep).join("/");
  return `/api/storage/${normalized}`;
}

function joinUrl(base: string, pathPart: string): string {
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  return `${trimmedBase}${trimmedPath}`;
}

export async function resolveFalMediaUrlFromPath(options: {
  mediaPath: string;
  assetBaseUrl?: string;
}): Promise<{ url: string; source: FalMediaSource; storageUrl: string | null }> {
  const assetBaseUrl = options.assetBaseUrl?.trim();
  const storageUrl = storageUrlFromPath(options.mediaPath);
  if (assetBaseUrl && storageUrl) {
    return {
      url: joinUrl(assetBaseUrl, storageUrl),
      source: "asset",
      storageUrl,
    };
  }

  const dataUrl = await fileToDataUrl(options.mediaPath);
  return { url: dataUrl, source: "data", storageUrl };
}
