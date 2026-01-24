import fs from "node:fs/promises";
import path from "node:path";

export type LocalStorage = {
  rootDir: string;
  ensureJobDir: (jobId: string) => Promise<string>;
  putBuffer: (jobId: string, relPath: string, buf: Buffer) => Promise<string>;
  putFile: (jobId: string, relPath: string, sourcePath: string) => Promise<string>;
  readFile: (absPath: string) => Promise<Buffer>;
  toFileUrl: (absPath: string, baseUrl: string) => string;
};

export function createLocalStorage(dataDir: string): LocalStorage {
  const rootDir = path.isAbsolute(dataDir) ? dataDir : path.join(process.cwd(), dataDir);

  async function ensureJobDir(jobId: string) {
    const dir = path.join(rootDir, "jobs", jobId);
    await fs.mkdir(dir, { recursive: true });
    await fs.mkdir(path.join(dir, "uploads"), { recursive: true });
    await fs.mkdir(path.join(dir, "artifacts"), { recursive: true });
    await fs.mkdir(path.join(dir, "previews"), { recursive: true });
    return dir;
  }

  async function putBuffer(jobId: string, relPath: string, buf: Buffer) {
    const dir = await ensureJobDir(jobId);
    const abs = path.join(dir, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);
    return abs;
  }

  async function putFile(jobId: string, relPath: string, sourcePath: string) {
    const dir = await ensureJobDir(jobId);
    const abs = path.join(dir, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.copyFile(sourcePath, abs);
    return abs;
  }

  async function readFile(absPath: string) {
    return fs.readFile(absPath);
  }

  function toFileUrl(absPath: string, baseUrl: string) {
    // Expose /files?path=<relative-from-data-dir>
    const rel = path.relative(rootDir, absPath).split(path.sep).join("/");
    return `${baseUrl.replace(/\/$/, "")}/files/${encodeURIComponent(rel)}`;
  }

  return { rootDir, ensureJobDir, putBuffer, putFile, readFile, toFileUrl };
}
