import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..", ".."); // apps/api/src -> repo root

dotenv.config({ path: path.join(repoRoot, ".env") });

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().default(4000),
  API_BASE_URL: z.string().default("http://localhost:4000"),
  DATA_DIR: z.string().default("./data"),
  REDIS_URL: z.string().default("redis://localhost:6379")
});

export type Env = z.infer<typeof EnvSchema>;

export function env(): Env {
  return EnvSchema.parse(process.env);
}

export function getRepoRoot(): string {
  return repoRoot;
}
