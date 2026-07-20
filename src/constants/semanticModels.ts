import type { CountryCode, SemanticModel } from "../types/semantic";

export const semanticModels: SemanticModel[] = [
  {
    id: "imagenary_stats",
    name: "Imagenary Stats",
    short: "IS",
    description: "Image asset coverage, rendition readiness and editorial QA.",
    guide:
      "Answers questions about poster coverage, backdrop availability, missing image assets, rendition readiness and image QA status.",
    color: "#F40953",
    prompts: [
      "Show image readiness by content type",
      "Which markets have missing image assets?",
      "List image QA issues by priority",
    ],
  },
  {
    id: "linear_country_grading",
    name: "Linear Country Grading",
    short: "LCG",
    description: "Country-level linear feed grades, SLA risk and market health.",
    guide:
      "Answers questions about country grades, feed readiness, SLA status, ingestion risk and country-level quality trends.",
    color: "#002041",
    prompts: [
      "Show country grades by market",
      "Which countries are below target?",
      "Compare linear readiness by region",
    ],
  },
  {
    id: "mapping_stats",
    name: "Mapping Stats",
    short: "MS",
    description: "Match rates, unresolved mappings and source health.",
    guide:
      "Answers questions about source match rates, unresolved queues, aging records, partner imports and mapping remediation priorities.",
    color: "#94073F",
    prompts: [
      "Which sources have low match rates?",
      "Show unresolved mappings by queue",
      "Summarize this week's mapping health",
    ],
  },
  {
    id: "metadata_stats_linear",
    name: "Metadata Stats Linear",
    short: "MSL",
    description: "Linear metadata completeness, stale fields and enrichment quality.",
    guide:
      "Answers questions about linear metadata completeness, stale attributes, artwork gaps, genres, cast coverage and enrichment backlogs.",
    color: "#2563EB",
    prompts: [
      "How complete is linear metadata?",
      "Show metadata quality by content type",
      "List the top linear metadata issues",
    ],
  },
  {
    id: "program_gaps",
    name: "Program Gaps",
    short: "PG",
    description: "Open schedule gaps, late-night gaps and remediation queues.",
    guide:
      "Answers questions about program gaps, late-night programming, missing slots, market gap counts and operational remediation priorities.",
    color: "#B60B46",
    prompts: [
      "Show program gaps by country",
      "Where are the largest late-night gaps?",
      "Rank markets by open program gaps",
    ],
  },
  {
    id: "schedule_completeness",
    name: "Schedule Completeness",
    short: "SC",
    description: "Coverage, gaps and delivery quality across reporting markets.",
    guide:
      "Answers questions about schedule coverage, open gaps, late-night programming, market readiness and week-over-week completeness movement.",
    color: "#005D8F",
    prompts: [
      "Show completeness by market",
      "Where are the largest schedule gaps?",
      "Compare this week to last week",
    ],
  },
  {
    id: "usage_metric_bia_dashboard",
    name: "Usage Metric Bia Dashboard",
    short: "BIA",
    description: "BIA dashboard usage, active users and engagement signals.",
    guide:
      "Answers questions about dashboard usage, active users, query volume, country adoption and feature engagement trends.",
    color: "#047857",
    prompts: [
      "Show BIA usage by country",
      "Which dashboard features are used most?",
      "Compare active users week over week",
    ],
  },
];

export const countries: Array<{ code: CountryCode; name: string }> = [
  { code: "us", name: "United States" },
  { code: "in", name: "India" },
  { code: "gb", name: "United Kingdom" },
  { code: "br", name: "Brazil" },
  { code: "jp", name: "Japan" },
  { code: "de", name: "Germany" },
];
