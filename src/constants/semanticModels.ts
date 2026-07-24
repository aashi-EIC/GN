import type { CountryCode, SemanticModel } from "../types/semantic";

export const semanticModels: SemanticModel[] = [
  {
    id: "metadata_stats_linear",
    name: "Metadata Stats Linear",
    short: "MSL",
    nickname: 'The "Text Checker"',
    description:
      'The "Text Checker" — Checks whether every movie and TV show has basic written information filled in like Title, Cast, Genre, and Description.',
    guide:
      "Checks basic written info (title, cast, genre, description). Without this info, viewers cannot find shows using search. Analogy: Checking if a library book has its title and author printed on the cover so people can find it.",
    color: "#2563EB",
    prompts: [
      "Which content has missing metadata fields?",
      "Show linear metadata completeness by genre",
      "List top metadata issues affecting search",
    ],
  },
  {
    id: "imagerystats_vod",
    name: "Imagery Stats VOD",
    short: "VOD",
    nickname: 'The "Picture Checker"',
    description:
      'The "Picture Checker" — Verifies whether every movie and TV show has all visual assets (posters, thumbnails, hero banners).',
    guide:
      "Checks visual assets (poster, thumbnail, hero banner). Without pictures, homepage recommendations show blank boxes. Analogy: Checking if every product on an e-commerce website has a photo so buyers click.",
    color: "#F40953",
    prompts: [
      "Which titles are missing poster or hero images?",
      "Show image asset readiness by market",
      "List titles with missing visual assets by priority",
    ],
  },
  {
    id: "mapping_stats_svc",
    name: "Mapping Stats Service",
    short: "MSS",
    nickname: 'The "Speedometer"',
    description:
      'The "Speedometer" — Measures how long it takes for a new show sent by a provider (Disney, Sony) to be processed and recognized.',
    guide:
      "Measures intake processing speed from content providers. If this slows down, new episodes don't appear on time. Analogy: A post office sorting facility measuring the time for a package to arrive, get scanned, and hit the delivery truck.",
    color: "#94073F",
    prompts: [
      "How long are provider imports taking today?",
      "Which sources have processing bottlenecks?",
      "Show match rates and delay trends by provider",
    ],
  },
  {
    id: "schedule_completeness_tsg",
    name: "Schedule Completeness TSG",
    short: "SC",
    nickname: 'The "TV Guide Protector"',
    description:
      'The "TV Guide Protector" — Ensures upcoming TV schedules are fully filled in without "TBA" or generic placeholders.',
    guide:
      "Verifies upcoming TV schedules are full of real show titles rather than 'TBA' placeholders. Analogy: A newspaper printing press checking if tomorrow's newspaper has empty spaces before printing.",
    color: "#005D8F",
    prompts: [
      "Are there any 'TBA' slots in tomorrow's schedule?",
      "Show schedule completeness for next week",
      "Where are the largest schedule coverage gaps?",
    ],
  },
  {
    id: "program_gaps_svc",
    name: "Program Gaps Service",
    short: "PGS",
    nickname: 'The "Missing Child Detector"',
    description:
      'The "Missing Child Detector" — Compares contracted show counts against actually available shows to find missing titles.',
    guide:
      "Compares contracted titles against live platform titles to find missing content. Analogy: Taking inventory by counting what is supposed to be in your warehouse versus what is actually on the shelves.",
    color: "#B60B46",
    prompts: [
      "Which contracted shows are missing from the platform?",
      "Compare contract show counts against live titles",
      "List missing programs by provider and country",
    ],
  },
  {
    id: "linear_country_grading",
    name: "Linear Country Grading",
    short: "LCG",
    nickname: 'The "Executive Report Card"',
    description:
      'The "Executive Report Card" — Combines quality metrics across metadata, imagery, schedule & gaps into an overall A, B, C, or D grade for each country.',
    guide:
      "Combines metadata, imagery, and schedule health into one overall A, B, C, or D grade per country. Analogy: A high school report card summarizing all subjects into one overall grade for executive leaders.",
    color: "#002041",
    prompts: [
      "Show overall report card grades by country",
      "Which countries are below target health grade?",
      "Compare overall market grades this month",
    ],
  },
  {
    id: "usage_metrics_bia_dashboards",
    name: "Usage Metrics BIA Dashboards",
    short: "BIA",
    nickname: 'The "Customer Engagement Checker"',
    description:
      'The "Customer Engagement Checker" — Tracks whether invited users are actively logging in, opening reports, and using the system.',
    guide:
      "Tracks user logins, report usage, and active customer signals. Analogy: A gym check-in system measuring whether members actually show up to work out to prove subscription value.",
    color: "#047857",
    prompts: [
      "Which dashboards have the highest active logins?",
      "Show client engagement trends by country",
      "Identify accounts with low dashboard usage",
    ],
  },
];

export const countries: Array<{ code: CountryCode; name: string }> = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "ES", name: "Spain" },
  { code: "BR", name: "Brazil" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
];
