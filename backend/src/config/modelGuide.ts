import { z } from "zod";
import { ConfigurationError } from "../errors.js";

const text = (maximum: number) => z.string().trim().min(1).max(maximum);
const objective = z
  .object({
    heading: text(160).default("Overall Objective"),
    lead: text(5_000),
    points: z
      .array(z.object({ label: text(160).optional(), text: text(2_000) }).strict())
      .max(30)
      .default([]),
    summary: text(5_000).optional(),
    note: text(2_000).optional(),
  })
  .strict();
const businessPurpose = z
  .object({
    heading: text(160).default("Business Purpose"),
    lead: text(5_000),
    points: z.array(text(2_000)).max(30).default([]),
    summary: text(5_000).optional(),
  })
  .strict();
const model = z
  .object({
    id: text(256).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/),
    name: text(160),
    short: text(20),
    nickname: text(160).optional(),
    color: z
      .string()
      .regex(/^#[a-f0-9]{6}$/i)
      .default("#9B1B5A"),
    description: text(2_000),
    highlights: z
      .array(z.object({ label: text(160), value: text(300) }).strict())
      .max(20)
      .default([]),
    overview: z
      .object({
        objective: objective.optional(),
        businessPurpose: businessPurpose.optional(),
        quickTip: text(2_000).optional(),
      })
      .strict(),
    suggestedPrompts: z.array(text(2_000)).max(30).default([]),
    enabled: z.boolean().default(true),
  })
  .strict();
const guideSchema = z
  .object({
    modelGuide: z
      .object({
        tabs: z.tuple([text(80), text(80)]),
        models: z.array(model).min(1).max(100),
      })
      .strict(),
  })
  .strict()
  .superRefine(({ modelGuide }, context) => {
    const seen = new Set<string>();
    for (const entry of modelGuide.models) {
      if (seen.has(entry.id)) context.addIssue({ code: "custom", message: "Duplicate model ID" });
      seen.add(entry.id);
    }
    if (!modelGuide.models.some((entry) => entry.enabled)) {
      context.addIssue({ code: "custom", message: "At least one model must be enabled" });
    }
  });

export function parseModelGuide(value: unknown, excludedIds: readonly string[] = []) {
  const parsed = guideSchema.safeParse(value);
  if (!parsed.success) throw new ConfigurationError("Invalid semantic model guide");
  const { tabs, models } = parsed.data.modelGuide;
  const excluded = new Set(excludedIds);
  const enabledModels = models.filter((entry) => entry.enabled && !excluded.has(entry.id));
  if (!enabledModels.length) throw new ConfigurationError("No semantic models are available");
  return {
    tabs,
    models: enabledModels.map((entry) => ({
      id: entry.id,
      name: entry.name,
      short: entry.short,
      nickname: entry.nickname ?? "",
      color: entry.color,
      description: entry.description,
      guide: entry.overview.objective?.lead ?? entry.description,
      highlights: entry.highlights,
      objectiveHeading: entry.overview.objective?.heading,
      objective: entry.overview.objective?.lead,
      objectivePoints: entry.overview.objective?.points,
      objectiveSummary: entry.overview.objective?.summary,
      objectiveNote: entry.overview.objective?.note,
      businessHeading: entry.overview.businessPurpose?.heading,
      businessPurpose: entry.overview.businessPurpose?.lead,
      businessPoints: entry.overview.businessPurpose?.points,
      businessSummary: entry.overview.businessPurpose?.summary,
      quickTip: entry.overview.quickTip,
      prompts: entry.suggestedPrompts,
    })),
  };
}

export type SemanticModelDefinition = ReturnType<typeof parseModelGuide>["models"][number];
