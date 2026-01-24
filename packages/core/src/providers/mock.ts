import sharp from "sharp";
import { ulid } from "ulid";
import type { CapabilityId } from "@repo/shared";
import type { Provider, ProviderCall, ProviderResult } from "../pipeline/types.js";

/**
 * Mock provider: creates placeholder images so the pipeline runs end-to-end without external keys.
 */
export function createMockProvider(): Provider {
  const supportsSet = new Set<CapabilityId>([
    "stylize.img2img",
    "generate.turnaround",
    "generate.frame",
    "mask.segment",
    "upscale.optional"
  ]);

  async function makePng(label: string, w = 256, h = 256): Promise<Buffer> {
    const id = ulid().slice(-6);
    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#111827" stop-opacity="1"/>
            <stop offset="100%" stop-color="#0f766e" stop-opacity="1"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="url(#g)"/>
        <rect x="14" y="14" width="${w-28}" height="${h-28}" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
        <text x="24" y="56" fill="white" font-family="ui-sans-serif, system-ui" font-size="22">MOCK</text>
        <text x="24" y="92" fill="white" font-family="ui-sans-serif, system-ui" font-size="18">${escapeXml(label)}</text>
        <text x="24" y="${h-26}" fill="rgba(255,255,255,0.8)" font-family="ui-monospace, SFMono-Regular" font-size="14">id:${id}</text>
      </svg>
    `.trim();

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  async function run(call: ProviderCall): Promise<ProviderResult> {
    const label = `${call.capability}${call.control?.type ? `/${call.control.type}` : ""}`;
    const img = await makePng(label, call.width ?? 256, call.height ?? 256);

    // For masks, create a simple alpha-like mask
    if (call.capability === "mask.segment") {
      const maskSvg = `
        <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
          <rect width="256" height="256" fill="black"/>
          <circle cx="128" cy="128" r="88" fill="white"/>
        </svg>
      `.trim();
      const mask = await sharp(Buffer.from(maskSvg)).png().toBuffer();
      // We return a data: url (API will persist it)
      const imgUrl = bufferToDataUrl(img);
      const maskUrl = bufferToDataUrl(mask);
      return { images: [{ url: imgUrl }], masks: [{ url: maskUrl }], raw: { mock: true } };
    }

    return { images: [{ url: bufferToDataUrl(img) }], raw: { mock: true } };
  }

  return {
    id: "mock",
    supports: (cap) => supportsSet.has(cap),
    run
  };
}

function bufferToDataUrl(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
}
