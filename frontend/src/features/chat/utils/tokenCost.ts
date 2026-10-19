import type { TokenUsage } from "../../../shared/types/app";
import type { ModelId } from "../types/semantic";

export function calculateTokenUsageAndCost(
  _modelId: ModelId,
  _promptText: string,
  _responseText: string,
): TokenUsage {
  // Usage accounting is not connected. These zeros are not measured usage or cost.
  return {
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  };
}
