import { countries, semanticModels } from "../../../shared/constants/semanticModels";
import type { CountryCode, ModelId } from "../types/semantic";

export function normalizeModelId(value?: string): ModelId {
  const legacyMap: Record<string, ModelId> = {
    mapping_stats: "mapping_stats_vod",
    mapping_stats_svc: "mapping_stats_vod",
    mapping_stats_vod: "mapping_stats_vod",
    mapping: "mapping_stats_vod",
    schedule_completeness: "schedule_completeness_tsg",
    schedule_completeness_tsg: "schedule_completeness_tsg",
    schedule: "schedule_completeness_tsg",
  };

  const mappedValue = value ? (legacyMap[value] ?? value) : undefined;
  return semanticModels.some((model) => model.id === mappedValue)
    ? (mappedValue as ModelId)
    : "schedule_completeness_tsg";
}

export function getModel(modelId: ModelId) {
  return (
    semanticModels.find((model) => model.id === normalizeModelId(modelId)) ?? semanticModels[0]
  );
}

export function normalizeCountryCode(value?: string): CountryCode {
  const upper = value?.toUpperCase();
  return countries.some((country) => country.code === upper) ? (upper as CountryCode) : "US";
}
