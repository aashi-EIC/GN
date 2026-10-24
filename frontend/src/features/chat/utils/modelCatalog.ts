import type { SemanticModel } from "../types/semantic";

type Catalogue = { models: readonly SemanticModel[]; tabs: readonly [string, string] };
let catalogue: Catalogue = { models: [], tabs: ["Executive Overview", "Suggested Prompts"] };

function text(value: unknown, maximum = 5_000): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textList(value: unknown, maximum: number) {
  return (
    Array.isArray(value) && value.length <= maximum && value.every((entry) => text(entry, 2_000))
  );
}

function parseModel(value: unknown): SemanticModel {
  if (!record(value)) throw new Error("Invalid semantic model");
  const required = ["id", "name", "short", "nickname", "description", "guide", "color"];
  const optional = [
    "objectiveHeading",
    "objective",
    "objectiveSummary",
    "objectiveNote",
    "businessHeading",
    "businessPurpose",
    "businessSummary",
    "quickTip",
  ];
  if (
    !required.every((key) => text(value[key])) ||
    !optional.every((key) => value[key] === undefined || text(value[key])) ||
    typeof value.id !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,255}$/.test(value.id) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    typeof value.short !== "string" ||
    !value.short.trim() ||
    typeof value.color !== "string" ||
    !/^#[a-f0-9]{6}$/i.test(value.color) ||
    !textList(value.prompts, 30) ||
    (value.businessPoints !== undefined && !textList(value.businessPoints, 30)) ||
    (value.objectivePoints !== undefined &&
      (!Array.isArray(value.objectivePoints) ||
        value.objectivePoints.length > 30 ||
        !value.objectivePoints.every(
          (point) =>
            record(point) &&
            text(point.text, 2_000) &&
            (point.label === undefined || text(point.label, 160)),
        ))) ||
    (value.highlights !== undefined &&
      (!Array.isArray(value.highlights) ||
        value.highlights.length > 20 ||
        !value.highlights.every(
          (point) => record(point) && text(point.label, 160) && text(point.value, 300),
        )))
  )
    throw new Error("Invalid semantic model");
  return value as SemanticModel;
}

/** Installed before mounting the workspace; no polling or mid-conversation catalogue changes. */
export function installModelCatalog(value: unknown) {
  if (
    !record(value) ||
    !Array.isArray(value.semantic_models) ||
    !value.semantic_models.length ||
    value.semantic_models.length > 100 ||
    !Array.isArray(value.guide_tabs) ||
    value.guide_tabs.length !== 2 ||
    !value.guide_tabs.every((tab) => text(tab, 80) && tab.trim())
  ) {
    throw new Error("Invalid semantic model catalogue");
  }
  const models = value.semantic_models.map(parseModel);
  if (new Set(models.map((model) => model.id)).size !== models.length)
    throw new Error("Duplicate semantic model ID");
  catalogue = { models, tabs: [value.guide_tabs[0], value.guide_tabs[1]] };
}

export function getSemanticModels() {
  return catalogue.models;
}

export function getModelGuideTabs() {
  return catalogue.tabs;
}
