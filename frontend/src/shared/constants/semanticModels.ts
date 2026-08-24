import type { CountryCode, SemanticModel } from "../../features/chat/types/semantic";

export const semanticModels: SemanticModel[] = [
  {
    id: "schedule_completeness_tsg",
    name: "Schedule Completeness TSG",
    short: "TSG",
    nickname: "Schedule Completeness",
    description:
      "Provides a standardized, transparent view of linear-channel schedule completeness across current day through 14-day horizons.",
    guide:
      "Quantifies content availability (TBA, Sign-off, Generic) converted into completeness metrics across channels and airing horizons.",
    objective:
      "Schedule Completeness (TSG) provides a standardized, transparent view of how complete and usable linear-channel schedules are across 24-hour cycles from the current day through a 14-day horizon.",
    objectiveNote:
      "Calculated using 24-hour cycles (current day through 14-day horizon). The metric represents the percentage of complete content hours — not an error rate.",
    objectivePoints: [
      {
        label: "TBA",
        text: "Programming information is not available for scheduled air times.",
      },
      {
        label: "Sign-off",
        text: "The channel is off-air and not broadcasting during this period.",
      },
      {
        label: "Generic",
        text: "Channel day is marked generic based on editorial assessment or scheduling patterns.",
      },
    ],
    businessPurpose:
      "Serves as a single source of truth for schedule-quality insights. Helps understand whether schedules are sufficiently populated for upcoming broadcasts, where completeness is weak, and how schedule quality changes as the airing date approaches.",
    businessPoints: [
      "Client and entitlement-level information",
      "Channel-level investigation",
      "Daily, weekly, and monthly trend analysis",
      "Identification of scheduling issues and air-time discrepancies",
      "Transparent discussions in client meetings and QBRs",
    ],
    quickTip: "100% means the schedule is complete without TBA content.",
    highlights: [
      { label: "Coverage Horizon", value: "14 Days" },
      { label: "Evaluation Cycle", value: "24-Hour" },
      { label: "Target Quality", value: "100% Complete" },
      { label: "Core Categories", value: "TBA / Sign-off / Generic" },
    ],
    color: "#005D8F",
    prompts: [
      "What is the monthly TBA Completeness for telenet in 2026 ?",
      "for same time period can you check channel count for same client",
      "can you compare same result between amazon, telenet and apple clients",
      "can you compare tba completeness between sky media, telenet and joyn clients in 2026 monthly",
      "show 20 channels along with prgsvcid which have maximum decline in TBA completness from jan 2026 to may 2026 monthly",
      "biggest impact on which clients",
    ],
  },
  {
    id: "mapping_stats_vod",
    name: "Mapping Stats VOD",
    short: "VOD",
    nickname: "VOD Mapping Performance",
    description:
      "Measures VOD mapping performance, volume, and median turnaround time for assets created since 2019 across entitled catalogs.",
    guide:
      "Provides visibility into ~18 million VOD assets (Mapped, To Be Mapped, Unmappable) with drill-through capabilities.",
    objective:
      "Mapping Stats (VOD) provides a standardized view of VOD mapping performance across all entitled catalogs. Its core purpose is to measure mapping volume and turnaround time (C2M) for assets created since 2019.",
    objectiveNote:
      "Provides visibility into ~18 million VOD assets with drill-through to individual assets for backlog and exception investigation.",
    objectivePoints: [
      {
        label: "Mapped",
        text: "Assets successfully matched and available in catalog.",
      },
      {
        label: "To Be Mapped",
        text: "Assets currently in queue awaiting mapping turnaround.",
      },
      {
        label: "Unmappable",
        text: "Exception assets requiring investigation and manual resolution.",
      },
    ],
    businessPurpose:
      "Serves as a single source of truth for VOD mapping insights. Provides transparent, client-specific evidence of how efficiently VOD assets are mapped and made available.",
    businessPoints: [
      "Monitor the operational health and efficiency of VOD mapping",
      "Track mapped volumes, mapping percentages, and median turnaround time",
      "Identify backlog spikes, delayed assets, and high levels of unmappable content",
      "Investigate underlying assets and mapping schemes causing performance issues",
      "Use historical trends to assess consistency and proactively address problems before client concerns",
    ],
    highlights: [
      { label: "Asset Volume", value: "~18 Million" },
      { label: "Historical Catalog", value: "2019 - Present" },
      { label: "Key Performance Metric", value: "C2M Turnaround Time" },
      { label: "Mapping Categories", value: "Mapped / TBM / Unmappable" },
    ],
    quickTip: "Filter by create-date range to analyze turnaround time bottlenecks.",
    color: "#94073F",
    prompts: [
      "How long are VOD provider imports taking today?",
      "Which VOD sources have processing bottlenecks?",
      "Show match rates and delay trends by VOD provider",
      "Flag VOD providers outside the expected processing time",
      "Compare today's VOD mapping performance with last week",
      "Which VOD providers have the lowest match rates?",
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
