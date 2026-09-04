import { z } from "zod";
import { UpstreamError } from "../../errors.js";
import { assertSafeUnknown } from "../../security/contentSafety.js";
import type { McpHostResponse } from "../../types.js";

const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const column = z.union([
  z.string().min(1).max(256),
  z
    .object({
      key: z.string().min(1).max(256),
      label: z.string().min(1).max(256).optional(),
    })
    .strict(),
]);
const encoding = z
  .object({
    x: z.string().min(1).max(256).optional(),
    y: z.string().min(1).max(256).optional(),
    name: z.string().min(1).max(256).optional(),
    value: z.string().min(1).max(256).optional(),
    color: z.string().min(1).max(256).optional(),
    size: z.string().min(1).max(256).optional(),
  })
  .strict();
const block = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("text"),
      content: z.string().min(1).max(100_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("table"),
      title: z.string().min(1).max(500).optional(),
      columns: z.array(column).min(1).max(100),
      rows: z.array(z.union([z.record(z.string(), scalar), z.array(scalar).max(100)])).max(10_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("chart"),
      chart_type: z.enum([
        "line",
        "area",
        "bar",
        "stacked-bar",
        "horizontal-bar",
        "pie",
        "donut",
        "scatter",
        "bubble",
        "heatmap",
        "radar",
        "funnel",
        "gauge",
      ]),
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(2_000).optional(),
      data: z
        .union([
          z.array(z.record(z.string(), scalar)).max(100_000),
          z.array(z.array(scalar).max(100)).max(100_000),
        ])
        .optional(),
      encoding: encoding.optional(),
      option: z.record(z.string(), z.unknown()).optional(),
    })
    .strict(),
]);
const mcpResponse = z
  .object({
    answer: z
      .object({
        text: z.string().min(1).max(500_000),
        blocks: z.array(block).max(100).optional(),
      })
      .strict(),
  })
  .strict();

const currentMcpResponse = z
  .object({
    user_input: z.string().max(100_000).optional(),
    llm_output: z.string().min(1).max(500_000),
    generated_dax_query: z.array(z.string().max(500_000)).max(100).optional(),
    tool_result: z
      .array(z.array(z.record(z.string(), scalar)).max(10_000))
      .max(100)
      .default([]),
    expected_format: z.string().max(100).optional(),
    session_id: z.string().max(256).optional(),
    message_count: z.number().int().nonnegative().optional(),
    session_status: z.string().max(100).optional(),
  })
  .passthrough();

export function adaptMcpResponse(input: unknown): McpHostResponse {
  const parsed = mcpResponse.safeParse(input);
  if (parsed.success) {
    assertSafeUnknown(parsed.data);
    return parsed.data as McpHostResponse;
  }

  const current = currentMcpResponse.safeParse(input);
  if (!current.success) {
    throw new UpstreamError("MCP response does not match a supported response contract");
  }

  assertSafeUnknown(current.data);
  const rows = current.data.tool_result.flat();
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 100);
  const blocks: McpHostResponse["answer"]["blocks"] = columns.length
    ? [{ type: "table", title: "Query result", columns, rows }]
    : [];

  return {
    answer: {
      text: current.data.llm_output,
      blocks,
    },
  };
}
