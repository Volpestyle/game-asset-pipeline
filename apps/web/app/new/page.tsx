import { JobCreateForm } from "../../components/JobCreateForm";

export default function Page() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6">
        <div className="text-lg font-semibold">New job</div>
        <div className="mt-1 text-sm text-zinc-400">
          Upload a reference image and provide a prompt. Start with PIPELINE_PROVIDER=mock to verify the pipeline end-to-end.
        </div>
      </div>

      <JobCreateForm />
    </div>
  );
}
