import { promises as fs } from "fs";
import path from "path";
import { GoogleAuth } from "google-auth-library";
import { Storage } from "@google-cloud/storage";
import { getShutdownSignal } from "@/lib/shutdown";
import { logger } from "@/lib/logger";

const VERTEX_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LOCATION = "us-central1";

export type VertexVeoModelId =
  | "veo-3.1-generate-preview"
  | "veo-3.1-fast-generate-preview";

export type VertexVeoConfig = {
  projectId: string;
  location: string;
  bucket?: string;
};

type VertexVideo = {
  gcsUri?: string;
  bytesBase64Encoded?: string;
  mimeType?: string;
  uri?: string;
};

type VertexVideoInstance = {
  prompt: string;
  video?: VertexVideo;
};

type VertexVideoParameters = {
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p";
  durationSeconds?: number;
  negativePrompt?: string;
  sampleCount?: number;
};

type VertexVideoRequest = {
  instances: VertexVideoInstance[];
  parameters?: VertexVideoParameters;
};

type VertexGeneratedVideo = {
  video?: VertexVideo;
};

type VertexOperationResponse = {
  generatedVideos?: VertexGeneratedVideo[];
};

type VertexOperationError = {
  message?: string;
  code?: number;
  status?: string;
};

type VertexOperation = {
  name?: string;
  done?: boolean;
  response?: VertexOperationResponse;
  error?: VertexOperationError;
};

const auth = new GoogleAuth({ scopes: [VERTEX_SCOPE] });
const storage = new Storage();

function resolveProjectId(): string {
  return (
    process.env.VERTEX_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    ""
  );
}

function resolveLocation(): string {
  return (
    process.env.VERTEX_LOCATION?.trim() ||
    process.env.GOOGLE_CLOUD_LOCATION?.trim() ||
    DEFAULT_LOCATION
  );
}

export function resolveVertexVeoConfig(): VertexVeoConfig {
  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error("Missing VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT for Vertex AI.");
  }
  const location = resolveLocation();
  let bucket = process.env.VEO_CONTINUATION_BUCKET?.trim() || undefined;
  if (bucket && bucket.startsWith("gs://")) {
    bucket = bucket.slice(5);
  }
  return { projectId, location, bucket };
}

export function getVertexVeoAvailability(): {
  available: boolean;
  reason?: string;
  config?: VertexVeoConfig;
} {
  try {
    const config = resolveVertexVeoConfig();
    return { available: true, config };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vertex config missing.";
    return { available: false, reason: message };
  }
}

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token) {
    throw new Error("Unable to acquire Google access token.");
  }
  return token;
}

async function vertexRequest<T>(url: string, body: object): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: getShutdownSignal(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = "Vertex request failed.";
    if (text) {
      try {
        const parsed = JSON.parse(text);
        const apiMessage = parsed?.error?.message;
        message = typeof apiMessage === "string" ? apiMessage : text;
      } catch {
        message = text;
      }
    }
    logger.error("Vertex error response", {
      url,
      status: response.status,
      message,
    });
    throw new Error(message);
  }

  const json: T = await response.json();
  return json;
}

function buildModelUrl(config: VertexVeoConfig, model: VertexVeoModelId): string {
  return `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${model}`;
}

async function uploadVideoToGcs(
  filePath: string,
  config: VertexVeoConfig,
  prefix: string
): Promise<string> {
  if (!config.bucket) {
    throw new Error("Missing VEO_CONTINUATION_BUCKET for GCS upload.");
  }
  const baseName = path.basename(filePath);
  const destination = `${prefix}/${Date.now()}_${baseName}`;
  await storage.bucket(config.bucket).upload(filePath, {
    destination,
    contentType: "video/mp4",
    resumable: false,
  });
  return `gs://${config.bucket}/${destination}`;
}

