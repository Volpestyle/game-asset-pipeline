import sharp from "sharp";
import type { AnchorPoint, ProjectSettings } from "@/types";

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  canvasWidth: 256,
  canvasHeight: 512,
  defaultAnchor: "bottom-center",
  defaultScale: 0.8,
};

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Detect the bounding box of non-transparent pixels in an image
 */
export async function detectContentBounds(
  inputPath: string
): Promise<ContentBounds> {
  const image = sharp(inputPath);
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  // Scan for non-transparent pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaIndex = (y * width + x) * 4 + 3;
      if (data[alphaIndex] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Handle fully transparent images
  if (minX > maxX || minY > maxY) {
    return {
      x: 0,
      y: 0,
      width: width,
      height: height,
      imageWidth: width,
      imageHeight: height,
    };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    imageWidth: width,
    imageHeight: height,
  };
}

/**
 * Calculate position based on anchor point
 */
export function calculateAnchorPosition(options: {
  contentWidth: number;
  contentHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  anchor: AnchorPoint;
}): { x: number; y: number } {
  const { contentWidth, contentHeight, canvasWidth, canvasHeight, anchor } =
    options;

  switch (anchor) {
    case "bottom-center":
      return {
        x: Math.round((canvasWidth - contentWidth) / 2),
        y: canvasHeight - contentHeight,
      };
    case "center":
      return {
        x: Math.round((canvasWidth - contentWidth) / 2),
        y: Math.round((canvasHeight - contentHeight) / 2),
      };
    case "bottom-left":
      return {
        x: 0,
        y: canvasHeight - contentHeight,
      };
    case "bottom-right":
      return {
        x: canvasWidth - contentWidth,
        y: canvasHeight - contentHeight,
      };
    case "top-center":
      return {
        x: Math.round((canvasWidth - contentWidth) / 2),
        y: 0,
      };
    default:
      // Default to bottom-center
      return {
        x: Math.round((canvasWidth - contentWidth) / 2),
        y: canvasHeight - contentHeight,
      };
  }
}

export interface NormalizeFrameOptions {
  inputPath: string;
  outputPath: string;
  canvasWidth: number;
  canvasHeight: number;
  anchor: AnchorPoint;
  scale: number;
  /** Use nearest-neighbor for pixel art (default: true) */
  pixelArt?: boolean;
  /** Pre-computed bounds to use instead of detecting */
  bounds?: ContentBounds;
}

/**
 * Normalize a single frame to the standard canvas size
 */
export async function normalizeFrame(
  options: NormalizeFrameOptions
): Promise<ContentBounds> {
  const {
    inputPath,
    outputPath,
    canvasWidth,
    canvasHeight,
    anchor,
    scale,
    pixelArt = true,
  } = options;

  // Detect content bounds (or use provided)
  const bounds = options.bounds ?? (await detectContentBounds(inputPath));

  // Calculate target size based on scale
  const targetHeight = Math.round(canvasHeight * scale);
  const aspectRatio = bounds.width / bounds.height;
  const targetWidth = Math.round(targetHeight * aspectRatio);

  // Ensure content fits within canvas
  let finalWidth = targetWidth;
  let finalHeight = targetHeight;

  if (finalWidth > canvasWidth) {
    finalWidth = canvasWidth;
    finalHeight = Math.round(finalWidth / aspectRatio);
  }

  // Extract content from original image
  const content = await sharp(inputPath)
    .extract({
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
    })
    .resize(finalWidth, finalHeight, {
      kernel: pixelArt ? "nearest" : "lanczos3",
      fit: "fill",
    })
    .toBuffer();

  // Calculate position based on anchor
  const position = calculateAnchorPosition({
    contentWidth: finalWidth,
    contentHeight: finalHeight,
    canvasWidth,
    canvasHeight,
    anchor,
  });

  // Create transparent canvas and composite content
  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: content,
        left: position.x,
        top: position.y,
      },
    ])
    .png()
    .toFile(outputPath);

  return bounds;
}

export interface NormalizeBatchOptions {
  inputPaths: string[];
  outputPaths: string[];
  canvasWidth: number;
  canvasHeight: number;
  anchor: AnchorPoint;
  scale: number;
  pixelArt?: boolean;
  /** Use consistent bounds across all frames (largest bounding box) */
  consistentBounds?: boolean;
}

export interface NormalizeBatchResult {
  bounds: ContentBounds[];
  unifiedBounds?: ContentBounds;
}

/**
 * Normalize multiple frames with optional consistent bounds
 */
export async function normalizeFrameBatch(
  options: NormalizeBatchOptions
): Promise<NormalizeBatchResult> {
  const {
    inputPaths,
    outputPaths,
    canvasWidth,
    canvasHeight,
    anchor,
    scale,
    pixelArt = true,
    consistentBounds = true,
  } = options;

  if (inputPaths.length !== outputPaths.length) {
    throw new Error("Input and output path arrays must have the same length");
  }

  // First pass: detect all bounds
  const allBounds: ContentBounds[] = [];
  for (const inputPath of inputPaths) {
    const bounds = await detectContentBounds(inputPath);
    allBounds.push(bounds);
  }

  // Calculate unified bounds if requested
  let unifiedBounds: ContentBounds | undefined;
  if (consistentBounds && allBounds.length > 0) {
    // Find the bounding box that encompasses all content
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;

    for (const bounds of allBounds) {
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    unifiedBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      imageWidth: allBounds[0].imageWidth,
      imageHeight: allBounds[0].imageHeight,
    };
  }

  // Second pass: normalize all frames
  const boundsToUse = unifiedBounds ?? undefined;
  for (let i = 0; i < inputPaths.length; i++) {
    await normalizeFrame({
      inputPath: inputPaths[i],
      outputPath: outputPaths[i],
      canvasWidth,
      canvasHeight,
      anchor,
      scale,
      pixelArt,
      bounds: boundsToUse,
    });
  }

  return {
    bounds: allBounds,
    unifiedBounds,
  };
}

/**
 * Get effective normalization settings by merging project and character settings
 */
export function getEffectiveSettings(
  projectSettings: ProjectSettings,
  characterSettings?: { anchor?: AnchorPoint; scale?: number }
): {
  canvasWidth: number;
  canvasHeight: number;
  anchor: AnchorPoint;
  scale: number;
} {
  return {
    canvasWidth: projectSettings.canvasWidth,
    canvasHeight: projectSettings.canvasHeight,
    anchor: characterSettings?.anchor ?? projectSettings.defaultAnchor,
    scale: characterSettings?.scale ?? projectSettings.defaultScale,
  };
}
