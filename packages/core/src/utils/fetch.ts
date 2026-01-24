import fs from "node:fs/promises";

export async function fetchToBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    if (comma === -1) throw new Error("Invalid data: URL");
    const meta = url.slice(0, comma);
    const data = url.slice(comma + 1);
    if (meta.includes(";base64")) return Buffer.from(data, "base64");
    return Buffer.from(decodeURIComponent(data), "utf-8");
  }

  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    return fs.readFile(filePath);
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}
