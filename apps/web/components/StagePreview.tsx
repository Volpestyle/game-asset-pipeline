"use client";

const STAGE_ARTIFACT_TYPES: Record<string, string[]> = {
  ingest: ["UPLOAD"],
  stylize: ["STYLIZED", "PREVIEW"],
  turnaround: ["TURNAROUND"],
  actions: ["FRAME"],
  segment: ["MASK"],
  spritesheet: ["SPRITESHEET"],
  manifest: ["MANIFEST"],
  preview: ["PREVIEW"]
};

const STAGE_PREVIEW_LABEL: Record<string, string> = {
  ingest: "uploads",
  stylize: "stylized",
  turnaround: "turnarounds",
  actions: "frames",
  segment: "masks",
  spritesheet: "sheets",
  manifest: "manifest",
  preview: "previews"
};

const IMAGE_EXT = /\.(png|jpe?g)$/i;

function artifactTypesForStage(stage: any): string[] {
  const type = String(stage?.type ?? stage?.stageId ?? "");
  return STAGE_ARTIFACT_TYPES[type] ?? STAGE_ARTIFACT_TYPES[String(stage?.stageId ?? "")] ?? [];
}

function previewLabelForStage(stage: any): string {
  const type = String(stage?.type ?? stage?.stageId ?? "");
  return STAGE_PREVIEW_LABEL[type] ?? "artifacts";
}

function isImageArtifact(artifact: any): boolean {
  const url = String(artifact?.url ?? "");
  return url.includes("/files/") && IMAGE_EXT.test(url);
}

export function StagePreview({ stage, artifacts }: { stage: any; artifacts: any[] }) {
  const types = artifactTypesForStage(stage);
  const stageArtifacts = artifacts.filter((a) => types.includes(a.type));
  const images = stageArtifacts.filter(isImageArtifact);
  const manifest = stageArtifacts.find((a) => a.type === "MANIFEST");

  if (types.length === 0) {
    return <div className="mt-2 text-xs text-zinc-500">No preview mapping for this stage.</div>;
  }

  if (images.length === 0 && !manifest) {
    const msg = stage?.status === "SUCCEEDED" ? "No artifacts recorded for this stage." : "Waiting on output…";
    return <div className="mt-2 text-xs text-zinc-500">{msg}</div>;
  }

  const preview = images.slice(0, 4);
  const label = previewLabelForStage(stage);

  return (
    <div className="mt-3 space-y-2">
      {manifest ? (
        <a className="inline-flex items-center text-xs text-emerald-200 hover:text-emerald-100" href={manifest.url} target="_blank">
          Download manifest.json
        </a>
      ) : null}

      {preview.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {preview.map((a) => (
            <a key={a.id} href={a.url} target="_blank" className="rounded-md border border-zinc-900 bg-zinc-950/40 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="h-24 w-full rounded object-contain bg-zinc-950" />
            </a>
          ))}
        </div>
      ) : null}

      {images.length > preview.length ? (
        <div className="text-xs text-zinc-500">
          Showing first {preview.length} of {images.length} {label}.
        </div>
      ) : null}
    </div>
  );
}
