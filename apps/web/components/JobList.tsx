"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl } from "../lib/api";

type Job = any;

export function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      const res = await fetch(`${apiBaseUrl()}/v1/jobs`);
      const json = await res.json();
      setJobs(json.jobs ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      {err ? <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">{err}</div> : null}
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">{jobs.length} recent jobs</div>
        <a className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500" href="/new">
          Create job
        </a>
      </div>

      <div className="grid gap-3">
        {jobs.map((j) => (
          <a
            key={j.id}
            href={`/jobs/${j.id}`}
            className="rounded-lg border border-zinc-900 bg-zinc-950/40 px-4 py-3 hover:bg-zinc-900/40"
          >
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{j.characterName}</div>
                <div className="truncate text-xs text-zinc-400">{j.prompt}</div>
              </div>
              <div className="shrink-0 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300">
                {j.status}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