async function buildVideoInput(
  filePath: string,
  config: VertexVeoConfig,
  gcsPrefix: string
): Promise<{ video: VertexVideo; source: "gcs" | "inline" } > {
  if (config.bucket) {
    const gcsUri = await uploadVideoToGcs(filePath, config, gcsPrefix);
    return { video: { gcsUri }, source: "gcs" };
  }
  const buffer = await fs.readFile(filePath);
  return {
    video: {
      bytesBase64Encoded: buffer.toString("base64"),
      mimeType: "video/mp4",
    },
    source: "inline",
  };
}

function parseGcsUri(gcsUri: string): { bucket: string; object: string } | null {
  if (!gcsUri.startsWith("gs://")) return null;
  const trimmed = gcsUri.replace("gs://", "");
  const [bucket, ...rest] = trimmed.split("/");
  if (!bucket || rest.length === 0) return null;
  return { bucket, object: rest.join("/") };
}

async function downloadFromGcs(gcsUri: string): Promise<Buffer> {
  const parsed = parseGcsUri(gcsUri);
  if (!parsed) {
    throw new Error("Invalid GCS URI for generated video.");
  }
  const file = storage.bucket(parsed.bucket).file(parsed.object);
  const [data] = await file.download();
  return data;
}

async function downloadFromUri(uri: string): Promise<Buffer> {
  const response = await fetch(uri, { signal: getShutdownSignal() });
  if (!response.ok) {
    throw new Error("Failed to download generated video from Vertex.");
  }
  return Buffer.from(await response.arrayBuffer());
}

async function extractVideoBuffer(
  operation: VertexOperation
): Promise<Buffer> {
  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) {
    throw new Error("Vertex response missing generated video.");
  }
  if (video.bytesBase64Encoded) {
    return Buffer.from(video.bytesBase64Encoded, "base64");
  }
  if (video.gcsUri) {
    return downloadFromGcs(video.gcsUri);
  }
  if (video.uri) {
    return downloadFromUri(video.uri);
  }
  throw new Error("Vertex response did not include downloadable video output.");
}

async function waitForOperation(
  modelUrl: string,
  operationName: string,
  timeoutMs = 10 * 60 * 1000,
  intervalMs = 4000
): Promise<VertexOperation> {
  const start = Date.now();
  while (true) {
    const operation = await vertexRequest<VertexOperation>(
      `${modelUrl}:fetchPredictOperation`,
      { operationName }
    );
    if (operation.done) {
      if (operation.error) {
        throw new Error(operation.error.message || "Vertex operation failed.");
      }
      return operation;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Vertex video generation timed out.");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function generateVertexVeoContinuation(options: {
  model: VertexVeoModelId;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  resolution: "720p" | "1080p";
  negativePrompt?: string;
  durationSeconds?: number;
  inputVideoPath: string;
  gcsPrefix: string;
  config?: VertexVeoConfig;
}): Promise<Buffer> {
  const config = options.config ?? resolveVertexVeoConfig();
  const modelUrl = buildModelUrl(config, options.model);
  const { video, source } = await buildVideoInput(
    options.inputVideoPath,
    config,
    options.gcsPrefix
  );

  const parameters: VertexVideoParameters = {
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
    sampleCount: 1,
  };
  if (options.durationSeconds && Number.isFinite(options.durationSeconds)) {
    parameters.durationSeconds = Math.round(options.durationSeconds);
  }
  if (options.negativePrompt) {
    parameters.negativePrompt = options.negativePrompt;
  }

  const payload: VertexVideoRequest = {
    instances: [
      {
        prompt: options.prompt,
        video,
      },
    ],
    parameters,
  };

  logger.info("Vertex Veo continuation requested", {
    model: options.model,
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
    durationSeconds: parameters.durationSeconds,
    inputSource: source,
  });

  const operation = await vertexRequest<VertexOperation>(
    `${modelUrl}:predictLongRunning`,
    payload
  );
  if (!operation.name) {
    throw new Error("Vertex did not return an operation name.");
  }

  const completed = await waitForOperation(modelUrl, operation.name);
  return extractVideoBuffer(completed);
}
