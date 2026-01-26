import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import sharp from "sharp";
import { composeSpritesheet } from "@/lib/spritesheet";
import { createAnimationVersion } from "@/lib/animationVersions";
import {
  ensureDir,
  fileExists,
  readJson,
  storagePath,
  writeJson,
} from "@/lib/storage";
import {
  coerceVideoSizeForModel,
  getDefaultVideoSize,
} from "@/lib/ai/soraConstraints";

export const runtime = "nodejs";

const DEFAULT_BG_KEY = "#FF00FF";
const ALLOWED_FPS = [6, 8, 12];

function parseSize(size: string) {
  const [w, h] = size.split("x").map((value) => Number(value));
  const width = Number.isFinite(w) ? w : 0;
  const height = Number.isFinite(h) ? h : 0;
  return { width, height };
}

async function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
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

async function extractVideoFrames(options: {
  videoPath: string;
  outputDir: string;
  fps: number;
  frameWidth: number;
  frameHeight: number;
  roi?: { x: number; y: number; w: number; h: number };
  padColor?: string;
}) {
  await fs.rm(options.outputDir, { recursive: true, force: true });
  await fs.mkdir(options.outputDir, { recursive: true });
  const filters: string[] = [];
  if (options.roi && options.roi.w > 0 && options.roi.h > 0) {
    filters.push(
      `crop=${options.roi.w}:${options.roi.h}:${options.roi.x}:${options.roi.y}`
    );
  }
  const rawPadColor = (options.padColor ?? DEFAULT_BG_KEY).replace("#", "").trim();
  const padColor = `0x${rawPadColor.length === 6 ? rawPadColor : "FF00FF"}`;
  filters.push(
    `scale=${options.frameWidth}:${options.frameHeight}:flags=neighbor:force_original_aspect_ratio=decrease`
  );
  filters.push(
    `pad=${options.frameWidth}:${options.frameHeight}:(ow-iw)/2:(oh-ih)/2:color=${padColor}`
  );
  filters.push("setsar=1");
  filters.push(`fps=${options.fps}`);
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    options.videoPath,
    "-vf",
    filters.join(","),
    "-start_number",
    "0",
    path.join(options.outputDir, "frame_%03d.png"),
  ];
  await runFfmpeg(args);
}

async function keyOutMagenta(filePath: string, color = DEFAULT_BG_KEY) {
  const cleaned = color.replace("#", "").trim();
  const target = cleaned.length === 6 ? cleaned : "FF00FF";
  const rTarget = Number.parseInt(target.slice(0, 2), 16);
  const gTarget = Number.parseInt(target.slice(2, 4), 16);
  const bTarget = Number.parseInt(target.slice(4, 6), 16);
  const tolerance = 12;

  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const within =
      Math.abs(r - rTarget) <= tolerance &&
      Math.abs(g - gTarget) <= tolerance &&
      Math.abs(b - bTarget) <= tolerance;
    if (within) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(filePath);
}

function sortFrameFiles(files: string[]) {
  return files
    .filter((file) => file.endsWith(".png"))
    .sort((a, b) => {
      const matchA = a.match(/frame_(\d+)/);
      const matchB = b.match(/frame_(\d+)/);
      const indexA = matchA ? Number(matchA[1]) : 0;
      const indexB = matchB ? Number(matchB[1]) : 0;
      return indexA - indexB;
    });
}

