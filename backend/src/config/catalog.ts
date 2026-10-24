import { z } from "zod";
import { ConfigurationError, NotFoundError } from "../errors.js";
import type { AuthenticatedUser } from "../types.js";
import { config } from "./env.js";
import { parseModelGuide } from "./modelGuide.js";
import { readModelCatalogueSource } from "./modelCatalogueSource.js";
import { applyModelPolicy } from "./modelPolicy.js";

export type { SemanticModelDefinition } from "./modelGuide.js";

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

// Imports wait for validation before the HTTP server can start. Never reload on a request.
const { policy, guide } = await readModelCatalogueSource();
const catalogue = applyModelPolicy(
  parseModelGuide(guide, config.SEMANTIC_MODEL_GUIDE_EXCLUDED_IDS),
  policy,
);
const featureFlags = readFeatureFlags();

export function listAccessibleModels(_user: AuthenticatedUser) {
  return catalogue.models;
}

export function getModelGuideTabs() {
  return catalogue.tabs;
}

export function getAccessibleModel(_user: AuthenticatedUser, modelId: string) {
  const model = catalogue.models.find((entry) => entry.id === modelId);
  if (!model) throw new NotFoundError("Semantic model not found");
  return model;
}

export function getFeatureFlags(_user: AuthenticatedUser) {
  return { ...featureFlags };
}
