import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..", ".."); // apps/worker/src -> repo root

dotenv.config({ path: path.join(repoRoot, ".env") });

const EnvSchema = z.object({
  REDIS_URL: z.string().default("redis://localhost:6379"),
  API_BASE_URL: z.string().default("http://localhost:4000"),
  DATA_DIR: z.string().default("./data"),
  MODEL_MANIFEST_PATH: z.string().default("./config/model-manifest.json"),
  PIPELINE_PROVIDER: z.enum(["fal", "replicate", "mock"]).default("mock")
});

export type Env = z.infer<typeof EnvSchema>;

export function env(): Env {
  return EnvSchema.parse(process.env);
}

export function getRepoRoot(): string {
  return repoRoot;
}
