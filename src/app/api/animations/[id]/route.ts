import { createStorageResourceHandlers } from "@/lib/api/resourceHandlers";

export const runtime = "nodejs";

const handlers = createStorageResourceHandlers({
  baseDir: "animations",
  fileName: "animation.json",
  responseKey: "animation",
  resourceLabel: "Animation",
  notFoundMessage: "Animation not found.",
});

export const { GET, PUT, DELETE } = handlers;
