const COMMON_STARTERS_AND_GREETINGS = new Set([
  "hello", "hi", "hey", "can", "could", "would", "will", "shall", "should", "may",
  "might", "must", "please", "pls", "thanks", "thank", "good", "morning", "afternoon",
  "evening", "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
  "show", "tell", "give", "display", "list", "find", "get", "compare", "identify",
  "explain", "check", "see", "look", "analyze", "run", "calculate", "is", "are",
  "was", "were", "do", "does", "did", "have", "has", "had", "for", "with", "from",
  "about", "this", "that", "these", "those", "there", "here", "just", "now", "also",
  "your", "our", "their", "my", "its", "some", "any", "all", "each", "every",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december"
]);

const DOMAIN_ACRONYMS = new Set([
  "tsg", "vod", "tba", "c2m", "prgsvcid", "prgsvcids", "tbm", "ott", "fast", "linear",
  "kpi", "roi", "yoy", "mom", "qoq"
]);

const KNOWN_ENTITIES = [
  "Sky Media", "Telenet", "Joyn", "Amazon", "Apple", "Netflix", "Disney",
  "Paramount", "Warner", "Comcast", "Charter", "Roku", "Hulu", "Peacock", "YouTube"
];

const KNOWN_CONCEPTS: Array<{ match: RegExp; label: string }> = [
  { match: /\b(?:TBA|to\s*be\s*announced)\s+completeness\b/i, label: "TBA completeness" },
  { match: /\bschedule\s+completeness\b/i, label: "schedule completeness" },
  { match: /\bVOD\s+mapping(?:\s+performance|\s+percentage)?\b/i, label: "VOD mapping performance" },
  { match: /\b(?:C2M|turnaround)\s*(?:time)?\b/i, label: "C2M turnaround time" },
  { match: /\bunmappable\s+assets?\b/i, label: "unmappable assets" },
  { match: /\b(?:to\s*be\s*mapped|TBM)\s*(?:assets?)?\b/i, label: "pending mapping queue" },
  { match: /\bmapped\s+assets?\b/i, label: "mapped assets" },
  { match: /\bPrgSvcIDs?\b/i, label: "PrgSvcID records" },
  { match: /\blinear[\s-]channels?\b/i, label: "linear channels" },
  { match: /\bchannels?\b/i, label: "channel schedules" },
  { match: /\bbacklog\s*(?:spikes?)?\b/i, label: "backlog volume" },
  { match: /\bmapping\s+schemes?\b/i, label: "mapping schemes" },
  { match: /\bTSG\b/i, label: "Schedule Completeness TSG" },
  { match: /\bVOD\b/i, label: "VOD mapping" },
  { match: /\bTBA\b/i, label: "TBA completeness" },
  { match: /\bassets?\b/i, label: "catalog assets" },
  { match: /\bproviders?\b/i, label: "provider distributions" },
  { match: /\bclients?\b/i, label: "client entitlements" },
];

export interface ExtractedAnalysisContext {
  entities: string[];
  concepts: string[];
  timeframes: string[];
  isComparison: boolean;
  primaryTopic: string;
}

/**
 * Extracts distinct entities, metrics, concepts, and timeframes from the user prompt.
 */
export function extractAnalysisContext(prompt?: string): ExtractedAnalysisContext {
  if (!prompt || typeof prompt !== "string") {
    return { entities: [], concepts: [], timeframes: [], isComparison: false, primaryTopic: "" };
  }

  const text = prompt.trim();

  // 1. Known entities (providers/clients)
  const entities: string[] = [];
  for (const entity of KNOWN_ENTITIES) {
    if (new RegExp(`\\b${entity}\\b`, "i").test(text)) {
      entities.push(entity);
    }
  }

  // Quoted terms as entities (if not domain acronym or common starter)
  const quoteRegex = /["'“‘]([^"'”’]+)["'”’]/g;
  let quoteMatch: RegExpExecArray | null;
  while ((quoteMatch = quoteRegex.exec(text)) !== null) {
    const term = quoteMatch[1].trim();
    const termLower = term.toLowerCase();
    if (
      term.length >= 2 &&
      !DOMAIN_ACRONYMS.has(termLower) &&
      !COMMON_STARTERS_AND_GREETINGS.has(termLower) &&
      !entities.includes(term)
    ) {
      entities.push(term);
    }
  }

  // Capitalized proper names that aren't domain acronyms or common starters
  const capRegex = /\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*\b/g;
  let capMatch: RegExpExecArray | null;
  while ((capMatch = capRegex.exec(text)) !== null) {
    const val = capMatch[0].trim();
    const valLower = val.toLowerCase();
    if (
      val.length > 2 &&
      !COMMON_STARTERS_AND_GREETINGS.has(valLower) &&
      !DOMAIN_ACRONYMS.has(valLower) &&
      !entities.some((e) => e.toLowerCase() === valLower) &&
      entities.length < 3
    ) {
      entities.push(val);
    }
  }

  // 2. Concepts & metrics
  const concepts: string[] = [];
  for (const { match, label } of KNOWN_CONCEPTS) {
    if (match.test(text) && !concepts.includes(label)) {
      concepts.push(label);
    }
  }

  // 3. Timeframes & horizons
  const timeframes: string[] = [];
  const yearMatch = text.match(/\b(20\d\d)\b/);
  if (yearMatch) timeframes.push(yearMatch[1]);

  const quarterMatch = text.match(/\b(Q[1-4](?:\s*20\d\d)?)\b/i);
  if (quarterMatch) timeframes.push(quarterMatch[1].toUpperCase());

  if (/\bmonthly\b/i.test(text)) timeframes.push("monthly");
  else if (/\bweekly\b/i.test(text)) timeframes.push("weekly");
  else if (/\bthis\s+month\b/i.test(text)) timeframes.push("current month");
  else if (/\blast\s+month\b/i.test(text)) timeframes.push("prior month");

  const monthRangeMatch = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+to\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b/i,
  );
  if (monthRangeMatch) timeframes.push(monthRangeMatch[0]);

  // 4. Comparison detection
  const isComparison =
    /\b(compare|comparison|versus|vs\.?|difference\s+between)\b/i.test(text) || entities.length >= 2;

  // 5. Fallback primary topic
  let primaryTopic = concepts[0] || "";
  if (!primaryTopic && entities.length > 0) {
    primaryTopic = entities[0];
  } else if (!primaryTopic) {
    const fallbackWords = text
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !COMMON_STARTERS_AND_GREETINGS.has(w.toLowerCase()));
    if (fallbackWords.length > 0) {
      primaryTopic = fallbackWords.slice(0, 2).join(" ");
    }
  }

  return { entities, concepts, timeframes, isComparison, primaryTopic };
}

