import { createStorageResourceHandlers } from "@/lib/api/resourceHandlers";

export const runtime = "nodejs";

const handlers = createStorageResourceHandlers({
  baseDir: "characters",
  fileName: "character.json",
  responseKey: "character",
  resourceLabel: "Character",
  notFoundMessage: "Character not found.",
});

export const { GET, PUT, DELETE } = handlers;
