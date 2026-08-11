export type ModelId =
  | "mapping_stats_svc"
  | "schedule_completeness_tsg";

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
