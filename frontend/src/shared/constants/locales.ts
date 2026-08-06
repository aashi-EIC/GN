import type { CountryCode } from "../../features/chat/types/semantic";

export interface CountryLocale {
  code: CountryCode;
  speechLocale: string;
  welcomeGreeting: (name: string) => string;
  placeholder?: string;
  sendLabel: string;
  prompts: Record<string, string[]>;
}

const defaultEnglishPrompts = {
  metadata_stats_linear: [
    "Which content has missing metadata fields?",
    "Show linear metadata completeness by genre",
    "List top metadata issues affecting search",
  ],
  imagerystats_vod: [
    "Which titles are missing poster or hero images?",
    "Show image asset readiness by market",
    "List titles with missing visual assets by priority",
  ],
  mapping_stats_svc: [
    "How long are provider imports taking today?",
    "Which sources have processing bottlenecks?",
    "Show match rates and delay trends by provider",
  ],
  schedule_completeness_tsg: [
    "Are there any 'TBA' slots in tomorrow's schedule?",
    "Show schedule completeness for next week",
    "Where are the largest schedule coverage gaps?",
  ],
  program_gaps_svc: [
    "Which contracted shows are missing from the platform?",
    "Compare contract show counts against live titles",
    "List missing programs by provider and country",
  ],
  linear_country_grading: [
    "Show overall report card grades by country",
    "Which countries are below target health grade?",
    "Compare overall market grades this month",
  ],
  usage_metrics_bia_dashboards: [
    "Which dashboards have the highest active logins?",
    "Show client engagement trends by country",
    "Identify accounts with low dashboard usage",
  ],
};

export const countryLocales: Record<CountryCode, CountryLocale> = {
  US: {
    code: "US",
    speechLocale: "en-US",
    welcomeGreeting: (name) => `Hello, ${name}! How can I help you today?`,
    sendLabel: "Send",
    prompts: defaultEnglishPrompts,
  },
};

export function getCountryLocale(countryCode?: CountryCode): CountryLocale {
  return countryLocales.US;
}


