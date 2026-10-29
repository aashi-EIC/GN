import type { SemanticModel } from "../../features/chat/types/semantic";

export type ModelContent = Omit<SemanticModel, "id" | "name" | "short">;

export const modelContent: Readonly<Partial<Record<string, ModelContent>>> = {
  schedule_completeness_tsg: {
    description:
      "Provides a standardized, transparent view of linear-channel schedule completeness across current day through 14-day horizons.",
    guide:
      "Schedule Completeness (TSG) is intended to provide a standardized, transparent view of how complete and usable linear-channel schedules are by quantifying content that is:",
    nickname: "Schedule Completeness",
    color: "#9B1B5A",
    prompts: [
      "What was Telenet's monthly TBA completeness in 2026?",
      "For the same period, how many channels did Telenet have?",
      "Compare the results for Amazon, Telenet, and Apple.",
      "Compare monthly TBA completeness for Sky Media, Telenet, and Joyn in 2026.",
      "Show the 20 channels and PrgSvcIDs with the largest decline in TBA completeness from January to May 2026.",
      "Which clients had the biggest impact on schedule completeness?",
    ],
    highlights: [
      {
        label: "Coverage Horizon",
        value: "14 Days",
      },
      {
        label: "Evaluation Cycle",
        value: "24-Hour",
      },
      {
        label: "Core Categories",
        value: "TBA / Sign-off / Generic",
      },
    ],
    objectiveHeading: "Overall Objective",
    objective:
      "Schedule Completeness (TSG) is intended to provide a standardized, transparent view of how complete and usable linear-channel schedules are by quantifying content that is:",
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
    objectiveSummary:
      "These conditions are converted into completeness metrics across channels and future airing horizons, enabling users to assess schedule readiness, identify gaps, and monitor improvement over time. The metric represents the percentage of complete content hours - not an error rate - and is calculated using 24-hour cycles across the current day through a 14-day horizon.",
    objectiveNote:
      "Calculated using 24-hour cycles (current day through 14-day horizon). The metric represents the percentage of complete content hours — not an error rate.",
    businessHeading: "Business Purpose",
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
  },
  mapping_stats_vod: {
    description:
      "Measures VOD mapping performance, volume, and median turnaround time for assets created since 2019 across entitled catalogs.",
    guide:
      "Mapping Stats (VOD) is intended to provide a standardized view of VOD mapping performance across all entitled catalogs. Its core purpose is to measure mapping volume and turnaround time for assets created since 2019, with analysis by mapping status, availability window, create-date range, C2M/turnaround time, and individual assets. It also supports weekly, monthly, and yearly trend analysis.",
    nickname: "VOD Mapping Performance",
    color: "#94073F",
    prompts: [
      "What is the VOD mapping percentage by provider this month?",
      "Show weekly trends for mapped, to-be-mapped, and unmappable assets",
      "Which providers have the highest median C2M turnaround time?",
      "Identify backlog spikes and delayed assets by mapping scheme",
      "Compare this month's VOD mapping performance with last month",
      "Show unmappable assets that require investigation",
    ],
    highlights: [
      {
        label: "Asset Volume",
        value: "~35 Million",
      },
      {
        label: "Historical Catalog",
        value: "2019 - Present",
      },
      {
        label: "Key Performance Metric",
        value: "C2M Turnaround Time",
      },
      {
        label: "Mapping Categories",
        value: "Mapped / TBM / Unmappable",
      },
    ],
    objectiveHeading: "Overall Objective",
    objective:
      "Mapping Stats (VOD) is intended to provide a standardized view of VOD mapping performance across all entitled catalogs. Its core purpose is to measure mapping volume and turnaround time for assets created since 2019, with analysis by mapping status, availability window, create-date range, C2M/turnaround time, and individual assets. It also supports weekly, monthly, and yearly trend analysis.",
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
    objectiveSummary:
      "It provides visibility into approximately 35 million VOD assets, categorized as Mapped, To Be Mapped, or Unmappable, with drill-through to individual assets for backlog and exception investigation.",
    objectiveNote:
      "Provides visibility into approximately 35 million VOD assets with drill-through to individual assets for backlog and exception investigation.",
    businessHeading: "Business Purpose",
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
    quickTip: "Filter by create-date range to analyze turnaround time bottlenecks.",
  },
  cpx_metrics: {
    description:
      "Combines operational, service, delivery, and adoption signals into a consistent view of customer health across CPX, helping teams identify risks, prioritize action, and recognize growth opportunities.",
    guide:
      "CPX Metrics including Customer Health Score is designed to provide a standardized, data-driven view of customer health across the CPX organization. It brings together operational, service, delivery, and adoption signals—including completeness, response, resolution, engagement, adoption/usage, satisfaction, and NPS—into a consistent view that helps teams understand account health, identify emerging risks, prioritize interventions, and recognize growth opportunities.",
    nickname: "Customer Health Score",
    color: "#9B1B5A",
    prompts: [
      "Show the Customer Health Score by account.",
      "Which accounts have the lowest Customer Health Scores?",
      "Compare ticket volume, response time, and resolution time across accounts.",
      "Which accounts have low adoption or usage?",
      "Show customer satisfaction and NPS by account.",
      "Compare schedule completeness and VOD mapping turnaround across accounts.",
    ],
    highlights: [
      {
        label: "Consolidated View",
        value: "Customer Health Score",
      },
      {
        label: "Documented Scope",
        value: "Approximately 73 clients",
      },
      {
        label: "Refresh Cycle",
        value: "Weekly",
      },
    ],
    objectiveHeading: "Overall Objective",
    objective:
      "CPX Metrics including Customer Health Score is designed to provide a standardized, data-driven view of customer health across the CPX organization. It brings together operational, service, delivery, and adoption signals—including completeness, response, resolution, engagement, adoption/usage, satisfaction, and NPS—into a consistent view that helps teams understand account health, identify emerging risks, prioritize interventions, and recognize growth opportunities.",
    objectiveSummary:
      "The dashboard is intended to move CPX from reactive, fragmented reporting toward a proactive operating model, using a common view of customer health to support regular review, accountability, and action. The Customer Health Score provides the consolidated health perspective, while the underlying metrics retain the detail needed to explain why an account is healthy, at risk, or requires attention.",
    businessHeading: "Business Purpose",
    businessPurpose:
      "CPX Metrics including Customer Health Score serves as a shared decision-support layer. Its purpose is to:",
    businessPoints: [
      "Establish a single source of truth for customer-health prioritization and provide a consistent view of performance across accounts.",
      "Combine customer-facing and operational signals—such as schedule completeness, VOD asset volume and mapping turnaround, ticket volume, response time, resolution time, engagement, adoption, and satisfaction—so teams can interpret customer health in context.",
      "Enable proactive identification of renewal and churn risk, service-quality issues, adoption gaps, and potential expansion opportunities.",
      "Support client reviews, QBRs, internal prioritization, and targeted action planning by allowing users to move from an overall health signal to the underlying account and metric detail.",
      "Replace manual, spreadsheet-based reporting with a sustainable BI view that is refreshed weekly and available for internal use across the documented CPX Metrics scope of approximately 73 clients.",
      "Help CSMs and internal teams monitor data coverage and delivery KPIs, anticipate issues before clients raise them, and use evidence-based insights in customer conversations.",
    ],
    quickTip:
      "Start with the Customer Health Score, then explore the underlying metrics to understand which accounts need attention.",
  },
};
