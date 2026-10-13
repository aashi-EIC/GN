import { z } from "zod";
import { ConfigurationError, NotFoundError } from "../errors.js";
import type { AuthenticatedUser } from "../types.js";
import { config } from "./env.js";

const semanticModelSchema = z
  .object({
    id: z.string().trim().min(1).max(256),
    name: z.string().trim().min(1).max(160),
    short: z.string().trim().min(1).max(20),
    nickname: z.string().trim().max(160).optional(),
    description: z.string().trim().min(1).max(2_000),
    guide: z.string().trim().max(5_000).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    examplePrompts: z.array(z.string().trim().min(1).max(2_000)).max(12).default([]),
    supportedVisualizations: z
      .array(
        z.enum([
          "kpi",
          "bar",
          "line",
          "area",
          "pie",
          "donut",
          "scatter",
          "bubble",
          "histogram",
          "heatmap",
          "combo",
          "table",
        ]),
      )
      .max(12)
      .default([]),
    enabled: z.boolean().default(true),
    allowedRoles: z.array(z.string().trim().min(1).max(128)).max(50).default([]),
  })
  .strict();

const featureFlagsSchema = z
  .object({
    debugMode: z.boolean().default(false),
    issueReporting: z.boolean().default(true),
    voiceInput: z.boolean().default(true),
    chartDownload: z.boolean().default(false),
  })
  .strict();

export type SemanticModelDefinition = z.infer<typeof semanticModelSchema>;

function parseJson(value: string | undefined, label: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new ConfigurationError(`${label} must contain valid JSON`);
  }
}

const models = z
  .array(semanticModelSchema)
  .max(100)
  .parse(parseJson(config.SEMANTIC_MODELS_JSON, "SEMANTIC_MODELS_JSON") ?? []);

const featureFlags = featureFlagsSchema.parse(
  parseJson(config.FEATURE_FLAGS_JSON, "FEATURE_FLAGS_JSON") ?? {},
);

export function listAccessibleModels(_user: AuthenticatedUser) {
  return models.filter((model) => model.enabled);
}

export function getAccessibleModel(_user: AuthenticatedUser, modelId: string) {
  if (models.length === 0) return undefined;

  const model = models.find((entry) => entry.id === modelId);
  if (!model || !model.enabled) throw new NotFoundError("Semantic model not found");
  return model;
}

export function getFeatureFlags(_user: AuthenticatedUser) {
  return {
    ...featureFlags,
    debugMode: featureFlags.debugMode,
  };
}
