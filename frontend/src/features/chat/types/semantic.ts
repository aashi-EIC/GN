export type ModelId = string;

export type CountryCode = "US";

export type SemanticModel = {
  id: ModelId;
  name: string;
  short: string;
  nickname: string;
  description: string;
  guide: string;
  objective?: string;
  objectiveHeading?: string;
  objectiveSummary?: string;
  objectiveNote?: string;
  objectivePoints?: Array<{ label?: string; text: string }>;
  businessPurpose?: string;
  businessHeading?: string;
  businessSummary?: string;
  businessPoints?: string[];
  quickTip?: string;
  highlights?: Array<{ label: string; value: string }>;
  color: string;
  prompts: string[];
};
