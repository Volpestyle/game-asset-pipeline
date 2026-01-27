import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  ensureDir,
  fileExists,
  readJson,
  storagePath,
  writeJson,
} from "@/lib/storage";
import type {
  Animation,
  AnimationVersion,
  AnimationVersionSource,
  GeneratedFrame,
  Keyframe,
} from "@/types";

type AnimationSnapshot = Pick<
  Animation,
  | "referenceImageId"
  | "name"
  | "description"
  | "frameCount"
  | "fps"
  | "style"
  | "spriteSize"
  | "frameWidth"
  | "frameHeight"
  | "generationProvider"
  | "generationModel"
  | "generationSeconds"
  | "generationSize"
  | "generationLoop"
  | "generationStartImageUrl"
  | "generationEndImageUrl"
  | "extractFps"
  | "loopMode"
  | "sheetColumns"
  | "keyframes"
  | "generatedFrames"
  | "status"
  | "generatedSpritesheet"
  | "generationNote"
  | "spritesheetLayout"
  | "actualFrameCount"
  | "sourceVideoUrl"
  | "sourceProviderSpritesheetUrl"
  | "sourceThumbnailUrl"
>;

type AnimationVersionSnapshot = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  source?: AnimationVersionSource;
  snapshot: AnimationSnapshot;
};

const VERSION_DIRNAME = "versions";

function getAnimationPath(animationId: string) {
  return storagePath("animations", animationId, "animation.json");
}

function getVersionDir(animationId: string, versionId: string) {
  return storagePath("animations", animationId, VERSION_DIRNAME, versionId);
}

function cloneKeyframe(keyframe: Keyframe): Keyframe {
  return { ...keyframe };
}

function cloneFrame(frame: GeneratedFrame): GeneratedFrame {
  return { ...frame };
}

function buildSnapshot(animation: Animation): AnimationSnapshot {
  return {
    referenceImageId: animation.referenceImageId ?? null,
    name: animation.name,
    description: animation.description,
    frameCount: animation.frameCount,
    fps: animation.fps,
    style: animation.style,
    spriteSize: animation.spriteSize,
    frameWidth: animation.frameWidth,
    frameHeight: animation.frameHeight,
    generationProvider: animation.generationProvider,
    generationModel: animation.generationModel,
    generationSeconds: animation.generationSeconds,
    generationSize: animation.generationSize,
    generationLoop: animation.generationLoop,
    generationStartImageUrl: animation.generationStartImageUrl ?? undefined,
    generationEndImageUrl: animation.generationEndImageUrl ?? undefined,
    extractFps: animation.extractFps,
    loopMode: animation.loopMode,
    sheetColumns: animation.sheetColumns,
    keyframes: Array.isArray(animation.keyframes)
      ? animation.keyframes.map(cloneKeyframe)
      : [],
    generatedFrames: Array.isArray(animation.generatedFrames)
      ? animation.generatedFrames.map(cloneFrame)
      : [],
    status: animation.status,
    generatedSpritesheet: animation.generatedSpritesheet,
    generationNote: animation.generationNote,
    spritesheetLayout: animation.spritesheetLayout
      ? { ...animation.spritesheetLayout }
      : undefined,
    actualFrameCount: animation.actualFrameCount,
    sourceVideoUrl: animation.sourceVideoUrl,
    sourceProviderSpritesheetUrl: animation.sourceProviderSpritesheetUrl,
    sourceThumbnailUrl: animation.sourceThumbnailUrl,
  };
}

function mapUrl(
  url: string,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
): string;
function mapUrl(
  url: undefined,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
): undefined;
function mapUrl(
  url: null,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
): null;
function mapUrl(
  url: string | undefined,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
): string | undefined;
function mapUrl(
  url: string | null | undefined,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
): string | null | undefined;
function mapUrl(
  url: string | null | undefined,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
) {
  if (!url) return url;
  const base = `/api/storage/animations/${animationId}/`;
  if (direction === "toVersion") {
    if (url.startsWith(base)) {
      return `${base}${VERSION_DIRNAME}/${versionId}/${url.slice(base.length)}`;
    }
    return url;
  }
  const versionBase = `${base}${VERSION_DIRNAME}/${versionId}/`;
  if (url.startsWith(versionBase)) {
    return `${base}${url.slice(versionBase.length)}`;
  }
  return url;
}

