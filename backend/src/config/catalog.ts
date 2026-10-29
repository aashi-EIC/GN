import { z } from "zod";
import { ConfigurationError, NotFoundError } from "../errors.js";
import type { AuthenticatedUser } from "../types.js";
import { config } from "./env.js";
import { semanticModels } from "./semanticModels.js";

const featureFlagsSchema = z
  .object({
    debugMode: z.boolean().default(false),
    issueReporting: z.boolean().default(true),
    voiceInput: z.boolean().default(true),
    chartDownload: z.boolean().default(false),
  })
  .strict();

function readFeatureFlags() {
  try {
    return featureFlagsSchema.parse(JSON.parse(config.FEATURE_FLAGS_JSON ?? "{}"));
  } catch {
    throw new ConfigurationError("Invalid FEATURE_FLAGS_JSON configuration");
  }
}

const featureFlags = readFeatureFlags();

export function listAccessibleModels(_user: AuthenticatedUser) {
  return semanticModels;
}

export function getAccessibleModel(_user: AuthenticatedUser, modelId: string) {
  const model = semanticModels.find((entry) => entry.id === modelId);
  if (!model) throw new NotFoundError("Semantic model not found");
  return model;
}

export function getFeatureFlags(_user: AuthenticatedUser) {
  return { ...featureFlags };
}
