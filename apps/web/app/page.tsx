import { JobList } from "../components/JobList";

export default function Page() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6">
        <div className="text-lg font-semibold">Jobs</div>
        <div className="mt-1 text-sm text-zinc-400">
          Create a job from a reference image and a prompt. The worker will generate turnarounds, action frames, spritesheets, and a manifest.
        </div>
      </div>

      <JobList />
    </div>
  );
}
