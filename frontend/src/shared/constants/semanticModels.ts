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
      "Schedule Completeness (TSG) is intended to provide a standardized, transparent view of how complete and usable linear-channel schedules are by quantifying content that is:",
    objectiveSummary:
      "These conditions are converted into completeness metrics across channels and future airing horizons, enabling users to assess schedule readiness, identify gaps, and monitor improvement over time. The metric represents the percentage of complete content hours - not an error rate - and is calculated using 24-hour cycles across the current day through a 14-day horizon.",
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
      "It serves as a single source of truth for schedule-quality insights. It supports:",
    businessPoints: [
      "Client and entitlement-level information",
      "Channel-level investigation",
      "Daily, weekly, and monthly trend analysis",
      "Identification of scheduling issues and air-time discrepancies",
      "Transparent discussions in client meetings and QBRs",
    ],
    businessSummary:
      "In short, the objective is to help understand whether schedules are sufficiently populated for upcoming broadcasts, where completeness is weak, and how schedule quality changes as the airing date approaches.",
    quickTip: "100% means the schedule is complete without TBA content.",
    highlights: [
      { label: "Coverage Horizon", value: "14 Days" },
      { label: "Evaluation Cycle", value: "24-Hour" },
      { label: "Target Quality", value: "100% Complete" },
      { label: "Core Categories", value: "TBA / Sign-off / Generic" },
    ],
    color: "#9B1B5A",
    prompts: [
      "What was Telenet's monthly TBA completeness in 2026?",
      "For the same period, how many channels did Telenet have?",
      "Compare the results for Amazon, Telenet, and Apple.",
      "Compare monthly TBA completeness for Sky Media, Telenet, and Joyn in 2026.",
      "Show the 20 channels and PrgSvcIDs with the largest decline in TBA completeness from January to May 2026.",
      "Which clients had the biggest impact on schedule completeness?",
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
      "Provides visibility into approximately 35 million VOD assets (Mapped, To Be Mapped, Unmappable) with drill-through capabilities.",
    objective:
      "Mapping Stats (VOD) is intended to provide a standardized view of VOD mapping performance across all entitled catalogs. Its core purpose is to measure mapping volume and turnaround time for assets created since 2019, with analysis by mapping status, availability window, create-date range, C2M/turnaround time, and individual assets. It also supports weekly, monthly, and yearly trend analysis.",
    objectiveSummary:
      "It provides visibility into approximately 35 million VOD assets, categorized as Mapped, To Be Mapped, or Unmappable, with drill-through to individual assets for backlog and exception investigation.",
    objectiveNote:
      "Provides visibility into approximately 35 million VOD assets with drill-through to individual assets for backlog and exception investigation.",
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
    businessPurpose: "It serves as a single source of truth for VOD mapping insights. It supports:",
    businessPoints: [
      "Monitor the operational health and efficiency of VOD mapping",
      "Track mapped volumes, mapping percentages, and median turnaround time",
      "Identify backlog spikes, delayed assets, and high levels of unmappable content",
      "Investigate the underlying assets and mapping schemes causing performance issues",
      "Use historical trends to assess consistency and proactively address problems before they become client concerns",
    ],
    businessSummary:
      "In short, Mapping Stats (VOD) provides transparent, client-specific evidence of how efficiently VOD assets are mapped and made available, supporting operational oversight, client conversations, backlog management, and continuous process improvement.",
    highlights: [
      { label: "Asset Volume", value: "~35 Million" },
      { label: "Historical Catalog", value: "2019 - Present" },
      { label: "Key Performance Metric", value: "C2M Turnaround Time" },
      { label: "Mapping Categories", value: "Mapped / TBM / Unmappable" },
    ],
    quickTip: "Filter by create-date range to analyze turnaround time bottlenecks.",
    color: "#94073F",
    prompts: [
      "What is the VOD mapping percentage by provider this month?",
      "Show weekly trends for mapped, to-be-mapped, and unmappable assets",
      "Which providers have the highest median C2M turnaround time?",
      "Identify backlog spikes and delayed assets by mapping scheme",
      "Compare this month's VOD mapping performance with last month",
      "Show unmappable assets that require investigation",
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
