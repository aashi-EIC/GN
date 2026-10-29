import type { SemanticModel } from "../types/semantic";
import { modelContent, type ModelContent } from "../../../shared/constants/semanticModels";

const guideTabs = ["Executive Overview", "Suggested Prompts"] as const;
let models: readonly SemanticModel[] = [];
const missingContent: ModelContent = {
  nickname: "",
  color: "#9B1B5A",
  description: "Guide content has not been configured for this model yet.",
  guide: "Guide content has not been configured for this model yet.",
  objective: "Guide content has not been configured for this model yet.",
  prompts: [],
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function parseModel(value: unknown): SemanticModel {
  if (
    !record(value) ||
    !text(value.id, 256) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value.id) ||
    !text(value.name, 160) ||
    !text(value.short, 20)
  )
    throw new Error("Invalid semantic model");
  const content = Object.hasOwn(modelContent, value.id) ? modelContent[value.id] : undefined;
  return { ...(content ?? missingContent), id: value.id, name: value.name, short: value.short };
}

export function installModelCatalog(value: unknown) {
  if (
    !record(value) ||
    !Array.isArray(value.semantic_models) ||
    !value.semantic_models.length ||
    value.semantic_models.length > 100
  )
    throw new Error("Invalid semantic model catalogue");

  const configured = value.semantic_models.map(parseModel);
  if (new Set(configured.map((model) => model.id)).size !== configured.length) {
    throw new Error("Duplicate semantic model ID");
  }
  models = configured;
}

export function getSemanticModels() {
  return models;
}

export function getModelGuideTabs() {
  return guideTabs;
}