function mapKeyframe(
  keyframe: Keyframe,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
) {
  const mapped: Keyframe = { ...keyframe };
  if (mapped.image) {
    mapped.image = mapUrl(mapped.image, animationId, versionId, direction);
  }
  if (typeof mapped.inputPalette === "string") {
    mapped.inputPalette = mapUrl(
      mapped.inputPalette,
      animationId,
      versionId,
      direction
    );
  }
  if (Array.isArray(mapped.generations)) {
    mapped.generations = mapped.generations.map((generation) => {
      const mappedGeneration = { ...generation };
      mappedGeneration.image = mapUrl(
        mappedGeneration.image,
        animationId,
        versionId,
        direction
      );
      if (typeof mappedGeneration.inputPalette === "string") {
        mappedGeneration.inputPalette = mapUrl(
          mappedGeneration.inputPalette,
          animationId,
          versionId,
          direction
        );
      }
      return mappedGeneration;
    });
  }
  return mapped;
}

function mapGeneratedFrame(
  frame: GeneratedFrame,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
) {
  const mapped: GeneratedFrame = { ...frame };
  if (typeof mapped.url === "string") {
    mapped.url = mapUrl(mapped.url, animationId, versionId, direction);
  }
  return mapped;
}

function mapSnapshotUrls(
  snapshot: AnimationSnapshot,
  animationId: string,
  versionId: string,
  direction: "toVersion" | "toWorking"
) {
  return {
    ...snapshot,
    keyframes: Array.isArray(snapshot.keyframes)
      ? snapshot.keyframes.map((keyframe) =>
          mapKeyframe(keyframe, animationId, versionId, direction)
        )
      : [],
    generatedFrames: Array.isArray(snapshot.generatedFrames)
      ? snapshot.generatedFrames.map((frame) =>
          mapGeneratedFrame(frame, animationId, versionId, direction)
        )
      : [],
    generatedSpritesheet: mapUrl(
      snapshot.generatedSpritesheet,
      animationId,
      versionId,
      direction
    ),
    generationStartImageUrl: mapUrl(
      snapshot.generationStartImageUrl,
      animationId,
      versionId,
      direction
    ),
    generationEndImageUrl: mapUrl(
      snapshot.generationEndImageUrl,
      animationId,
      versionId,
      direction
    ),
    sourceVideoUrl: mapUrl(
      snapshot.sourceVideoUrl,
      animationId,
      versionId,
      direction
    ),
    sourceProviderSpritesheetUrl: mapUrl(
      snapshot.sourceProviderSpritesheetUrl,
      animationId,
      versionId,
      direction
    ),
    sourceThumbnailUrl: mapUrl(
      snapshot.sourceThumbnailUrl,
      animationId,
      versionId,
      direction
    ),
  };
}

async function copyDirRecursive(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function replaceDirWithCopy(src: string, dest: string) {
  await fs.rm(dest, { recursive: true, force: true });
  if (await fileExists(src)) {
    await copyDirRecursive(src, dest);
  } else {
    await fs.mkdir(dest, { recursive: true });
  }
}

async function writeVersionSnapshot(
  animationId: string,
  version: AnimationVersion,
  animation: Animation
) {
  const versionDir = getVersionDir(animationId, version.id);
  await ensureDir(versionDir);

  const generatedDir = storagePath("animations", animationId, "generated");
  const keyframesDir = storagePath("animations", animationId, "keyframes");

  await replaceDirWithCopy(generatedDir, path.join(versionDir, "generated"));
  await replaceDirWithCopy(keyframesDir, path.join(versionDir, "keyframes"));

  const snapshot = mapSnapshotUrls(
    buildSnapshot(animation),
    animationId,
    version.id,
    "toVersion"
  );

  const payload: AnimationVersionSnapshot = {
    id: version.id,
    name: version.name,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    source: version.source,
    snapshot,
  };

  await writeJson(path.join(versionDir, "version.json"), payload);
}

function getVersionCounter(animation: Animation) {
  const listCount = Array.isArray(animation.versions)
    ? animation.versions.length
    : 0;
  const stored = Number(animation.versionCounter ?? 0);
  return Math.max(listCount, Number.isFinite(stored) ? stored : 0);
}

export async function getAnimationVersions(animationId: string) {
  const filePath = getAnimationPath(animationId);
  if (!(await fileExists(filePath))) {
    throw new Error("Animation not found.");
  }
  const animation = await readJson<Animation>(filePath);
  return {
    versions: Array.isArray(animation.versions) ? animation.versions : [],
    activeVersionId: animation.activeVersionId ?? null,
  };
}

export async function createAnimationVersion(
  animationId: string,
  options?: { name?: string; source?: AnimationVersionSource }
) {
  const filePath = getAnimationPath(animationId);
  if (!(await fileExists(filePath))) {
    throw new Error("Animation not found.");
  }
  const animation = await readJson<Animation>(filePath);
  const versions = Array.isArray(animation.versions) ? [...animation.versions] : [];
  const counter = getVersionCounter(animation);
  const nextCounter = counter + 1;
  const now = new Date().toISOString();
  const name = options?.name?.trim() || `Version ${nextCounter}`;
  const version: AnimationVersion = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    source: options?.source ?? "manual",
  };

  const updated: Animation = {
    ...animation,
    versions: [...versions, version],
    activeVersionId: version.id,
    versionCounter: nextCounter,
    updatedAt: now,
  };

  await writeJson(filePath, updated);
  await writeVersionSnapshot(animationId, version, animation);

  return { animation: updated, version };
}