function buildLayout(options: {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  frameCount: number;
}) {
  const columns = Math.max(1, options.columns);
  const rows = Math.max(1, Math.ceil(options.frameCount / columns));
  return {
    frameSize:
      options.frameWidth === options.frameHeight ? options.frameWidth : undefined,
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight,
    columns,
    rows,
    width: columns * options.frameWidth,
    height: rows * options.frameHeight,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: "Missing form data." }, { status: 400 });
  }

  const skipRoi = formData.get("skipRoi") === "true";
  const file = formData.get("video");
  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return Response.json({ error: "Missing video file." }, { status: 400 });
  }

  const videoFile = file as File;
  const ext = path.extname(videoFile.name || "").toLowerCase();
  const mime = String(videoFile.type || "");
  if (ext !== ".mp4" && mime !== "video/mp4") {
    return Response.json({ error: "Only MP4 uploads are supported." }, { status: 400 });
  }

  const buffer = Buffer.from(await videoFile.arrayBuffer());
  if (!buffer.length) {
    return Response.json({ error: "Uploaded video is empty." }, { status: 400 });
  }

  const animation = await readJson<Record<string, unknown>>(animationPath);
  const characterId = String(animation.characterId ?? "");

  let frameWidth = Number(animation.frameWidth ?? animation.spriteSize ?? 0);
  let frameHeight = Number(animation.frameHeight ?? animation.spriteSize ?? 0);

  let referenceImageId = "";
  if (characterId) {
    const characterPath = storagePath("characters", characterId, "character.json");
    if (await fileExists(characterPath)) {
      const character = await readJson<Record<string, unknown>>(characterPath);
      const referenceImages =
        (character.referenceImages as Array<Record<string, unknown>>) ?? [];
      const preferredRefId = String(animation.referenceImageId ?? "").trim();
      const selected = preferredRefId
        ? referenceImages.find((image) => String(image.id) === preferredRefId)
        : undefined;
      const primary =
        selected ??
        referenceImages.find((image) => Boolean(image.isPrimary)) ??
        referenceImages[0];
      referenceImageId = String(primary?.id ?? "");

      if (!frameWidth || !frameHeight) {
        frameWidth = Number(character.baseWidth ?? 0);
        frameHeight = Number(character.baseHeight ?? 0);
      }
    }
  }

  if (!frameWidth || !frameHeight) {
    frameWidth = 253;
    frameHeight = 504;
  }

  const requestedFps = Number(animation.extractFps ?? animation.fps ?? 6);
  const extractFps = ALLOWED_FPS.includes(requestedFps) ? requestedFps : 6;
  const loopModeInput = String(animation.loopMode ?? "loop");
  const loopMode = loopModeInput === "pingpong" ? "pingpong" : "loop";
  const sheetColumns = Math.max(1, Number(animation.sheetColumns ?? 6));

  const model = String(animation.generationModel ?? "sora-2");
  const requestedSize = String(
    animation.generationSize ?? getDefaultVideoSize(model)
  );
  const generationSize = coerceVideoSizeForModel(requestedSize, model);
  const generationNote =
    requestedSize !== generationSize
      ? `Adjusted video size to ${generationSize} for ${model}. Imported video.`
      : "Imported video.";

  let bgKeyColor = DEFAULT_BG_KEY;
  let roi: { x: number; y: number; w: number; h: number } | undefined;

  if (characterId && referenceImageId && !skipRoi) {
    const { width, height } = parseSize(generationSize);
    if (width && height) {
      const specPath = storagePath(
        "characters",
        characterId,
        "working",
        `reference_${referenceImageId}_${width}x${height}.json`
      );
      if (await fileExists(specPath)) {
        const spec = await readJson<Record<string, unknown>>(specPath);
        if (typeof spec.bgKeyColor === "string" && spec.bgKeyColor.trim()) {
          bgKeyColor = spec.bgKeyColor.trim();
        }
        if (spec.roi && typeof spec.roi === "object") {
          const roiCandidate = spec.roi as Record<string, unknown>;
          const x = Number(roiCandidate.x);
          const y = Number(roiCandidate.y);
          const w = Number(roiCandidate.w);
          const h = Number(roiCandidate.h);
          if (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(w) &&
            Number.isFinite(h) &&
            w > 0 &&
            h > 0 &&
            x >= 0 &&
            y >= 0
          ) {
            roi = { x, y, w, h };
          }
        }
      }
    }
  }

  const generatedDir = storagePath("animations", id, "generated");
  await ensureDir(generatedDir);
  const videoFilename = `video_import_${Date.now()}.mp4`;
  const videoPath = path.join(generatedDir, videoFilename);
  await fs.writeFile(videoPath, buffer);

  const rawFramesDir = path.join(generatedDir, "frames_raw");
  const framesDir = path.join(generatedDir, "frames");
  await extractVideoFrames({
    videoPath,
    outputDir: rawFramesDir,
    fps: extractFps,
    frameWidth,
    frameHeight,
    roi,
    padColor: bgKeyColor,
  });

  await fs.rm(framesDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });

  const rawFiles = sortFrameFiles(await fs.readdir(rawFramesDir));
  if (rawFiles.length === 0) {
    return Response.json(
      { error: "No frames extracted from the uploaded video." },
      { status: 400 }
    );
  }

  const baseSequence = rawFiles;
  const sequence =
    loopMode === "pingpong"
      ? baseSequence.concat(baseSequence.slice(1, -1).reverse())
      : baseSequence;

  const generatedFrames = [];
  for (let index = 0; index < sequence.length; index += 1) {
    const inputName = sequence[index];
    const inputPath = path.join(rawFramesDir, inputName);
    const outputName = `frame_${String(index).padStart(3, "0")}.png`;
    const outputPath = path.join(framesDir, outputName);
    await fs.copyFile(inputPath, outputPath);
    await keyOutMagenta(outputPath, bgKeyColor);
    generatedFrames.push({
      frameIndex: index,
      url: `/api/storage/animations/${id}/generated/frames/${outputName}`,
      isKeyframe: false,
      generatedAt: new Date().toISOString(),
      source: "import",
    });
  }

  const layout = buildLayout({
    frameWidth,
    frameHeight,
    columns: sheetColumns,
    frameCount: generatedFrames.length,
  });

  const spritesheetName = `spritesheet_${Date.now()}_import.png`;
  const spritesheetPath = path.join(generatedDir, spritesheetName);
  await composeSpritesheet({ framesDir, outputPath: spritesheetPath, layout });

  const updated = {
    ...animation,
    status: "complete",
    generationNote,
    generationSize,
    fps: extractFps,
    extractFps,
    frameWidth,
    frameHeight,
    loopMode,
    sheetColumns,
    actualFrameCount: generatedFrames.length,
    generatedFrames,
    generatedSpritesheet: `/api/storage/animations/${id}/generated/${spritesheetName}`,
    spritesheetLayout: layout,
    sourceVideoUrl: `/api/storage/animations/${id}/generated/${videoFilename}`,
    sourceProviderSpritesheetUrl: undefined,
    sourceThumbnailUrl: undefined,
    generationJob: {
      provider: "upload",
      providerJobId: `upload_${Date.now()}`,
      status: "completed",
      progress: 100,
      outputs: {
        videoUrl: `/api/storage/animations/${id}/generated/${videoFilename}`,
      },
    },
    exports: undefined,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(animationPath, updated);
  const { animation: versioned } = await createAnimationVersion(id, {
    name: "Imported video",
    source: "generation",
  });

  return Response.json({ animation: versioned });
}
