"use client";

export function ArtifactGallery({ artifacts }: { artifacts: any[] }) {
  const images = artifacts.filter((a) => String(a.url).includes("/files/") && (a.url.endsWith(".png") || a.url.includes(".png")));
  const manifest = artifacts.find((a) => a.type === "MANIFEST");

  return (
    <div className="space-y-4">
      {manifest ? (
        <a
          className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          href={manifest.url}
          target="_blank"
        >
          Download manifest.json
        </a>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.slice(0, 24).map((a) => (
          <a key={a.id} href={a.url} target="_blank" className="group rounded-lg border border-zinc-900 bg-zinc-950/40 p-2 hover:bg-zinc-900/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt={a.name} className="h-40 w-full rounded-md object-contain bg-zinc-950" />
            <div className="mt-2 truncate text-xs text-zinc-400 group-hover:text-zinc-200">{a.name}</div>
          </a>
        ))}
      </div>

      {images.length > 24 ? <div className="text-xs text-zinc-500">Showing first 24 images.</div> : null}
    </div>
  );
}
