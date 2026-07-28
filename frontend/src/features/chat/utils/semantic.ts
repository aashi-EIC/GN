import { countries, semanticModels } from "../../../shared/constants/semanticModels";
import type { CountryCode, ModelId } from "../types/semantic";

export function normalizeModelId(value?: string): ModelId {
  const legacyMap: Record<string, ModelId> = {
    metadata_stats_linear: "metadata_stats_linear",
    metadata: "metadata_stats_linear",
    imagenary_stats: "imagerystats_vod",
    imagerystats_vod: "imagerystats_vod",
    mapping_stats: "mapping_stats_svc",
    mapping_stats_svc: "mapping_stats_svc",
    mapping: "mapping_stats_svc",
    schedule_completeness: "schedule_completeness_tsg",
    schedule_completeness_tsg: "schedule_completeness_tsg",
    schedule: "schedule_completeness_tsg",
    program_gaps: "program_gaps_svc",
    program_gaps_svc: "program_gaps_svc",
    linear_country_grading: "linear_country_grading",
    usage_metric_bia_dashboard: "usage_metrics_bia_dashboards",
    usage_metrics_bia_dashboards: "usage_metrics_bia_dashboards",
    discovery: "usage_metrics_bia_dashboards",
  };

  const mappedValue = value ? legacyMap[value] ?? value : undefined;
  return semanticModels.some((model) => model.id === mappedValue)
    ? (mappedValue as ModelId)
    : "metadata_stats_linear";
}

export function getModel(modelId: ModelId) {
  return semanticModels.find((model) => model.id === normalizeModelId(modelId)) ?? semanticModels[0];
}

export function normalizeCountryCode(value?: string): CountryCode {
  const upper = value?.toUpperCase();
  return countries.some((country) => country.code === upper) ? (upper as CountryCode) : "US";
}

export function getCountry(countryCode: CountryCode) {
  return countries.find((country) => country.code === normalizeCountryCode(countryCode)) ?? countries[0];
}
