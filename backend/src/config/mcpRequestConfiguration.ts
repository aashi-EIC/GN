import { ConfigurationError } from "../errors.js";

type RequestConfiguration = {
  MCP_REQUEST_STATIC_FIELDS_JSON?: string | undefined;
  MCP_MODEL_ID_MAP_JSON?: string | undefined;
  MCP_REQUEST_PROMPT_FIELD: string;
  MCP_REQUEST_SESSION_FIELD?: string | undefined;
  MCP_REQUEST_MODEL_FIELD?: string | undefined;
  MCP_REQUEST_CORRELATION_FIELD?: string | undefined;
  MCP_REQUEST_USER_FIELD?: string | undefined;
};

const forbidden = new Set(["__proto__", "prototype", "constructor"]);

export function setMcpField(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  if (parts.some((part) => !part || forbidden.has(part)))
    throw new ConfigurationError("Invalid MCP request field path");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const existing = current[part];
    if (
      existing !== undefined &&
      (!existing || typeof existing !== "object" || Array.isArray(existing))
    )
      throw new ConfigurationError("Conflicting MCP request field paths");
    const next = (existing ?? {}) as Record<string, unknown>;
    current[part] = next;
    current = next;
  }
  current[parts.at(-1)!] = value;
}

function parseObject(value: string | undefined, label: string): Record<string, unknown> {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ConfigurationError(`${label} must contain valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new ConfigurationError(`${label} must contain a JSON object`);
  return parsed as Record<string, unknown>;
}

export function parseMcpRequestConfiguration(settings: RequestConfiguration) {
  const staticBody: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(
    parseObject(settings.MCP_REQUEST_STATIC_FIELDS_JSON, "MCP_REQUEST_STATIC_FIELDS_JSON"),
  )) {
    setMcpField(staticBody, field, value);
  }
  const modelIdMap = Object.fromEntries(
    Object.entries(parseObject(settings.MCP_MODEL_ID_MAP_JSON, "MCP_MODEL_ID_MAP_JSON")).map(
      ([key, value]) => {
        if (typeof value !== "string" || !value.trim() || value.trim().length > 256)
          throw new ConfigurationError(
            "MCP_MODEL_ID_MAP_JSON values must be non-empty model IDs up to 256 characters",
          );
        return [key, value.trim()];
      },
    ),
  );
  const fields = [
    settings.MCP_REQUEST_PROMPT_FIELD,
    settings.MCP_REQUEST_SESSION_FIELD,
    settings.MCP_REQUEST_MODEL_FIELD,
    settings.MCP_REQUEST_CORRELATION_FIELD,
    settings.MCP_REQUEST_USER_FIELD,
  ].filter((field): field is string => Boolean(field));
  const probe = structuredClone(staticBody);
  for (const [index, field] of fields.entries()) {
    if (
      fields
        .slice(0, index)
        .some(
          (other) =>
            field === other || field.startsWith(`${other}.`) || other.startsWith(`${field}.`),
        )
    )
      throw new ConfigurationError("MCP request fields must not overlap");
    setMcpField(probe, field, "configuration-check");
  }
  return { staticBody, modelIdMap };
}
