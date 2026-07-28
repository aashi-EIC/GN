import type { TokenUsage } from "../types/app";
import type { ModelId } from "../types/semantic";

// Rates per 1,000 tokens in USD
const MODEL_RATES: Record<ModelId, { input: number; output: number }> = {
  metadata_stats_linear: { input: 0.0015, output: 0.0020 },
  imagerystats_vod: { input: 0.0030, output: 0.0040 },
  mapping_stats_svc: { input: 0.0025, output: 0.0030 },
  schedule_completeness_tsg: { input: 0.0015, output: 0.0020 },
  program_gaps_svc: { input: 0.0020, output: 0.0025 },
  linear_country_grading: { input: 0.0050, output: 0.0060 },
  usage_metrics_bia_dashboards: { input: 0.0010, output: 0.0015 },
};

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Standard approximation: 1 token is ~4 characters or ~0.75 words.
  // We'll use Math.ceil(text.length / 3.8) to give a realistic count.
  return Math.ceil(text.length / 3.8);
}

export function calculateTokenUsageAndCost(
  modelId: ModelId,
  promptText: string,
  responseText: string
): TokenUsage {
  // Estimate input tokens (prompt + some context overhead)
  const inputTokens = estimateTokens(promptText) + 120; // adding 120 tokens for system prompt/RAG context
  const outputTokens = estimateTokens(responseText);

  const rates = MODEL_RATES[modelId] || { input: 0.0020, output: 0.0025 };
  const inputCost = (inputTokens / 1000) * rates.input;
  const outputCost = (outputTokens / 1000) * rates.output;
  const cost = inputCost + outputCost;

  // Log to console for auditability and tracking
  console.log(
    `[Token Track] Model: ${modelId} | Input: ${inputTokens} t ($${inputCost.toFixed(6)}) | Output: ${outputTokens} t ($${outputCost.toFixed(6)}) | Total Cost: $${cost.toFixed(6)}`
  );

  return {
    inputTokens,
    outputTokens,
    cost,
  };
}
