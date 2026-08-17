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
  mapping_stats_svc: [
    "How long are provider imports taking today?",
    "Which sources have processing bottlenecks?",
    "Show match rates and delay trends by provider",
    "Flag providers outside the expected processing time",
    "Compare today's mapping performance with last week",
    "Which providers have the lowest match rates?",
  ],
  schedule_completeness_tsg: [
    "Are there any 'TBA' slots in tomorrow's schedule?",
    "Show schedule completeness for next week",
    "Where are the largest schedule coverage gaps?",
    "Compare schedule completeness across markets",
    "Which channels need attention before air time?",
    "Prioritize the most urgent schedule issues",
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

export function getCountryLocale(_countryCode?: CountryCode): CountryLocale {
  return countryLocales.US;
}


