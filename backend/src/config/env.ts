import "dotenv/config";
import { z } from "zod";
import { ConfigurationError } from "../errors.js";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const bool = z.preprocess((value) => value === true || value === "true", z.boolean());

const integer = (fallback: number) =>
  z.preprocess(
    (value) => (value === undefined ? fallback : Number(value)),
    z.number().int().positive(),
  );

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: integer(3000),
  LOG_LEVEL: z.string().default("info"),

  CORS_ALLOWED_ORIGINS: optionalText,

  SEMANTIC_MODELS_JSON: optionalText,
  FEATURE_FLAGS_JSON: optionalText,
  MAX_PROMPT_LENGTH: integer(20_000),
  MAX_HISTORY_ITEMS: integer(10),

  REDIS_URL: optionalText,
  RATE_LIMIT_WINDOW_MS: integer(60_000),
  RATE_LIMIT_MAX: integer(30),

  MCP_BASE_URL: optionalText,
  MCP_ENDPOINT_PATH: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).default("/chat"),
  ),
  MCP_TIMEOUT_MS: integer(60_000),
  MCP_MAX_RESPONSE_BYTES: integer(5_242_880),
  MCP_SAFE_RETRY_ENABLED: bool.default(false),
  MCP_MAX_RETRIES: z.preprocess(
    (value) => (value === undefined ? 0 : Number(value)),
    z.number().int().min(0).max(3),
  ),

  MCP_AUTH_MODE: z.enum(["none", "api-key"]).default("none"),
  MCP_API_KEY_HEADER: optionalText,
  MCP_API_KEY_VALUE: optionalText,

  MCP_REQUEST_PROMPT_FIELD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).default("message"),
  ),
  MCP_REQUEST_SESSION_FIELD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).default("session_id"),
  ),
  MCP_REQUEST_MODEL_FIELD: optionalText,
  MCP_REQUEST_CORRELATION_FIELD: optionalText,
  MCP_REQUEST_USER_FIELD: optionalText,
  MCP_REQUEST_USER_VALUE_SOURCE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["oid", "sub", "preferred_username"]).optional(),
  ),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new ConfigurationError("Invalid environment configuration", parsed.error.flatten());
}

export const config = parsed.data;

export function requireConfig<K extends keyof typeof config>(...keys: K[]): void {
  const missing = keys.filter((key) => !config[key]);
  if (missing.length)
    throw new ConfigurationError(`Missing required configuration: ${missing.join(", ")}`);
}

export function getRequired<K extends keyof typeof config>(key: K): string {
  const value = config[key];
  if (typeof value !== "string" || !value)
    throw new ConfigurationError(`Missing required configuration: ${key}`);
  return value;
}

export function assertRuntimeConfiguration() {
  requireConfig(
    "MCP_BASE_URL",
    "MCP_ENDPOINT_PATH",
    "MCP_REQUEST_PROMPT_FIELD",
    "MCP_REQUEST_SESSION_FIELD",
  );

  if (config.MCP_AUTH_MODE === "api-key") {
    requireConfig("MCP_API_KEY_HEADER", "MCP_API_KEY_VALUE");
  }
  if (config.MCP_REQUEST_USER_FIELD && !config.MCP_REQUEST_USER_VALUE_SOURCE) {
    throw new ConfigurationError(
      "MCP_REQUEST_USER_VALUE_SOURCE is required when MCP_REQUEST_USER_FIELD is configured",
    );
  }
}
