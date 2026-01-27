import { spawn } from "child_process";

export async function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    process.on("error", (err) => {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        reject(new Error("ffmpeg not found. Install ffmpeg to extract frames."));
      } else {
        reject(err);
      }
    });
    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `ffmpeg failed with exit code ${code}`));
      }
    });
  });
}
