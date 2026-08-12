export type ModelId = string;

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
