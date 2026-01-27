import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

export async function processImageFile(options: {
  inputPath: string;
  outputPath: string;
  alphaThreshold?: number;
}): Promise<void> {
  const { inputPath, outputPath, alphaThreshold } = options;
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    if (typeof alphaThreshold === "number") {
      data[i + 3] = data[i + 3] <= alphaThreshold ? 0 : 255;
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath);
}
