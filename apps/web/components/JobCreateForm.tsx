"use client";

import { useMemo, useRef, useState } from "react";
import { apiBaseUrl } from "../lib/api";

export function JobCreateForm() {
  const [characterName, setCharacterName] = useState("Hero");
  const [prompt, setPrompt] = useState("Top-down RPG pixel character, cozy adventurer, readable silhouette, consistent proportions.");
  const [negativePrompt, setNegativePrompt] = useState("blurry, extra limbs, multiple characters, background, watermark, text");
  const [actionOverridesText, setActionOverridesText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => files.length > 0 && prompt.trim().length > 0 && characterName.trim().length > 0, [files, prompt, characterName]);

  function addFiles(next: File[]) {
    if (next.length === 0) return;
    setFiles((prev) => {
      const seen = new Map<string, File>();
      for (const f of prev) {
        seen.set(`${f.name}:${f.size}:${f.lastModified}`, f);
      }
      for (const f of next) {
        const key = `${f.name}:${f.size}:${f.lastModified}`;
        if (!seen.has(key)) seen.set(key, f);
      }
      return Array.from(seen.values());
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (files.length === 0) return;
    setCreating(true);
    setError(null);

    try {
      let actionOverrides: Record<string, any> | undefined;
      if (actionOverridesText.trim().length > 0) {
        const parsed = JSON.parse(actionOverridesText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Action overrides must be a JSON object");
        }
        actionOverrides = parsed;
      }

      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));
      fd.append("payload", JSON.stringify({
        pipelineId: "topdown2d.v1",
        characterName,
        prompt,
        negativePrompt,
        styleStrength: 0.6,
        actionOverrides
      }));

      const res = await fetch(`${apiBaseUrl()}/v1/jobs`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();

      window.location.href = `/jobs/${json.jobId}`;
    } catch (e: any) {
      setError(e?.message ?? "Failed to create job");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Character name</label>
          <input
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Reference images</label>
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-zinc-200 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:text-zinc-200 hover:file:bg-zinc-800"
            multiple
            ref={fileInputRef}
            onChange={(e) => {
              addFiles(Array.from(e.currentTarget.files ?? []));
              e.currentTarget.value = "";
            }}
          />
          <div className="text-xs text-zinc-500">You can pick multiple files at once or add them one by one.</div>
          {files.length > 0 ? (
            <div className="rounded-md border border-zinc-900 bg-zinc-950/50 p-3 text-xs text-zinc-300">
              <div className="flex items-center justify-between">
                <div>{files.length} image{files.length === 1 ? "" : "s"} selected</div>
                <button
                  type="button"
                  className="text-zinc-400 hover:text-zinc-200"
                  onClick={() => setFiles([])}
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                {files.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-zinc-400">{f.name}</div>
                    <button
                      type="button"
                      className="shrink-0 text-zinc-500 hover:text-zinc-200"
                      onClick={() => removeFile(i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs text-zinc-400">Prompt</label>
          <textarea
            className="h-28 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs text-zinc-400">Negative prompt</label>
          <textarea
            className="h-20 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs text-zinc-400">Action overrides (JSON)</label>
          <textarea
            className="h-28 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500"
            placeholder={`{\n  "walk": { "fps": 10, "frames": 8, "loop": true, "events": { "footstep": [1,5] } }\n}`}
            value={actionOverridesText}
            onChange={(e) => setActionOverridesText(e.target.value)}
          />
          <div className="text-xs text-zinc-500">Optional. JSON object keyed by action name (frame indices are 0-based).</div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          disabled={!canSubmit || creating}
          onClick={submit}
        >
          {creating ? "Creating..." : "Create job"}
        </button>
      </div>
    </div>
  );
}
