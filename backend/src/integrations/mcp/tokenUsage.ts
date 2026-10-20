import { z } from "zod";
import type { McpHostResponse } from "../../types.js";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const usageSummary = z
  .object({
    total_prompt_tokens: count,
    total_completion_tokens: count,
    total_tokens: count,
  })
  .refine(
    (usage) => usage.total_tokens === usage.total_prompt_tokens + usage.total_completion_tokens,
  );

const usageCalls = z
  .array(
    z
      .object({
        call_label: z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/),
        prompt_tokens: count,
        completion_tokens: count,
        total_tokens: count,
      })
      .refine((call) => call.total_tokens === call.prompt_tokens + call.completion_tokens),
  )
  .max(100);

/** Optional accounting metadata must never prevent a valid answer from rendering. */
export function readTokenUsage(value: unknown): McpHostResponse["token_usage"] {
  const parsed = usageSummary.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Debug-only detail; aggregate accounting never depends on this optional breakdown. */
export function readDebugTokenUsage(value: unknown) {
  const summary = readTokenUsage(value);
  if (!summary) return undefined;
  const calls = usageCalls.safeParse((value as Record<string, unknown>).calls);
  return calls.success ? { ...summary, calls: calls.data } : summary;
}
