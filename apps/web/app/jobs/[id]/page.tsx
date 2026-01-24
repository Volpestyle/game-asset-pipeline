"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl } from "../../../lib/api";
import { ArtifactGallery } from "../../../components/ArtifactGallery";
import { StagePreview } from "../../../components/StagePreview";

export default function JobPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const id = params.id;

  useEffect(() => {
    const es = new EventSource(`${apiBaseUrl()}/v1/jobs/${id}/events`);
    es.addEventListener("snapshot", (evt: any) => {
      const data = JSON.parse(evt.data);
      setJob(data.job);
    });
    es.onerror = () => {
      // fallback to polling if SSE fails
      es.close();
      void (async () => {
        try {
          const res = await fetch(`${apiBaseUrl()}/v1/jobs/${id}`);
          const json = await res.json();
          setJob(json.job);
        } catch (e: any) {
          setErr(e?.message ?? "Failed to load job");
        }
      })();
    };
    return () => es.close();
  }, [id]);

  const stages = useMemo(() => (job?.stages ?? []).slice().sort((a: any, b: any) => a.stageId.localeCompare(b.stageId)), [job]);
  const artifacts = useMemo(() => (job?.artifacts ?? []), [job]);

  if (err) {
    return <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">{err}</div>;
  }

  if (!job) {
    return <div className="text-sm text-zinc-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{job.characterName}</div>
            <div className="truncate text-sm text-zinc-400">{job.prompt}</div>
          </div>
          <div className="shrink-0 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300">{job.status}</div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {stages.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-zinc-900 bg-zinc-950/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{s.stageId}</div>
                <div className="text-xs text-zinc-400">{s.status}</div>
              </div>
              {s.message ? <div className="mt-2 text-xs text-zinc-500">{s.message}</div> : null}
              <StagePreview stage={s} artifacts={artifacts} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6">
        <div className="text-lg font-semibold">Artifacts</div>
        <div className="mt-1 text-sm text-zinc-400">
          Spritesheets + manifest are what you’d ingest into your engine. Individual frames are also kept for debugging/polish.
        </div>

        <div className="mt-5">
          <ArtifactGallery artifacts={artifacts} />
        </div>
      </div>
    </div>
  );
}
