import { loadAnimationVersion } from "@/lib/animationVersions";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  try {
    const animation = await loadAnimationVersion(id, versionId);
    return Response.json({ animation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load version.";
    const status = message === "Animation not found." || message === "Version not found."
      ? 404
      : 400;
    return Response.json({ error: message }, { status });
  }
}
