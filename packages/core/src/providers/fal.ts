import { fal } from "@fal-ai/client";
import type { CapabilityId } from "@repo/shared";
import type { Provider, ProviderCall, ProviderResult } from "../pipeline/types.js";

/**
 * fal.ai provider adapter.
 *
 * Uses @fal-ai/client so you don't hard-code HTTP details. This is more resilient as fal evolves.
 * Docs: https://docs.fal.ai/model-apis/model-endpoints  (queue + sync endpoints)
 */
export function createFalProvider(): Provider {
  const key = process.env.FAL_KEY;
  if (key) {
    fal.config({ credentials: key });
  }

  const supportsSet = new Set<CapabilityId>([
    "stylize.img2img",
    "generate.turnaround",
    "generate.frame",
    "mask.segment"
  ]);

  async function run(call: ProviderCall): Promise<ProviderResult> {
    // Endpoint selection is done via model manifest at the app layer.
    // For demo simplicity, we encode the endpoint into the prompt prefix like: [endpoint:...]
    // In production, pass it explicitly in the ProviderCall extensions.
    const endpointId = call.routing?.endpointId ?? defaultEndpoint(call.capability);

    const input: Record<string, unknown> = {
      prompt: call.prompt,
      negative_prompt: call.negativePrompt,
      seed: call.seed,
      strength: call.strength,
      image_url: call.imageUrl,
      // Some endpoints accept width/height
      width: call.width,
      height: call.height
    };

    // Optional reference/IP-adapter and controlnets: we attach to generic fields.
    if (call.reference?.imageUrl) {
      input["ip_adapter_image_url"] = call.reference.imageUrl;
      input["ip_adapter_strength"] = call.reference.strength ?? 0.7;
    }
    if (call.control?.type && call.control.type !== "none" && call.control.imageUrl) {
      input["controlnet"] = {
        type: call.control.type,
        image_url: call.control.imageUrl,
        strength: call.control.strength ?? 0.65
      };
    }

    const result = await fal.subscribe(endpointId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        // Optional: surface logs
        void update;
      }
    });

    // Many fal image endpoints return { images: [{url, width, height}, ...] }
    const data = result.data as any;

    const images: Array<{ url: string; width?: number; height?: number }> =
      data.images ??
      (data.image
        ? [{ url: data.image.url ?? data.image, width: data.image.width, height: data.image.height }]
        : []);

    let masks: Array<{ url: string }> | undefined;
    if (data.combined_mask) {
      masks = [{ url: data.combined_mask.url ?? data.combined_mask }];
    } else if (Array.isArray(data.individual_masks)) {
      masks = data.individual_masks.map((m: any) => ({ url: m.url ?? m }));
    }

    const normalized: ProviderResult = {
      images,
      masks,
      raw: data
    };
    return normalized;
  }

  return {
    id: "fal",
    supports: (cap) => supportsSet.has(cap),
    run
  };
}

function defaultEndpoint(cap: CapabilityId): string {
  if (cap === "mask.segment") return "fal-ai/sam2/auto-segment";
  return "fal-ai/flux-general/image-to-image";
}
