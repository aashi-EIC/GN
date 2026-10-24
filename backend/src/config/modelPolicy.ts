import { z } from "zod";
import { ConfigurationError } from "../errors.js";
import type { parseModelGuide } from "./modelGuide.js";

const modelId = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/);
const policySchema = z.object({
  version: z.literal("1.0"),
  model_guide_s3_path: z.string().trim().min(1).max(2_048),
  semantic_models: z.record(
    modelId,
    z.object({
      semantic_model_id: modelId,
      display_name: z.string().trim().min(1).max(160),
    }),
  ),
});

export function parseS3Location(value: string) {
  const match = /^s3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/([^?#\\]+)$/.exec(value);
  const bucket = match?.[1];
  const key = match?.[2];
  if (!bucket || !key || Buffer.byteLength(key, "utf8") > 1_024) {
    throw new ConfigurationError("Model guide path must be an S3 object URI");
  }
  return { bucket, key };
}

/** Only catalogue metadata is consumed; identity and permission fields stay server-side. */
export function parseModelPolicy(value: unknown) {
  const parsed = policySchema.safeParse(value);
  if (!parsed.success) throw new ConfigurationError("Invalid semantic model policy");
  const models = Object.values(parsed.data.semantic_models);
  if (!models.length || models.length > 100) {
    throw new ConfigurationError("Semantic model policy must declare 1 to 100 models");
  }
  if (new Set(models.map((model) => model.semantic_model_id)).size !== models.length) {
    throw new ConfigurationError("Duplicate semantic model ID in policy");
  }
  return {
    guideLocation: parseS3Location(parsed.data.model_guide_s3_path),
    models,
  };
}

export type ModelPolicy = ReturnType<typeof parseModelPolicy>;

export function applyModelPolicy(guide: ReturnType<typeof parseModelGuide>, policy: ModelPolicy) {
  const registered = new Map(policy.models.map((model) => [model.semantic_model_id, model]));
  return {
    tabs: guide.tabs,
    models: guide.models.map((model) => {
      const metadata = registered.get(model.id);
      if (!metadata) {
        throw new ConfigurationError(
          "Model guide contains an enabled model not registered in policy",
        );
      }
      return { ...model, name: metadata.display_name };
    }),
  };
}