export async function saveAnimationVersion(
  animationId: string,
  versionId: string,
  options?: { name?: string }
) {
  const filePath = getAnimationPath(animationId);
  if (!(await fileExists(filePath))) {
    throw new Error("Animation not found.");
  }
  const animation = await readJson<Animation>(filePath);
  const versions = Array.isArray(animation.versions) ? [...animation.versions] : [];
  const index = versions.findIndex((entry) => entry.id === versionId);
  if (index === -1) {
    throw new Error("Version not found.");
  }
  const now = new Date().toISOString();
  const existing = versions[index];
  const updatedVersion: AnimationVersion = {
    ...existing,
    name: options?.name?.trim() || existing.name,
    updatedAt: now,
  };
  versions[index] = updatedVersion;

  const updated: Animation = {
    ...animation,
    versions,
    activeVersionId: versionId,
    updatedAt: now,
  };

  await writeJson(filePath, updated);
  await writeVersionSnapshot(animationId, updatedVersion, animation);

  return { animation: updated, version: updatedVersion };
}

export async function loadAnimationVersion(
  animationId: string,
  versionId: string
) {
  const filePath = getAnimationPath(animationId);
  if (!(await fileExists(filePath))) {
    throw new Error("Animation not found.");
  }
  const versionPath = path.join(getVersionDir(animationId, versionId), "version.json");
  if (!(await fileExists(versionPath))) {
    throw new Error("Version not found.");
  }

  const animation = await readJson<Animation>(filePath);
  const versionData = await readJson<AnimationVersionSnapshot>(versionPath);
  const snapshot = mapSnapshotUrls(
    versionData.snapshot,
    animationId,
    versionId,
    "toWorking"
  );

  const now = new Date().toISOString();
  const restored: Animation = {
    ...animation,
    ...snapshot,
    id: animation.id,
    characterId: animation.characterId,
    createdAt: animation.createdAt,
    versions: Array.isArray(animation.versions) ? animation.versions : [],
    activeVersionId: versionId,
    versionCounter: animation.versionCounter,
    generationJob: undefined,
    exports: undefined,
    updatedAt: now,
  };

  const generatedDir = storagePath("animations", animationId, "generated");
  const keyframesDir = storagePath("animations", animationId, "keyframes");
  const exportsDir = storagePath("animations", animationId, "exports");

  await replaceDirWithCopy(
    path.join(getVersionDir(animationId, versionId), "generated"),
    generatedDir
  );
  await replaceDirWithCopy(
    path.join(getVersionDir(animationId, versionId), "keyframes"),
    keyframesDir
  );
  await fs.rm(exportsDir, { recursive: true, force: true });
  await ensureDir(exportsDir);

  await writeJson(filePath, restored);
  return restored;
}

export async function deleteAnimationVersion(
  animationId: string,
  versionId: string
) {
  const filePath = getAnimationPath(animationId);
  if (!(await fileExists(filePath))) {
    throw new Error("Animation not found.");
  }
  const animation = await readJson<Animation>(filePath);
  const versions = Array.isArray(animation.versions) ? animation.versions : [];
  const filtered = versions.filter((entry) => entry.id !== versionId);
  if (filtered.length === versions.length) {
    throw new Error("Version not found.");
  }
  const now = new Date().toISOString();
  const nextActive =
    animation.activeVersionId === versionId
      ? filtered[filtered.length - 1]?.id ?? null
      : animation.activeVersionId ?? null;
  const updated: Animation = {
    ...animation,
    versions: filtered,
    activeVersionId: nextActive,
    updatedAt: now,
  };

  await writeJson(filePath, updated);
  await fs.rm(getVersionDir(animationId, versionId), { recursive: true, force: true });
  return updated;
}
