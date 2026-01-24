import { Queue } from "bullmq";
import { env } from "./config.js";

export const pipelineQueue = new Queue("pipeline", {
  connection: { url: env().REDIS_URL }
});
