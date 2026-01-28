import { promises as fs } from "fs";
import path from "path";
import {
  createVideoJob,
  pollVideoJob,
  downloadVideoContent,
} from "@/lib/ai/openai";
import { logger } from "@/lib/logger";

export type OpenAIGenerationOptions = {
  animationId: string;
  prompt: string;
  model: string;
  seconds: number;
  size: string;
  inputReferencePath?: string | null;
  generatedDir: string;
  outputFilename?: string;
  onUpdate?: (update: {
    status: string;
    progress?: number;
    expiresAt?: string;
    providerJobId?: string;
  }) => Promise<void>;
};

export type OpenAIGenerationResult = {
  videoPath: string;
  videoUrl: string;
  spritesheetUrl?: string;
  thumbnailUrl?: string;
  expiresAt?: string;
};

export async function runOpenAIGeneration(
  options: OpenAIGenerationOptions
): Promise<OpenAIGenerationResult> {
  const {
    animationId,
    prompt,
    model,
    seconds,
    size,
    inputReferencePath,
    generatedDir,
    onUpdate,
    outputFilename,
  } = options;

  const job = await createVideoJob({
    prompt,
    model,
    seconds,
    size,
    inputReferencePath,
  });

  if (onUpdate) {
    await onUpdate({
      providerJobId: job.id,
      status: job.status,
      progress: typeof job.progress === "number" ? job.progress : 0,
      expiresAt: job.expires_at
        ? new Date(job.expires_at * 1000).toISOString()
        : undefined,
    });
  }

  const finalJob = await pollVideoJob({
    videoId: job.id,
    onUpdate: async (update) => {
      if (onUpdate) {
        const patch: {
          status: string;
          progress?: number;
          expiresAt?: string;
        } = {
          status: update.status,
        };
        if (typeof update.progress === "number") {
          patch.progress = update.progress;
        }
        if (update.expires_at) {
          patch.expiresAt = new Date(update.expires_at * 1000).toISOString();
        }
        await onUpdate(patch);
      }
    },
  });

  const expiresAt = finalJob.expires_at
    ? new Date(finalJob.expires_at * 1000).toISOString()
    : undefined;

  const videoBuffer = await downloadVideoContent({ videoId: job.id });
  const finalFilename = outputFilename ?? `video_${Date.now()}.mp4`;
  const videoPath = path.join(generatedDir, finalFilename);
  await fs.writeFile(videoPath, videoBuffer);
  const videoUrl = `/api/storage/animations/${animationId}/generated/${finalFilename}`;

  let spritesheetUrl: string | undefined;
  try {
    const spriteBuffer = await downloadVideoContent({
      videoId: job.id,
      variant: "spritesheet",
    });
    const spriteName = `provider_spritesheet_${Date.now()}.png`;
    const spritePath = path.join(generatedDir, spriteName);
    await fs.writeFile(spritePath, spriteBuffer);
    spritesheetUrl = `/api/storage/animations/${animationId}/generated/${spriteName}`;
  } catch (error) {
    logger.warn("Failed to download OpenAI spritesheet", {
      animationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let thumbnailUrl: string | undefined;
  try {
    const thumbBuffer = await downloadVideoContent({
      videoId: job.id,
      variant: "thumbnail",
    });
    const thumbName = `thumbnail_${Date.now()}.png`;
    const thumbPath = path.join(generatedDir, thumbName);
    await fs.writeFile(thumbPath, thumbBuffer);
    thumbnailUrl = `/api/storage/animations/${animationId}/generated/${thumbName}`;
  } catch (error) {
    logger.warn("Failed to download OpenAI thumbnail", {
      animationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    videoPath,
    videoUrl,
    spritesheetUrl,
    thumbnailUrl,
    expiresAt,
  };
}
