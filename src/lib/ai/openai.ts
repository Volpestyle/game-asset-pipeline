import path from "path";
import { promises as fs } from "fs";
import { getShutdownSignal } from "@/lib/shutdown";
import { logger } from "@/lib/logger";

const OPENAI_API_BASE = "https://api.openai.com/v1";

export type OpenAIVideoJob = {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "canceled";
  progress?: number | null;
  error?: string | null;
  expires_at?: number | null;
};

function getApiKey() {
  const token = process.env.OPENAI_API_KEY?.trim();
  if (!token) {
    throw new Error("Missing OPENAI_API_KEY.");
  }
  return token;
}

async function openaiFetch(pathname: string, options: RequestInit = {}) {
  const token = getApiKey();
  const signal = options.signal ?? getShutdownSignal();
  logger.debug("OpenAI request", {
    path: pathname,
    method: options.method ?? "GET",
  });
  const response = await fetch(`${OPENAI_API_BASE}${pathname}`, {
    ...options,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let message = "OpenAI request failed.";
    try {
      const parsed = JSON.parse(errorText);
      message = parsed?.error?.message || parsed?.message || message;
    } catch {
      if (errorText) message = errorText;
    }
    logger.error("OpenAI error response", {
      path: pathname,
      status: response.status,
      message,
    });
    throw new Error(message);
  }

  return response;
}

function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function createVideoJob(options: {
  prompt: string;
  model: string;
  seconds: number;
  size: string;
  inputReferencePath?: string | null;
}) {
  logger.debug("OpenAI video create", {
    model: options.model,
    seconds: options.seconds,
    size: options.size,
    prompt: options.prompt,
    input_reference: options.inputReferencePath
      ? path.basename(options.inputReferencePath)
      : undefined,
  });
  const form = new FormData();
  form.append("model", options.model);
  form.append("prompt", options.prompt);
  form.append("seconds", String(options.seconds));
  form.append("size", options.size);

  if (options.inputReferencePath) {
    const buffer = await fs.readFile(options.inputReferencePath);
    const mime = getMimeType(options.inputReferencePath);
    const filename = path.basename(options.inputReferencePath);
    const blob = new Blob([buffer], { type: mime });
    form.append("input_reference", blob, filename);
  }

  const response = await openaiFetch("/videos", {
    method: "POST",
    body: form,
  });

  const json = (await response.json()) as OpenAIVideoJob;
  logger.info("OpenAI video created", {
    id: json.id,
    status: json.status,
    progress: json.progress ?? undefined,
    expires_at: json.expires_at ?? undefined,
  });
  return json;
}

export async function getVideoJob(videoId: string) {
  const response = await openaiFetch(`/videos/${videoId}`, {
    method: "GET",
  });
  const json = (await response.json()) as OpenAIVideoJob;
  logger.debug("OpenAI video status", json);
  return json;
}

export async function pollVideoJob(options: {
  videoId: string;
  timeoutMs?: number;
  intervalMs?: number;
  onUpdate?: (job: OpenAIVideoJob) => Promise<void> | void;
}) {
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
  const intervalMs = options.intervalMs ?? 4000;
  const start = Date.now();

  while (true) {
    const job = await getVideoJob(options.videoId);
    if (options.onUpdate) {
      await options.onUpdate(job);
    }
    if (job.status === "completed") {
      return job;
    }
    if (job.status === "failed" || job.status === "canceled") {
      throw new Error(job.error || "Video generation failed.");
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Video generation timed out.");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function downloadVideoContent(options: {
  videoId: string;
  variant?: string;
}) {
  const params = options.variant ? `?variant=${options.variant}` : "";
  const response = await openaiFetch(
    `/videos/${options.videoId}/content${params}`,
    { method: "GET" }
  );
  logger.info("OpenAI download content", {
    videoId: options.videoId,
    variant: options.variant ?? "video",
    contentLength: response.headers.get("content-length") ?? undefined,
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}
