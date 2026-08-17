import type { TokenUsage } from "../../../shared/types/app";
import type { ModelId } from "../types/semantic";

export function estimateTokens(_text: string): number {
  // Placeholder only - formula removed
  return 0;
}

export function calculateTokenUsageAndCost(
  _modelId: ModelId,
  _promptText: string,
  _responseText: string,
): TokenUsage {
  // Placeholder token usage - formula removed
  return {
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  };
}
