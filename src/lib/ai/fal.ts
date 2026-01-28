import { logger } from "@/lib/logger";
import { getShutdownSignal } from "@/lib/shutdown";

const FAL_API_BASE = "https://fal.run";

export type FalFile = {
  url: string;
  file_name?: string;
  file_size?: number;
  content_type?: string;
};

export type PikaframesTransitionInput = {
  duration: number;
  prompt?: string;
};

export type PikaframesRequest = {
  image_urls: string[];
  transitions?: PikaframesTransitionInput[];
  prompt?: string;
  negative_prompt?: string;
  seed?: number;
  resolution?: "720p" | "1080p";
};

export type PikaframesResponse = {
  video: FalFile;
};

export type WanResolution = "480p" | "580p" | "720p";
export type WanAspectRatio = "auto" | "16:9" | "9:16" | "1:1";

export type WanRequest = {
  image_url: string;
  end_image_url?: string;
  prompt: string;
  num_frames?: number;
  frames_per_second?: number;
  negative_prompt?: string;
  seed?: number;
  resolution?: WanResolution;
  aspect_ratio?: WanAspectRatio;
  num_inference_steps?: number;
  enable_safety_checker?: boolean;
  enable_output_safety_checker?: boolean;
  enable_prompt_expansion?: boolean;
  acceleration?: "none" | "regular";
  guidance_scale?: number;
  guidance_scale_2?: number;
  shift?: number;
  interpolator_model?: "none" | "film" | "rife";
  num_interpolated_frames?: number;
  adjust_fps_for_interpolation?: boolean;
  video_quality?: "low" | "medium" | "high" | "maximum";
  video_write_mode?: "fast" | "balanced" | "small";
};

export type WanResponse = {
  video: FalFile;
};

type FalErrorPayload = {
  detail?: string;
  error?: string;
  message?: string;
};

function getFalKey(): string {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new Error("Missing FAL_KEY. Add it to .env.local and restart the dev server.");
  }
  return key;
}

async function postJson<T>(path: string, body: object): Promise<T> {
  const key = getFalKey();
  const url = path.startsWith("http")
    ? path
    : `${FAL_API_BASE}/${path.replace(/^\//, "")}`;

  logger.info("Fal request", {
    path: url,
    method: "POST",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: getShutdownSignal(),
  });

  if (!response.ok) {
    let payload: FalErrorPayload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    const message =
      payload.detail || payload.error || payload.message || "Fal request failed.";
    logger.error("Fal error response", {
      path: url,
      status: response.status,
      message,
    });
    throw new Error(message);
  }

  const data: T = await response.json();
  return data;
}

export async function runPikaframes(
  input: PikaframesRequest
): Promise<PikaframesResponse> {
  return postJson<PikaframesResponse>("fal-ai/pika/v2.2/pikaframes", input);
}

export async function runWanVideo(input: WanRequest): Promise<WanResponse> {
  return postJson<WanResponse>(
    "fal-ai/wan/v2.2-a14b/image-to-video",
    input
  );
}
