import path from "node:path";
import { createLocalStorage } from "./storage/local.js";
import { getProviderRegistry } from "./providers/registry.js";

export type Runtime = {
  rootDir: string;
  dataDir: string;
  apiBaseUrl: string;
  storage: ReturnType<typeof createLocalStorage>;
  providers: Awaited<ReturnType<typeof getProviderRegistry>>;
};

let runtime: Runtime | null = null;

export async function getRuntime(): Promise<Runtime> {
  if (runtime) return runtime;

  const rootDir = process.env.REPO_ROOT_DIR ?? process.cwd();
  const dataDir = process.env.DATA_DIR ?? "./data";
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
  const manifestPath = process.env.MODEL_MANIFEST_PATH ?? "./config/model-manifest.json";
  const providerHint = (process.env.PIPELINE_PROVIDER as any) ?? undefined;

  const storage = createLocalStorage(dataDir);
  const providers = await getProviderRegistry({ rootDir, manifestPath, providerHint });

  runtime = { rootDir, dataDir, apiBaseUrl, storage, providers };
  return runtime;
}

export function getRepoRoot(): string {
  return process.env.REPO_ROOT_DIR ?? process.cwd();
}
