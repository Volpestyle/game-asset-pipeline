import { logger } from "@/lib/logger";
import { getStudioHistoryPage } from "@/lib/studioHistory";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = parseNumber(url.searchParams.get("offset"), 0);
    const limit = parseNumber(url.searchParams.get("limit"), DEFAULT_LIMIT);

    if (!Number.isFinite(offset) || offset < 0) {
      return Response.json({ error: "Invalid offset." }, { status: 400 });
    }
    if (!Number.isFinite(limit) || limit <= 0) {
      return Response.json({ error: "Invalid limit." }, { status: 400 });
    }

    const cappedLimit = Math.min(MAX_LIMIT, Math.floor(limit));
    const page = await getStudioHistoryPage(offset, cappedLimit);

    return Response.json(page);
  } catch (error) {
    logger.error("Failed to load studio history", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Failed to load studio history." },
      { status: 500 }
    );
  }
}
