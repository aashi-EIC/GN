import { useEffect, useState } from "react";
import { bffClient } from "../../../shared/services/axios";
import { parseTokenUsage } from "../../chat/utils/tokenUsage";
import type { TokenUsage } from "../../../shared/types/app";

export type MonthlyTokenQuota = {
  usage: TokenUsage;
  limit: number;
  remaining: number;
  resetsAt: string;
  pending: number;
  unconfirmed: boolean;
};

function parseQuota(value: unknown): MonthlyTokenQuota {
  if (!value || typeof value !== "object") throw new Error("Invalid monthly usage");
  const data = value as Record<string, unknown>;
  const usage = parseTokenUsage({
    total_prompt_tokens: data.input_tokens,
    total_completion_tokens: data.output_tokens,
    total_tokens: data.used,
  });
  if (
    !usage ||
    typeof data.limit !== "number" ||
    !Number.isSafeInteger(data.limit) ||
    data.limit <= 0 ||
    typeof data.remaining !== "number" ||
    data.remaining !== Math.max(0, data.limit - usage.totalTokens) ||
    typeof data.resets_at !== "string" ||
    !Number.isFinite(Date.parse(data.resets_at)) ||
    typeof data.pending_requests !== "number" ||
    !Number.isSafeInteger(data.pending_requests) ||
    data.pending_requests < 0 ||
    typeof data.usage_unconfirmed !== "boolean"
  )
    throw new Error("Invalid monthly usage");
  return {
    usage,
    limit: data.limit,
    remaining: data.remaining,
    resetsAt: data.resets_at,
    pending: data.pending_requests,
    unconfirmed: data.usage_unconfirmed,
  };
}

export function useMonthlyTokenQuota() {
  const [quota, setQuota] = useState<MonthlyTokenQuota>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setLoading(true);
      void bffClient
        .get<unknown>("/usage/monthly", { signal: request.signal, timeout: 5_000 })
        .then(({ data }) => {
          if (!request.signal.aborted) {
            setQuota(parseQuota(data));
            setError(false);
          }
        })
        .catch(() => {
          if (!request.signal.aborted) {
            setQuota(undefined);
            setError(true);
          }
        })
        .finally(() => {
          if (!request.signal.aborted) setLoading(false);
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("monthly-token-usage-updated", refresh);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("monthly-token-usage-updated", refresh);
    };
  }, []);
  return { quota, error, loading };
}
