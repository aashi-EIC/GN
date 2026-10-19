import type { TokenUsage } from "../../../shared/types/app";
import type { ModelId } from "../types/semantic";

export function calculateTokenUsageAndCost(
  _modelId: ModelId,
  _promptText: string,
  _responseText: string,
): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  };
}
