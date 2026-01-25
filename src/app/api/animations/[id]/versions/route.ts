import {
  createAnimationVersion,
  getAnimationVersions,
} from "@/lib/animationVersions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const versions = await getAnimationVersions(id);
    return Response.json(versions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load versions.";
    return Response.json({ error: message }, { status: 404 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  try {
    const { animation, version } = await createAnimationVersion(id, {
      name: typeof payload?.name === "string" ? payload.name : undefined,
      source:
        payload?.source === "generation" || payload?.source === "manual"
          ? payload.source
          : "manual",
    });
    return Response.json({ animation, version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create version.";
    const status = message === "Animation not found." ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
