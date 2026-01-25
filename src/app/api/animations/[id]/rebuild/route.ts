import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { composeSpritesheet } from "@/lib/spritesheet";
import { fileExists, readJson, storagePath, writeJson } from "@/lib/storage";

export const runtime = "nodejs";

const DEFAULT_BG_KEY = "#FF00FF";

function parseSize(size: string) {
  const [w, h] = size.split("x").map((value) => Number(value));
  const width = Number.isFinite(w) ? w : 0;
  const height = Number.isFinite(h) ? h : 0;
  return { width, height };
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const animationPath = storagePath("animations", id, "animation.json");

  if (!(await fileExists(animationPath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const animation = await readJson<Record<string, unknown>>(animationPath);

  const loopModeInput = String(payload?.loopMode ?? animation.loopMode ?? "loop");
  const loopMode = loopModeInput === "pingpong" ? "pingpong" : "loop";
  const sheetColumns = Math.max(1, Number(payload?.sheetColumns ?? animation.sheetColumns ?? 6));

  const rawFramesDir = storagePath("animations", id, "generated", "frames_raw");
  if (!(await fileExists(rawFramesDir))) {
    return Response.json(
      { error: "No raw frames found. Regenerate the animation first." },
      { status: 400 }
    );
  }

  const rawFiles = sortFrameFiles(await fs.readdir(rawFramesDir));
  if (rawFiles.length === 0) {
    return Response.json(
      { error: "No raw frames found. Regenerate the animation first." },
      { status: 400 }
    );
  }

  const framesDir = storagePath("animations", id, "generated", "frames");
  await fs.rm(framesDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });

  let frameWidth = Number(animation.frameWidth ?? animation.spriteSize ?? 0);
  let frameHeight = Number(animation.frameHeight ?? animation.spriteSize ?? 0);
  if (!frameWidth || !frameHeight) {
    const samplePath = path.join(rawFramesDir, rawFiles[0]);
    const metadata = await sharp(samplePath).metadata();
    frameWidth = metadata.width ?? 1;
    frameHeight = metadata.height ?? 1;
  }

  let bgKeyColor = DEFAULT_BG_KEY;
  const generationSize = String(animation.generationSize ?? "");
  const { width, height } = parseSize(generationSize);
  const characterId = String(animation.characterId ?? "");
  const referenceImageId = String(animation.referenceImageId ?? "default");
  if (width && height && characterId) {
    const specPath = storagePath(
      "characters",
      characterId,
      "working",
      `reference_${referenceImageId}_${width}x${height}.json`
    );
    if (await fileExists(specPath)) {
      const spec = await readJson<{ bgKeyColor?: string }>(specPath);
      if (spec?.bgKeyColor) {
        bgKeyColor = spec.bgKeyColor;
      }
    }
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
      source: "rebuild",
    });
  }

  const layout = buildLayout({
    frameWidth,
    frameHeight,
    columns: sheetColumns,
    frameCount: generatedFrames.length,
  });

  const spritesheetName = `spritesheet_${Date.now()}_rebuild.png`;
  const spritesheetPath = storagePath("animations", id, "generated", spritesheetName);
  await composeSpritesheet({ framesDir, outputPath: spritesheetPath, layout });

  const updated = {
    ...animation,
    status: "complete",
    loopMode,
    sheetColumns,
    frameWidth,
    frameHeight,
    actualFrameCount: generatedFrames.length,
    generatedFrames,
    generatedSpritesheet: `/api/storage/animations/${id}/generated/${spritesheetName}`,
    spritesheetLayout: layout,
    generationNote: `Rebuilt spritesheet (${loopMode}).`,
    exports: undefined,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(animationPath, updated);
  return Response.json({ animation: updated });
}
