import { countries } from "../../../shared/constants/countries";
import type { CountryCode, ModelId, SemanticModel } from "../types/semantic";
import { getSemanticModels } from "./modelCatalog";

export function normalizeModelId(value?: string): ModelId {
  const models = getSemanticModels();
  if (value === undefined) return models[0]?.id ?? "";
  if (models.some((model) => model.id === value)) return value;
  const legacyMap: Record<string, ModelId> = {
    mapping_stats: "mapping_stats_vod",
    mapping_stats_svc: "mapping_stats_vod",
    mapping_stats_vod: "mapping_stats_vod",
    mapping: "mapping_stats_vod",
    vod: "mapping_stats_vod",
    schedule_completeness: "schedule_completeness_tsg",
    schedule_completeness_tsg: "schedule_completeness_tsg",
    schedule: "schedule_completeness_tsg",
    tsg: "schedule_completeness_tsg",
  };

  return Object.hasOwn(legacyMap, value) ? legacyMap[value] : value;
}

export function isModelAvailable(modelId: ModelId) {
  return getSemanticModels().some((model) => model.id === normalizeModelId(modelId));
}

export function getModel(modelId: ModelId): SemanticModel {
  return (
    getSemanticModels().find((model) => model.id === normalizeModelId(modelId)) ?? {
      id: modelId,
      name: "Unavailable model",
      short: "N/A",
      nickname: "Unavailable model",
      color: "#64748B",
      description:
        "This model is not in the current catalogue. Saved messages are still available.",
      guide: "Start a new chat with an available model.",
      prompts: [],
    }
  );
}

export function normalizeCountryCode(value?: string): CountryCode {
  const upper = value?.toUpperCase();
  return countries.some((country) => country.code === upper) ? (upper as CountryCode) : "US";
}
