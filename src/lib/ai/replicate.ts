import { getShutdownSignal } from "@/lib/shutdown";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const modelVersionCache = new Map<string, string>();

function normalizeEnvValue(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
};

function getAuthToken() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("Missing REPLICATE_API_TOKEN.");
  }
  return token;
}

async function request(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const signal = options.signal ?? getShutdownSignal();
  const response = await fetch(`${REPLICATE_API_BASE}${path}`, {
    ...options,
    signal,
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || data?.error || "Replicate request failed.");
  }

  return response.json();
}

function parseModel(model: string) {
  const cleaned = model.trim();
  const [owner, name] = cleaned.split("/");
  if (!owner || !name) {
    throw new Error(`Invalid model identifier: ${model}`);
  }
  return { owner, name };
}

async function getLatestVersionForModel(model: string) {
  const cached = modelVersionCache.get(model);
  if (cached) {
    return cached;
  }

  const { owner, name } = parseModel(model);
  const versions = await request(`/models/${owner}/${name}/versions`);
  const list = Array.isArray(versions) ? versions : versions?.results;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`No versions found for model ${model}.`);
  }

  const latest = list[0]?.id;
  if (!latest) {
    throw new Error(`Unable to resolve latest version for model ${model}.`);
  }

  modelVersionCache.set(model, latest);
  return latest;
}

export async function createPrediction(body: {
  version?: string;
  model?: string;
  input: Record<string, unknown>;
}): Promise<ReplicatePrediction> {
  const model = normalizeEnvValue(body.model);
  const requestedVersion = normalizeEnvValue(body.version);
  let version = requestedVersion;

  if (!version) {
    if (!model) {
      throw new Error("Replicate prediction requires a model version.");
    }

    try {
      version = await getLatestVersionForModel(model);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("does not expose a list of versions")) {
        const { owner, name } = parseModel(model);
        return request(`/models/${owner}/${name}/predictions`, {
          method: "POST",
          body: JSON.stringify({ input: body.input }),
        });
      }
      throw err;
    }
  }

  return request("/predictions", {
    method: "POST",
    body: JSON.stringify({ version, input: body.input }),
  });
}

export async function getPrediction(id: string): Promise<ReplicatePrediction> {
  return request(`/predictions/${id}`);
}

export async function waitForPrediction(id: string, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  const shutdownSignal = getShutdownSignal();

  while (true) {
    if (shutdownSignal.aborted) {
      throw new Error("Prediction aborted (shutdown signal).");
    }
    const prediction = await getPrediction(id);
    if (prediction.status === "succeeded") {
      return prediction;
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error || "Replicate prediction failed.");
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Replicate prediction timed out.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export async function runReplicateModel(options: {
  version?: string;
  model?: string;
  input: Record<string, unknown>;
}) {
  const prediction = await createPrediction(options);
  return waitForPrediction(prediction.id);
}
