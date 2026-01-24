import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function parsePort(value) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function portFromUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const n = parsePort(url.port);
    return n ?? null;
  } catch {
    return null;
  }
}

function collectPorts(env) {
  const ports = new Set();

  const apiPort = parsePort(env.API_PORT) ?? portFromUrl(env.API_BASE_URL);
  const webPort = parsePort(env.WEB_PORT) ?? portFromUrl(env.NEXT_PUBLIC_API_BASE_URL);

  if (apiPort) ports.add(apiPort);
  if (webPort) ports.add(webPort);

  if (ports.size === 0) {
    ports.add(4000);
    ports.add(3000);
  }

  return Array.from(ports);
}

function findListeningPids(port) {
  try {
    const output = execFileSync("lsof", ["-tiTCP:" + String(port), "-sTCP:LISTEN"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((pid) => Number(pid))
      .filter((pid) => Number.isFinite(pid));
  } catch {
    return [];
  }
}

function killPids(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (err) {
      console.error(`Failed to kill PID ${pid}:`, err?.message ?? err);
    }
  }
}

const envPath = path.join(repoRoot, ".env");
const env = parseEnvFile(envPath);
const ports = collectPorts(env);

let killedAny = false;
for (const port of ports) {
  const pids = findListeningPids(port);
  if (pids.length === 0) {
    console.log(`No listener on port ${port}.`);
    continue;
  }
  console.log(`Killing PIDs on port ${port}: ${pids.join(", ")}`);
  killPids(pids);
  killedAny = true;
}

if (!killedAny) {
  console.log("No dev servers were running on configured ports.");
}