/**
 * Returns raw extracted keywords for external consumption.
 */
export function extractKeywords(prompt?: string): string[] {
  const ctx = extractAnalysisContext(prompt);
  return [...ctx.entities, ...ctx.concepts, ...ctx.timeframes].slice(0, 3);
}

/**
 * Generates an attractive, professional analytical sequence of reasoning stages
 * tailored seamlessly to the user query without synthetic-looking quote templates.
 */
export function generateThinkingSteps(prompt?: string): string[] {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return [
      "Interpreting analytical intent…",
      "Scanning Gracenote semantic catalog…",
      "Evaluating multidimensional metrics and trends…",
      "Synthesizing data points…",
      "Structuring response…",
    ];
  }

  const ctx = extractAnalysisContext(prompt);
  const { entities, concepts, timeframes, isComparison, primaryTopic } = ctx;

  const entityStr =
    entities.length === 1
      ? entities[0]
      : entities.length === 2
      ? `${entities[0]} and ${entities[1]}`
      : entities.length > 2
      ? `${entities[0]}, ${entities[1]}, and others`
      : "";

  const conceptStr = concepts[0] || primaryTopic || "performance indicators";
  const timeframeStr = timeframes[0] || "";

  // Scenario 1: Multi-entity comparison
  if (isComparison && entities.length >= 2) {
    return [
      `Cross-referencing catalog entities for ${entityStr}…`,
      `Retrieving comparative ${conceptStr} records…`,
      timeframeStr
        ? `Evaluating ${timeframeStr} variance across providers…`
        : `Evaluating comparative performance distribution…`,
      `Synthesizing multi-provider benchmarks…`,
      `Structuring comparative breakdown…`,
    ];
  }

  // Scenario 2: Specific entity with domain concept & timeframe
  if (entityStr && concepts.length > 0 && timeframeStr) {
    return [
      `Locating catalog records for ${entityStr}…`,
      `Extracting ${conceptStr} across ${timeframeStr}…`,
      `Evaluating variance and historical patterns…`,
      `Synthesizing multidimensional data points…`,
      `Compiling analytical summary…`,
    ];
  }

  // Scenario 3: Specific entity with domain concept
  if (entityStr && concepts.length > 0) {
    return [
      `Querying catalog dimensions for ${entityStr}…`,
      `Analyzing ${conceptStr} against operational thresholds…`,
      `Evaluating correlation and historical trends…`,
      `Synthesizing performance indicators…`,
      `Structuring data breakdown…`,
    ];
  }

  // Scenario 4: Specific entity only
  if (entityStr) {
    return [
      `Resolving catalog records for ${entityStr}…`,
      `Scanning multidimensional metrics for ${entityStr}…`,
      `Evaluating operational trends and distribution…`,
      `Synthesizing catalog insights…`,
      `Structuring response summary…`,
    ];
  }

  // Scenario 5: Domain concept with timeframe
  if (concepts.length > 0 && timeframeStr) {
    return [
      `Scanning catalog records for ${conceptStr}…`,
      `Retrieving ${timeframeStr} performance metrics…`,
      `Evaluating distribution patterns and variance…`,
      `Synthesizing dimensional insights…`,
      `Structuring response breakdown…`,
    ];
  }

  // Scenario 6: Domain concept only
  if (concepts.length > 0) {
    return [
      `Scanning semantic models for ${conceptStr}…`,
      `Querying dimensional records and operational logs…`,
      `Evaluating metric distributions and trends…`,
      `Synthesizing catalog benchmarks…`,
      `Compiling analytical response…`,
    ];
  }

  // Scenario 7: Fallback with extracted primary topic
  if (primaryTopic) {
    return [
      `Formulating analytical approach for ${primaryTopic}…`,
      `Scanning relevant Gracenote semantic models…`,
      `Evaluating data distributions and metric variance…`,
      `Synthesizing cross-dimensional insights…`,
      `Structuring response…`,
    ];
  }

  // Scenario 8: General fallback (greetings, non-data queries)
  return [
    "Interpreting analytical intent…",
    "Scanning Gracenote semantic catalog…",
    "Evaluating multidimensional metrics and trends…",
    "Synthesizing data points…",
    "Structuring response…",
  ];
}
