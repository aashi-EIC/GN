import type { TokenUsage } from "../../../shared/types/app";

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function reportedTokenUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Partial<TokenUsage>;
  if (
    usage.source !== "reported" ||
    !count(usage.inputTokens) ||
    !count(usage.outputTokens) ||
    !count(usage.totalTokens) ||
    usage.inputTokens + usage.outputTokens !== usage.totalTokens
  ) {
    return undefined;
  }
  return usage as TokenUsage;
}

export function parseTokenUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  return reportedTokenUsage({
    inputTokens: usage.total_prompt_tokens,
    outputTokens: usage.total_completion_tokens,
    totalTokens: usage.total_tokens,
    source: "reported",
  });
}

type UsageCall = {
  call_label: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

function parseUsageCall(value: unknown): UsageCall | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const call = value as Record<string, unknown>;
  if (
    typeof call.call_label !== "string" ||
    !/^[a-zA-Z0-9_.:-]{1,128}$/.test(call.call_label) ||
    !count(call.prompt_tokens) ||
    !count(call.completion_tokens) ||
    !count(call.total_tokens) ||
    call.total_tokens !== call.prompt_tokens + call.completion_tokens
  )
    return undefined;
  return {
    call_label: call.call_label,
    prompt_tokens: call.prompt_tokens,
    completion_tokens: call.completion_tokens,
    total_tokens: call.total_tokens,
  };
}

/** Retain only the MCP accounting contract, including optional debug-only call details. */
export function parseDebugTokenUsage(value: unknown) {
  const usage = parseTokenUsage(value);
  if (!usage) return undefined;
  const summary = {
    total_prompt_tokens: usage.inputTokens,
    total_completion_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
  };
  const rawCalls = (value as Record<string, unknown>).calls;
  if (!Array.isArray(rawCalls) || rawCalls.length > 100) return summary;
  const calls = rawCalls.map(parseUsageCall);
  return calls.every((call): call is UsageCall => call !== undefined)
    ? { ...summary, calls }
    : summary;
}
