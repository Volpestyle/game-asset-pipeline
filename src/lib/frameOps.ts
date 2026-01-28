import { promises as fs } from "fs";
import path from "path";
import { buildFrameSequence, formatFrameFilename, type LoopMode } from "@/lib/frameUtils";
import { logger } from "@/lib/logger";
import type { GeneratedFrame } from "@/types";

type BuildGeneratedFramesOptions = {
  animationId: string;
  rawFramesDir: string;
  outputDir: string;
  baseSequence: string[];
  loopMode: LoopMode;
  source: string;
};

async function resetDirectory(dirPath: string, animationId: string) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Frames: failed to prepare output directory", {
      animationId,
      dirPath,
      error: message,
    });
    throw new Error("Failed to prepare frames directory.");
  }
}

export async function buildGeneratedFramesFromSequence(
  options: BuildGeneratedFramesOptions
): Promise<GeneratedFrame[]> {
  const sequence = buildFrameSequence(options.baseSequence, options.loopMode);
  logger.info("Frames: building sequence", {
    animationId: options.animationId,
    baseCount: options.baseSequence.length,
    totalCount: sequence.length,
    loopMode: options.loopMode,
    source: options.source,
  });

  await resetDirectory(options.outputDir, options.animationId);

  const generatedFrames: GeneratedFrame[] = [];
  for (let index = 0; index < sequence.length; index += 1) {
    const inputName = sequence[index];
    const inputPath = path.join(options.rawFramesDir, inputName);
    const outputName = formatFrameFilename(index);
    const outputPath = path.join(options.outputDir, outputName);
    try {
      await fs.copyFile(inputPath, outputPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Frames: failed to copy frame", {
        animationId: options.animationId,
        inputPath,
        outputPath,
        error: message,
      });
      throw new Error("Failed to copy generated frames.");
    }
    generatedFrames.push({
      frameIndex: index,
      url: `/api/storage/animations/${options.animationId}/generated/frames/${outputName}`,
      isKeyframe: false,
      generatedAt: new Date().toISOString(),
      source: options.source,
    });
  }

  return generatedFrames;
}
