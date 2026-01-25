import {
  deleteAnimationVersion,
  saveAnimationVersion,
} from "@/lib/animationVersions";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const payload = await request.json().catch(() => ({}));
  try {
    const { animation, version } = await saveAnimationVersion(id, versionId, {
      name: typeof payload?.name === "string" ? payload.name : undefined,
    });
    return Response.json({ animation, version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save version.";
    const status = message === "Animation not found." || message === "Version not found."
      ? 404
      : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  try {
    const animation = await deleteAnimationVersion(id, versionId);
    return Response.json({ animation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete version.";
    const status = message === "Animation not found." || message === "Version not found."
      ? 404
      : 400;
    return Response.json({ error: message }, { status });
  }
}
