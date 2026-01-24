import fs from "node:fs/promises";
import path from "node:path";
import { ModelManifestSchema } from "@repo/shared";
import type { CapabilityId, ProviderId } from "@repo/shared";
import type { ModelManifest } from "@repo/shared";
import type { Provider, ProviderCall, ProviderResult } from "../pipeline/types.js";
import { createFalProvider } from "./fal.js";
import { createReplicateProvider } from "./replicate.js";
import { createMockProvider } from "./mock.js";

export type ProviderRegistryConfig = {
  rootDir: string;
  manifestPath: string;
  providerHint?: ProviderId; // default provider selection override
};

export class ProviderRegistry {
  private manifest!: ModelManifest;
  private providers: Map<ProviderId, Provider> = new Map();

  constructor(private cfg: ProviderRegistryConfig) {}

  async init(): Promise<void> {
    this.providers.set("fal", createFalProvider());
    this.providers.set("replicate", createReplicateProvider());
    this.providers.set("mock", createMockProvider());

    const manifestAbs = path.isAbsolute(this.cfg.manifestPath)
      ? this.cfg.manifestPath
      : path.join(this.cfg.rootDir, this.cfg.manifestPath);

    const raw = await fs.readFile(manifestAbs, "utf-8");
    this.manifest = ModelManifestSchema.parse(JSON.parse(raw));
  }

  getManifest(): ModelManifest {
    return this.manifest;
  }

  /**
   * Run a model by *capability*, not by hard-coded model name.
   * This makes the pipeline future-proof as new models arrive.
   */
  async run(capability: CapabilityId, call: Omit<ProviderCall, "capability"> & { providerOverride?: ProviderId }): Promise<ProviderResult> {
    const cap = this.manifest.capabilities[capability];
    const chosenProviderId = (call.providerOverride ?? this.cfg.providerHint ?? cap?.provider ?? this.manifest.defaults.provider) as ProviderId;

    const provider = this.providers.get(chosenProviderId);
    if (!provider) throw new Error(`Provider not registered: ${chosenProviderId}`);
    if (!provider.supports(capability)) throw new Error(`Provider ${chosenProviderId} does not support capability: ${capability}`);

    const routing = {
      endpointId: cap?.endpointId,
      model: cap?.model,
      version: cap?.version
    };

    return provider.run({
      capability,
      ...call,
      routing
    });
  }
}

// Simple singleton for apps to use.
let singleton: ProviderRegistry | null = null;

export async function getProviderRegistry(cfg: ProviderRegistryConfig): Promise<ProviderRegistry> {
  if (!singleton) {
    singleton = new ProviderRegistry(cfg);
    await singleton.init();
  }
  return singleton;
}
