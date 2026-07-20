import { countries, semanticModels } from "../constants/semanticModels";
import type { CountryCode, ModelId } from "../types/semantic";

export function normalizeModelId(value?: string): ModelId {
  const legacyMap: Record<string, ModelId> = {
    schedule: "schedule_completeness",
    mapping: "mapping_stats",
    metadata: "metadata_stats_linear",
    discovery: "usage_metric_bia_dashboard",
  };
  const mappedValue = value ? legacyMap[value] ?? value : undefined;
  return semanticModels.some((model) => model.id === mappedValue)
    ? (mappedValue as ModelId)
    : "schedule_completeness";
}

export function getModel(modelId: ModelId) {
  return semanticModels.find((model) => model.id === normalizeModelId(modelId)) ?? semanticModels[0];
}

export function normalizeCountryCode(value?: string): CountryCode {
  return countries.some((country) => country.code === value) ? (value as CountryCode) : "us";
}

export function getCountry(countryCode: CountryCode) {
  return countries.find((country) => country.code === countryCode) ?? countries[0];
}
