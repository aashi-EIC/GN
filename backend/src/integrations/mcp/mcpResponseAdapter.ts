import { z } from "zod";
import { config } from "../../config/env.js";
import { UpstreamError } from "../../errors.js";
import { assertSafeUnknown } from "../../security/contentSafety.js";
import type { McpContentBlock, McpHostResponse } from "../../types.js";

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
      .passthrough(),
  })
  .passthrough();

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
  const mcpSession = readMcpSession(input);
  const generatedDaxQueries = readGeneratedDaxQueries(input);
  const parsed = mcpResponse.safeParse(input);
  if (parsed.success) {
    assertSafeUnknown(parsed.data);
    return {
      answer: parsed.data.answer as McpHostResponse["answer"],
      ...(mcpSession?.id ? { mcp_session_id: mcpSession.id } : {}),
      ...(mcpSession ? { mcp_session: mcpSession } : {}),
      ...(generatedDaxQueries ? { generated_dax_queries: generatedDaxQueries } : {}),
    };
  }

  const current = currentMcpResponse.safeParse(input);
  if (!current.success) return adaptFlexibleResponse(input);

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
    ...(mcpSession?.id ? { mcp_session_id: mcpSession.id } : {}),
    ...(mcpSession ? { mcp_session: mcpSession } : {}),
    ...(generatedDaxQueries ? { generated_dax_queries: generatedDaxQueries } : {}),
  };
}

function readMcpSession(input: unknown): McpHostResponse["mcp_session"] | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const record = input as Record<string, unknown>;
  const rawId = record.session_id;
  const rawCount = record.message_count;
  const rawStatus = record.session_status;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  const status = typeof rawStatus === "string" ? rawStatus.trim() : "";
  const messageCount =
    typeof rawCount === "number" && Number.isInteger(rawCount) && rawCount >= 0
      ? rawCount
      : undefined;
  const safeId = id && id.length <= 256 ? id : undefined;
  const safeStatus = status && status.length <= 100 ? status : undefined;
  if (!safeId && messageCount === undefined && !safeStatus) return undefined;
  return {
    ...(safeId ? { id: safeId } : {}),
    ...(messageCount !== undefined ? { message_count: messageCount } : {}),
    ...(safeStatus ? { status: safeStatus } : {}),
    requires_new_session: isTerminalSessionStatus(safeStatus),
  };
}

function readGeneratedDaxQueries(input: unknown): string[] | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const value = (input as Record<string, unknown>).generated_dax_query;

  // MCP returned a plain string — wrap it so the UI receives a 1-element array.
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (!Array.isArray(value)) return undefined;

  // Detect accidental character arrays produced by Python's list(str) coercion
  // (every element is a single character).  Re-join them into one query string.
  const looksLikeCharArray =
    value.length > 1 &&
    value.every((item) => typeof item === "string" && item.length <= 1);
  if (looksLikeCharArray) {
    const joined = (value as string[]).join("").trim();
    return joined ? [joined] : [];
  }

  const queries = value
    .filter((entry): entry is string => typeof entry === "string" && entry.length <= 500_000)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 100);
  // Preserve an explicitly returned empty array so the UI can distinguish
  // "captured, but no query was needed" from "not supplied by MCP".
  return queries;
}

function isTerminalSessionStatus(status: string | undefined) {
  if (!status) return false;
  return new Set(["expired", "closed", "terminated", "invalid", "inactive"]).has(
    status.toLowerCase().replace(/[\s-]+/g, "_"),
  );
}

const textPathCandidates = [
  "answer.text",
  "llm_output",
  "response.text",
  "response.answer",
  "response",
  "output.text",
  "output",
  "result.text",
  "result.answer",
  "result",
  "data.llm_output",
  "data.answer.text",
  "data.answer",
  "data.response",
  "data.text",
  "message.content",
  "message",
  "content",
];

function adaptFlexibleResponse(input: unknown): McpHostResponse {
  const normalized = parseJsonString(input) ?? input;
  const configuredText = config.MCP_RESPONSE_TEXT_PATH
    ? readPath(normalized, config.MCP_RESPONSE_TEXT_PATH)
    : undefined;
  const text = findText(configuredText) ?? findTextAtPaths(normalized) ?? findText(normalized);

  if (!text) {
    throw new UpstreamError("MCP response does not contain a supported text result", {
      responseShape: describeShape(normalized),
    });
  }

  const configuredVisualizations = config.MCP_RESPONSE_VISUALIZATION_PATH
    ? readPath(normalized, config.MCP_RESPONSE_VISUALIZATION_PATH)
    : undefined;
  const parsedBlocks = z.array(block).max(100).safeParse(configuredVisualizations);
  const blocks: McpContentBlock[] = parsedBlocks.success
    ? (parsedBlocks.data as McpContentBlock[])
    : buildTableBlocks(normalized);
  const mcpSession = readMcpSession(normalized);
  const generatedDaxQueries = readGeneratedDaxQueries(normalized);
  const result: McpHostResponse = {
    answer: {
      text,
      ...(blocks.length ? { blocks } : {}),
    },
    ...(mcpSession?.id ? { mcp_session_id: mcpSession.id } : {}),
    ...(mcpSession ? { mcp_session: mcpSession } : {}),
    ...(generatedDaxQueries ? { generated_dax_queries: generatedDaxQueries } : {}),
  };

  assertSafeUnknown(result);
  return result;
}

function findTextAtPaths(input: unknown) {
  for (const path of textPathCandidates) {
    const text = findText(readPath(input, path));
    if (text) return text;
  }
  return undefined;
}

function findText(value: unknown, depth = 0): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = parseJsonString(trimmed);
    return parsed === undefined
      ? trimmed
      : (findTextAtPaths(parsed) ?? findText(parsed, depth + 1));
  }
  if (!value || typeof value !== "object" || depth >= 5) return undefined;

  const priorityKeys = [
    "llm_output",
    "answer",
    "response",
    "text",
    "content",
    "message",
    "output",
    "result",
    "body",
    "data",
  ];
  const record = value as Record<string, unknown>;
  for (const key of priorityKeys) {
    if (key in record) {
      const text = findText(record[key], depth + 1);
      if (text) return text;
    }
  }
  return undefined;
}

function buildTableBlocks(input: unknown): NonNullable<McpHostResponse["answer"]["blocks"]> {
  const configuredData = config.MCP_RESPONSE_DATA_PATH
    ? readPath(input, config.MCP_RESPONSE_DATA_PATH)
    : undefined;
  const candidates = [
    configuredData,
    readPath(input, "tool_result"),
    readPath(input, "data.rows"),
    readPath(input, "data"),
    readPath(input, "result.data"),
    readPath(input, "response.data"),
  ];

  for (const candidate of candidates) {
    const rows = extractRows(candidate);
    if (!rows.length) continue;
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 100);
    if (columns.length) return [{ type: "table", title: "Query result", columns, rows }];
  }
  return [];
}

function extractRows(value: unknown): Array<Record<string, z.infer<typeof scalar>>> {
  if (!Array.isArray(value)) return [];
  const flattened = value.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]));
  return flattened.filter((entry): entry is Record<string, z.infer<typeof scalar>> => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    return Object.values(entry).every((item) => scalar.safeParse(item).success);
  });
}

function readPath(input: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[part];
  }, input);
}

function parseJsonString(value: unknown): unknown | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function describeShape(value: unknown): unknown {
  if (Array.isArray(value)) return { type: "array", length: value.length };
  if (value && typeof value === "object") {
    return { type: "object", keys: Object.keys(value).slice(0, 30) };
  }
  return { type: value === null ? "null" : typeof value };
}