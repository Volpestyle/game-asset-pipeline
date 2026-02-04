import { NextRequest } from "next/server";
import { getPreviewConfig, savePreviewConfig } from "@/lib/previewStorage";
import { logger } from "@/lib/logger";
import type { PreviewConfig, PreviewState, KeyBinding } from "@/app/preview/[characterId]/types";
import { createDefaultConfig } from "@/app/preview/[characterId]/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ characterId: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  const { characterId } = await params;

  try {
    const config = await getPreviewConfig(characterId);
    return Response.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Preview config: failed to read", { characterId, error: message });
    return Response.json(
      { error: "Failed to load preview config." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  const { characterId } = await params;

  let payload: Partial<PreviewConfig>;
  try {
    payload = await request.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Preview config: invalid JSON payload", { characterId, error: message });
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    logger.warn("Preview config: payload was not an object", { characterId });
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (payload.states !== undefined && !Array.isArray(payload.states)) {
    logger.warn("Preview config: states must be an array", { characterId });
    return Response.json({ error: "States must be an array." }, { status: 400 });
  }

  if (payload.keyBindings !== undefined && !Array.isArray(payload.keyBindings)) {
    logger.warn("Preview config: keyBindings must be an array", { characterId });
    return Response.json({ error: "Key bindings must be an array." }, { status: 400 });
  }

  try {
    // Get existing config or create default
    let current: PreviewConfig;
    try {
      current = await getPreviewConfig(characterId);
    } catch {
      current = createDefaultConfig(characterId);
    }

    const states = payload.states ?? current.states;
    const keyBindings = payload.keyBindings ?? current.keyBindings;

    const sanitizedStates: PreviewState[] = states.filter(
      (state) =>
        state.id &&
        typeof state.id === "string" &&
        state.name &&
        typeof state.name === "string"
    );

    const stateIds = new Set(sanitizedStates.map((state) => state.id));
    const sanitizedBindings: KeyBinding[] = keyBindings.filter(
      (binding) =>
        binding.id &&
        typeof binding.id === "string" &&
        binding.stateId &&
        typeof binding.stateId === "string" &&
        binding.key &&
        typeof binding.key === "string" &&
        stateIds.has(binding.stateId)
    );

    const defaultStateId =
      payload.defaultStateId ?? current.defaultStateId;
    const resolvedDefaultStateId = sanitizedStates.some(
      (state) => state.id === defaultStateId
    )
      ? defaultStateId
      : sanitizedStates[0]?.id ?? "";

    // Merge updates
    const updated: PreviewConfig = {
      characterId,
      states: sanitizedStates,
      keyBindings: sanitizedBindings,
      defaultStateId: resolvedDefaultStateId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const saved = await savePreviewConfig(updated);
    return Response.json({ config: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Preview config: failed to write", { characterId, error: message });
    return Response.json(
      { error: "Failed to save preview config." },
      { status: 500 }
    );
  }
}
