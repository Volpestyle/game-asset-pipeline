import { getProjectSettings, updateProjectSettings } from "@/lib/projectSettings";
import type { AnchorPoint } from "@/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getProjectSettings();
    return Response.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get project settings";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (typeof body.canvasWidth === "number") {
      updates.canvasWidth = body.canvasWidth;
    }
    if (typeof body.canvasHeight === "number") {
      updates.canvasHeight = body.canvasHeight;
    }
    if (typeof body.defaultAnchor === "string") {
      const validAnchors: AnchorPoint[] = [
        "bottom-center",
        "center",
        "bottom-left",
        "bottom-right",
        "top-center",
      ];
      if (validAnchors.includes(body.defaultAnchor)) {
        updates.defaultAnchor = body.defaultAnchor;
      }
    }
    if (typeof body.defaultScale === "number") {
      updates.defaultScale = body.defaultScale;
    }

    const settings = await updateProjectSettings(updates);
    return Response.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update project settings";
    return Response.json({ error: message }, { status: 400 });
  }
}
