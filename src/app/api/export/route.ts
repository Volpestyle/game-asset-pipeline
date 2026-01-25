import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import path from "path";
import archiver from "archiver";
import { buildAsepriteJson, inferFrameSize, loadPngDimensions } from "@/lib/aseprite";
import { fileExists, readJson, storagePath, writeJson } from "@/lib/storage";
import type { Animation as AnimationModel } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json();
  const { animationId } = payload ?? {};

  if (!animationId) {
    return Response.json({ error: "Missing animationId." }, { status: 400 });
  }

  const filePath = storagePath("animations", animationId, "animation.json");
  if (!(await fileExists(filePath))) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }

  const animation = await readJson<AnimationModel>(filePath);
  const spritesheetUrl = animation.generatedSpritesheet as string | undefined;

  if (!spritesheetUrl) {
    return Response.json(
      { error: "No generated spritesheet found. Run generation first." },
      { status: 400 }
    );
  }

  const filename = spritesheetUrl.split("/").pop();
  if (!filename) {
    return Response.json({ error: "Invalid spritesheet path." }, { status: 400 });
  }

  const spritesheetPath = storagePath("animations", animationId, "generated", filename);
  if (!(await fileExists(spritesheetPath))) {
    return Response.json({ error: "Spritesheet file missing." }, { status: 404 });
  }

  if (path.extname(spritesheetPath).toLowerCase() !== ".png") {
    return Response.json(
      { error: "Spritesheet must be PNG to generate Aseprite metadata." },
      { status: 400 }
    );
  }

  const { width, height } = await loadPngDimensions(spritesheetPath);
  const preferredSize = Number(animation.spriteSize ?? 48);
  const frameWidth =
    Number(animation.spritesheetLayout?.frameWidth ?? animation.frameWidth ?? 0) ||
    Number(animation.spritesheetLayout?.frameSize ?? animation.spriteSize ?? 0);
  const frameHeight =
    Number(animation.spritesheetLayout?.frameHeight ?? animation.frameHeight ?? 0) ||
    Number(animation.spritesheetLayout?.frameSize ?? animation.spriteSize ?? 0);
  const frameSize =
    frameWidth && frameHeight
      ? undefined
      : inferFrameSize(width, height, preferredSize);
  const generatedFrames = animation.generatedFrames ?? [];
  const frameCount = generatedFrames.length || animation.actualFrameCount;

  const { arrayJson, hashJson } = buildAsepriteJson({
    imageName: filename,
    imageWidth: width,
    imageHeight: height,
    frameSize,
    frameWidth: frameWidth || frameSize,
    frameHeight: frameHeight || frameSize,
    fps: Number(animation.fps ?? 12),
    frameCount: typeof frameCount === "number" ? frameCount : undefined,
  });

  const exportDir = storagePath("animations", animationId, "exports");
  await fs.mkdir(exportDir, { recursive: true });

  const exportSpritesheet = path.join(exportDir, filename);
  await fs.copyFile(spritesheetPath, exportSpritesheet);

  const hashPath = path.join(exportDir, "spritesheet-hash.json");
  const arrayPath = path.join(exportDir, "spritesheet-array.json");
  await fs.writeFile(hashPath, JSON.stringify(hashJson, null, 2));
  await fs.writeFile(arrayPath, JSON.stringify(arrayJson, null, 2));

  let pngSequenceUrl: string | undefined;
  const framesDir = storagePath("animations", animationId, "generated", "frames");
  let exportFramesDir: string | null = null;
  try {
    const frameFiles = await fs.readdir(framesDir);
    if (frameFiles.length > 0) {
      exportFramesDir = path.join(exportDir, "frames");
      await fs.mkdir(exportFramesDir, { recursive: true });
      const ordered = frameFiles
        .filter((file) => file.endsWith(".png"))
        .sort((a, b) => {
          const matchA = a.match(/frame_(\d+)\.png/);
          const matchB = b.match(/frame_(\d+)\.png/);
          const indexA = matchA ? Number(matchA[1]) : 0;
          const indexB = matchB ? Number(matchB[1]) : 0;
          return indexA - indexB;
        });

      const duration = Math.round(1000 / Math.max(1, Number(animation.fps ?? 12)));
      const indexJson = {
        frames: ordered.map((file) => {
          const match = file.match(/frame_(\d+)\.png/);
          const frameIndex = match ? Number(match[1]) : 0;
          return { filename: file, frameIndex, duration };
        }),
        meta: {
          frameRate: Number(animation.fps ?? 12),
        },
      };

      for (const frameFile of ordered) {
        await fs.copyFile(
          path.join(framesDir, frameFile),
          path.join(exportFramesDir, frameFile)
        );
      }

      await fs.writeFile(
        path.join(exportFramesDir, "index.json"),
        JSON.stringify(indexJson, null, 2)
      );
      pngSequenceUrl = `/api/storage/animations/${animationId}/exports/frames/`;
    }
  } catch {
    // No frames folder available.
  }

  const zipFilename = `export_${animationId}.zip`;
  const zipPath = path.join(exportDir, zipFilename);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const output = createWriteStream(zipPath);

  const archivePromise = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(output);
  archive.file(exportSpritesheet, { name: filename });
  archive.file(hashPath, { name: "spritesheet-hash.json" });
  archive.file(arrayPath, { name: "spritesheet-array.json" });
  if (exportFramesDir) {
    archive.directory(exportFramesDir, "frames");
  }

  await archive.finalize();
  await archivePromise;

  const updated = {
    ...animation,
    exports: {
      spritesheetUrl: `/api/storage/animations/${animationId}/exports/${filename}`,
      asepriteJsonHashUrl: `/api/storage/animations/${animationId}/exports/spritesheet-hash.json`,
      asepriteJsonArrayUrl: `/api/storage/animations/${animationId}/exports/spritesheet-array.json`,
      pngSequenceUrl,
      pngSequenceIndexUrl: pngSequenceUrl
        ? `/api/storage/animations/${animationId}/exports/frames/index.json`
        : undefined,
      zipBundleUrl: `/api/storage/animations/${animationId}/exports/${zipFilename}`,
    },
    updatedAt: new Date().toISOString(),
  };

  await writeJson(filePath, updated);

  return Response.json({ animation: updated });
}
