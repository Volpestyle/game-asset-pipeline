import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { sortFrameFiles } from "@/lib/frameUtils";
import { logger } from "@/lib/logger";

type RunResult = {
  stdout: string;
  stderr: string;
  durationMs: number;
  pythonBin: string;
};

type RunOptions = {
  inputPath: string;
  outputPath: string;
  timeoutMs?: number;
};

const SCRIPT_PATH = path.join("scripts", "remove_bg.py");
const DEFAULT_TIMEOUT_MS = 180_000;

function resolveScriptPath(): string {
  return path.resolve(process.cwd(), SCRIPT_PATH);
}

function parseTimeout(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;
  return Math.round(parsed);
}

function parseIntEnv(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function pythonCandidates(): string[] {
  const candidates = [
    process.env.BG_REMOVE_PYTHON,
    process.env.PYTHON_BIN,
    "python3",
    "python",
  ].filter((item): item is string => Boolean(item && item.trim()));
  return Array.from(new Set(candidates.map((item) => item.trim())));
}

type ErrnoCandidate = { code?: string };

function isErrnoException(value: ErrnoCandidate | null | undefined): value is NodeJS.ErrnoException {
  if (!value || typeof value !== "object") return false;
  return "code" in value;
}

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

async function ensureScriptExists(scriptPath: string): Promise<void> {
  try {
    await fs.access(scriptPath);
  } catch {
    throw new Error(`Background removal script not found: ${scriptPath}`);
  }
}

async function renameWithFallback(source: string, destination: string): Promise<void> {
  try {
    await fs.rename(source, destination);
  } catch (error) {
    if (isErrnoException(error) && error.code === "EXDEV") {
      logger.warn("Background removal: cross-device rename detected, copying instead", {
        source,
        destination,
      });
      await fs.cp(source, destination, { recursive: true });
      await fs.rm(source, { recursive: true, force: true });
      return;
    }
    throw error;
  }
}

async function replaceDirectorySafely(currentDir: string, newDir: string): Promise<void> {
  const backupDir = path.join(
    path.dirname(currentDir),
    `${path.basename(currentDir)}_backup_${Date.now()}`
  );
  let backupCreated = false;

  try {
    await renameWithFallback(currentDir, backupDir);
    backupCreated = true;
    logger.info("Background removal: backed up existing frames", {
      currentDir,
      backupDir,
    });
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      logger.warn("Background removal: frames directory missing, proceeding without backup", {
        currentDir,
      });
    } else {
      throw error;
    }
  }

  try {
    await renameWithFallback(newDir, currentDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Background removal: failed to replace frames directory", {
      currentDir,
      newDir,
      backupDir: backupCreated ? backupDir : null,
      error: message,
    });
    if (backupCreated) {
      try {
        await renameWithFallback(backupDir, currentDir);
        logger.warn("Background removal: restored frames directory from backup", {
          currentDir,
          backupDir,
        });
      } catch (restoreError) {
        const restoreMessage =
          restoreError instanceof Error ? restoreError.message : String(restoreError);
        logger.error("Background removal: failed to restore frames directory", {
          currentDir,
          backupDir,
          error: restoreMessage,
        });
      }
    }
    throw error;
  }

  if (backupCreated) {
    try {
      await fs.rm(backupDir, { recursive: true, force: true });
    } catch (cleanupError) {
      const cleanupMessage =
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      logger.warn("Background removal: failed to remove backup directory", {
        backupDir,
        error: cleanupMessage,
      });
    }
  }
}

async function runPython(
  pythonBin: string,
  args: string[],
  timeoutMs: number
): Promise<RunResult> {
  return new Promise<RunResult>((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Background removal timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const details = stderr.trim() || stdout.trim() || `exit code ${code}`;
        reject(new Error(`Background removal failed (${pythonBin}): ${details}`));
        return;
      }
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs: Date.now() - startedAt,
        pythonBin,
      });
    });
  });
}

export async function removeBackgroundWithPython(
  options: RunOptions
): Promise<void> {
  const scriptPath = resolveScriptPath();
  await ensureScriptExists(scriptPath);

  const timeoutMs =
    options.timeoutMs ??
    parseTimeout(process.env.BG_REMOVE_TIMEOUT_MS) ??
    DEFAULT_TIMEOUT_MS;

  const model = process.env.BG_REMOVE_MODEL?.trim();
  const postProcess = parseBooleanEnv(process.env.BG_REMOVE_POST_PROCESS);
  const colorTolerance = parseIntEnv(process.env.BG_REMOVE_COLOR_TOLERANCE);
  const args = [
    scriptPath,
    "--input",
    options.inputPath,
    "--output",
    options.outputPath,
  ];
  if (model) {
    args.push("--model", model);
  }
  if (postProcess === false) {
    args.push("--no-post-process");
  }
  if (colorTolerance !== null) {
    args.push("--color-tolerance", String(colorTolerance));
  }

  const candidates = pythonCandidates();
  if (candidates.length === 0) {
    throw new Error("No python executable found. Set BG_REMOVE_PYTHON or PYTHON_BIN.");
  }

  logger.info("Background removal: invoking python", {
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    timeoutMs,
    candidates,
    scriptPath,
    postProcess,
    colorTolerance,
  });

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const result = await runPython(candidate, args, timeoutMs);
      logger.info("Background removal: completed", {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        durationMs: result.durationMs,
        pythonBin: result.pythonBin,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      return;
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        lastError = new Error(`Python not found: ${candidate}`);
        continue;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.error("Background removal: failed", {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        pythonBin: candidate,
        error: lastError.message,
      });
      throw lastError;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("Python executable not found. Set BG_REMOVE_PYTHON or PYTHON_BIN.");
}

export async function removeBackgroundFromFramesDir(options: {
  framesDir: string;
  animationId: string;
}): Promise<number> {
  const { framesDir, animationId } = options;
  const tempDir = path.join(path.dirname(framesDir), `frames_bg_${Date.now()}`);
  logger.info("AI background removal started", {
    animationId,
    framesDir,
  });
  try {
    await removeBackgroundWithPython({
      inputPath: framesDir,
      outputPath: tempDir,
    });
    const cleanedFiles = sortFrameFiles(await fs.readdir(tempDir));
    if (cleanedFiles.length === 0) {
      throw new Error("Background removal produced no frames.");
    }
    await replaceDirectorySafely(framesDir, tempDir);
    logger.info("AI background removal complete", {
      animationId,
      frameCount: cleanedFiles.length,
    });
    return cleanedFiles.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("AI background removal failed", {
      animationId,
      framesDir,
      error: message,
    });
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}
