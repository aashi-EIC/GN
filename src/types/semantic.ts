export type ModelId =
  | "imagenary_stats"
  | "linear_country_grading"
  | "mapping_stats"
  | "metadata_stats_linear"
  | "program_gaps"
  | "schedule_completeness"
  | "usage_metric_bia_dashboard";

export type CountryCode = "us" | "in" | "gb" | "br" | "jp" | "de";

export type SemanticModel = {
  id: ModelId;
  name: string;
  short: string;
  description: string;
  guide: string;
  color: string;
  prompts: string[];
};
