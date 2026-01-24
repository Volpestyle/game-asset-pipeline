import type { CapabilityId } from "@repo/shared";
import type { Provider, ProviderCall, ProviderResult } from "../pipeline/types.js";

/**
 * Replicate provider adapter (HTTP).
 * Docs: https://replicate.com/docs/reference/http
 */
export function createReplicateProvider(): Provider {
  const token = process.env.REPLICATE_API_TOKEN;

  const supportsSet = new Set<CapabilityId>(["upscale.optional"]);

  async function run(call: ProviderCall): Promise<ProviderResult> {
    if (!token) throw new Error("REPLICATE_API_TOKEN not set");

    // For demo we only implement a generic "run model" call.
    // In production, map capability -> model + version in the model manifest and pass them here.
    const model = call.routing?.model;
    const version = call.routing?.version;
    if (!model) throw new Error("Replicate model not configured for this capability. Set it in config/model-manifest.json");

    const body = {
      model,
      version,
      input: {
        prompt: call.prompt,
        image: call.imageUrl
      }
    };

    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Replicate create prediction failed: ${res.status} ${errText}`);
    }
    const pred = await res.json() as any;

    // Poll until complete
    let p = pred;
    while (p.status !== "succeeded" && p.status !== "failed" && p.status !== "canceled") {
      await sleep(1000);
      const pr = await fetch(`https://api.replicate.com/v1/predictions/${p.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      p = await pr.json();
    }

    if (p.status !== "succeeded") throw new Error(`Replicate prediction did not succeed: ${p.status}`);

    // Output may be a string URL or array of URLs
    const out = p.output;
    const urls: string[] = Array.isArray(out) ? out : (typeof out === "string" ? [out] : []);
    return { images: urls.map((url) => ({ url })), raw: p };
  }

  return {
    id: "replicate",
    supports: (cap) => supportsSet.has(cap),
    run
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

