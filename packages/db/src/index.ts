import { PrismaClient } from "@prisma/client";

// In real deployments you may want a global singleton / connection pooling.
export const prisma = new PrismaClient();

export * from "@prisma/client";

export enum JobStatus {
    QUEUED = "QUEUED",
    RUNNING = "RUNNING",
    SUCCEEDED = "SUCCEEDED",
    FAILED = "FAILED"
}

export enum StageStatus {
    PENDING = "PENDING",
    RUNNING = "RUNNING",
    SUCCEEDED = "SUCCEEDED",
    FAILED = "FAILED"
}

export enum ArtifactType {
    UPLOAD = "UPLOAD",
    STYLIZED = "STYLIZED",
    TURNAROUND = "TURNAROUND",
    FRAME = "FRAME",
    MASK = "MASK",
    SPRITESHEET = "SPRITESHEET",
    MANIFEST = "MANIFEST",
    PREVIEW = "PREVIEW"
}
