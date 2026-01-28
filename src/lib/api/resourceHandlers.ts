import { promises as fs } from "fs";
import { ensureDir, fileExists, readJson, storagePath, writeJson } from "@/lib/storage";
import { logger } from "@/lib/logger";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

type RouteContext = { params: Promise<{ id: string }> };
type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

type ResourceHandlerOptions = {
  baseDir: string;
  fileName: string;
  responseKey: string;
  resourceLabel: string;
  notFoundMessage: string;
};

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceJsonObject(value: JsonValue): JsonObject {
  return isJsonObject(value) ? value : {};
}

function buildResponse(responseKey: string, data: JsonObject) {
  const payload: JsonObject = { [responseKey]: data };
  return Response.json(payload);
}

function buildFilePath(options: ResourceHandlerOptions, id: string) {
  return storagePath(options.baseDir, id, options.fileName);
}

export function createStorageResourceHandlers(
  options: ResourceHandlerOptions
): { GET: RouteHandler; PUT: RouteHandler; DELETE: RouteHandler } {
  const GET: RouteHandler = async (_request, { params }) => {
    const { id } = await params;
    const filePath = buildFilePath(options, id);

    if (!(await fileExists(filePath))) {
      logger.warn(`${options.resourceLabel}: not found`, { id, filePath });
      return Response.json({ error: options.notFoundMessage }, { status: 404 });
    }

    try {
      const resource = await readJson<JsonObject>(filePath);
      return buildResponse(options.responseKey, resource);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`${options.resourceLabel}: failed to read`, { id, filePath, error: message });
      return Response.json(
        { error: `Failed to load ${options.resourceLabel.toLowerCase()}.` },
        { status: 500 }
      );
    }
  };

  const PUT: RouteHandler = async (request, { params }) => {
    const { id } = await params;
    const filePath = buildFilePath(options, id);

    if (!(await fileExists(filePath))) {
      logger.warn(`${options.resourceLabel}: not found`, { id, filePath });
      return Response.json({ error: options.notFoundMessage }, { status: 404 });
    }

    let payload: JsonValue;
    try {
      payload = await request.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`${options.resourceLabel}: invalid JSON payload`, { id, error: message });
      return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const payloadObject = coerceJsonObject(payload);
    if (!isJsonObject(payload)) {
      logger.warn(`${options.resourceLabel}: payload was not an object`, { id });
    }

    let current: JsonObject;
    try {
      current = await readJson<JsonObject>(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`${options.resourceLabel}: failed to read before update`, {
        id,
        filePath,
        error: message,
      });
      return Response.json(
        { error: `Failed to update ${options.resourceLabel.toLowerCase()}.` },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    const updated: JsonObject = {
      ...current,
      ...payloadObject,
      id,
      updatedAt: now,
    };

    try {
      await ensureDir(storagePath(options.baseDir, id));
      await writeJson(filePath, updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`${options.resourceLabel}: failed to write`, { id, filePath, error: message });
      return Response.json(
        { error: `Failed to update ${options.resourceLabel.toLowerCase()}.` },
        { status: 500 }
      );
    }

    return buildResponse(options.responseKey, updated);
  };

  const DELETE: RouteHandler = async (_request, { params }) => {
    const { id } = await params;
    const dirPath = storagePath(options.baseDir, id);

    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`${options.resourceLabel}: failed to delete`, { id, dirPath, error: message });
      return Response.json(
        { error: `Failed to delete ${options.resourceLabel.toLowerCase()}.` },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  };

  return { GET, PUT, DELETE };
}
