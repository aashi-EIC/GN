import type { CountryCode, SemanticModel } from "../../features/chat/types/semantic";

export const semanticModels: SemanticModel[] = [
  {
    id: "schedule_completeness_tsg",
    name: "Schedule Completeness TSG",
    short: "SC",
    nickname: 'The "TV Guide Protector"',
    description:
      'The "TV Guide Protector" - Ensures upcoming TV schedules are fully filled in without "TBA" or generic placeholders.',
    guide:
      "Verifies upcoming TV schedules are full of real show titles rather than 'TBA' placeholders. Analogy: A newspaper printing press checking if tomorrow's newspaper has empty spaces before printing.",
    color: "#005D8F",
    prompts: [
      "Are there any 'TBA' slots in tomorrow's schedule?",
      "Show schedule completeness for next week",
      "Where are the largest schedule coverage gaps?",
      "Compare schedule completeness across markets",
      "Which channels need attention before air time?",
      "Prioritize the most urgent schedule issues",
    ],
  },
  {
    id: "mapping_stats_svc",
    name: "Mapping Stats Service",
    short: "MSS",
    nickname: 'The "Speedometer"',
    description:
      'The "Speedometer" - Measures how long it takes for a new show sent by a provider (Disney, Sony) to be processed and recognized.',
    guide:
      "Measures intake processing speed from content providers. If this slows down, new episodes don't appear on time. Analogy: A post office sorting facility measuring the time for a package to arrive, get scanned, and hit the delivery truck.",
    color: "#94073F",
    prompts: [
      "How long are provider imports taking today?",
      "Which sources have processing bottlenecks?",
      "Show match rates and delay trends by provider",
      "Flag providers outside the expected processing time",
      "Compare today's mapping performance with last week",
      "Which providers have the lowest match rates?",
    ],
  },
];

export function replaceSemanticModels(models: SemanticModel[]) {
  if (!models.length) return;
  semanticModels.splice(0, semanticModels.length, ...models);
}

export const countries: Array<{ code: CountryCode; name: string }> = [
  { code: "US", name: "United States" },
];
