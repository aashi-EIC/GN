import { randomUUID } from "node:crypto";
import { config } from "../../config/env.js";
import { AppError } from "../../errors.js";
import { readTokenUsage } from "../../integrations/mcp/tokenUsage.js";
import type { McpHostResponse } from "../../types.js";

export function quotaMonth(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const resetsAt = new Date(Date.UTC(year, month + 1, 1));
  return {
    period: `${year}-${String(month + 1).padStart(2, "0")}`,
    resetsAt: resetsAt.toISOString(),
    expiresAt: resetsAt.getTime() + 7 * 86_400_000,
  };
}

export type QuotaTicket = Readonly<ReturnType<typeof quotaMonth> & { requestId: string }>;

type Account = {
  input: number;
  output: number;
  pending: number;
  unconfirmed: number;
  expiresAt: number;
};

/** Process-local accounting. Restarting the BFF starts a fresh balance. */
export function createMonthlyTokenQuota(limit: number, clock = () => new Date()) {
  if (!Number.isSafeInteger(limit) || limit <= 0)
    throw new RangeError("Invalid monthly token limit");
  const accounts = new Map<string, Account>();
  const tickets = new WeakMap<QuotaTicket, Account>();
  let cleanupAt = 0;

  function lookup(browserUserId: string, now: Date) {
    const timestamp = now.getTime();
    if (timestamp >= cleanupAt) {
      for (const [key, state] of accounts) {
        if (state.expiresAt <= timestamp) accounts.delete(key);
      }
      cleanupAt = timestamp + 3_600_000;
    }
    const month = quotaMonth(now);
    const key = `${month.period}:${browserUserId.toLowerCase()}`;
    return { month, key, state: accounts.get(key) };
  }

  function beginMonthlyRequest(browserUserId: string): QuotaTicket {
    const { month, key, state: existing } = lookup(browserUserId, clock());
    const state = existing ?? {
      input: 0,
      output: 0,
      pending: 0,
      unconfirmed: 0,
      expiresAt: month.expiresAt,
    };
    if (state.input + state.output >= limit) {
      throw new AppError(429, "MONTHLY_TOKEN_LIMIT_EXCEEDED", "Monthly token limit reached.", {
        limit,
        resets_at: month.resetsAt,
      });
    }
    const ticket = Object.freeze({ ...month, requestId: randomUUID() });
    accounts.set(key, state);
    tickets.set(ticket, state);
    state.pending += 1;
    return ticket;
  }

  function settleMonthlyRequest(
    ticket: QuotaTicket,
    reported: McpHostResponse["token_usage"],
    submitted: boolean,
  ) {
    const state = tickets.get(ticket);
    if (!state) return; // A request can settle only once.
    tickets.delete(ticket);
    state.pending -= 1;
    const usage = readTokenUsage(reported);
    if (usage && state.input + state.output <= Number.MAX_SAFE_INTEGER - usage.total_tokens) {
      // No awaits between reading and updating: concurrent completions cannot lose increments.
      state.input += usage.total_prompt_tokens;
      state.output += usage.total_completion_tokens;
    } else if (submitted) {
      // Unknown usage stays visible as incomplete, but does not lock later requests.
      state.unconfirmed += 1;
    }
  }

  function getMonthlyTokenQuota(browserUserId: string, now = clock()) {
    const { month, state } = lookup(browserUserId, now);
    const input = state?.input ?? 0;
    const output = state?.output ?? 0;
    const used = input + output;
    return {
      period: month.period,
      resets_at: month.resetsAt,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      input_tokens: input,
      output_tokens: output,
      pending_requests: state?.pending ?? 0,
      usage_unconfirmed: (state?.unconfirmed ?? 0) > 0,
      identity_scope: "browser" as const,
      storage_scope: "process" as const,
    };
  }

  return { beginMonthlyRequest, settleMonthlyRequest, getMonthlyTokenQuota };
}

export const { beginMonthlyRequest, settleMonthlyRequest, getMonthlyTokenQuota } =
  createMonthlyTokenQuota(config.MONTHLY_TOKEN_LIMIT);
