export type ModelId =
  | "metadata_stats_linear"
  | "imagerystats_vod"
  | "mapping_stats_svc"
  | "schedule_completeness_tsg"
  | "program_gaps_svc"
  | "linear_country_grading"
  | "usage_metrics_bia_dashboards";

export type CountryCode = "US";

export type SemanticModel = {
  id: ModelId;
  name: string;
  short: string;
  nickname: string;
  description: string;
  guide: string;
  color: string;
  prompts: string[];
};
