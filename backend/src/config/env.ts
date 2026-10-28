import "dotenv/config";
import { z } from "zod";
import { ConfigurationError } from "../errors.js";
import { parseMcpRequestConfiguration } from "./mcpRequestConfiguration.js";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const bool = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" ? true : normalized === "false" ? false : value;
}, z.boolean());

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

  SEMANTIC_MODEL_GUIDE_SOURCE: z.enum(["file", "s3"]).default("file"),
  SEMANTIC_MODEL_POLICY_PATH: optionalText,
  SEMANTIC_MODEL_GUIDE_PATH: optionalText,
  SEMANTIC_MODEL_GUIDE_S3_BUCKET: optionalText,
  SEMANTIC_MODEL_POLICY_S3_KEY: optionalText,
  SEMANTIC_MODEL_GUIDE_S3_REGION: z.string().min(1).default("us-west-2"),
  SEMANTIC_MODEL_GUIDE_AUTH_MODE: z.enum(["auto", "pod", "assume-role"]).default("assume-role"),
  SEMANTIC_MODEL_GUIDE_ROLE_ARN: optionalText,
  SEMANTIC_MODEL_GUIDE_STS_REGION: z.string().min(1).default("us-east-1"),
  SEMANTIC_MODEL_GUIDE_TIMEOUT_MS: integer(30_000).refine((value) => value <= 120_000),
  SEMANTIC_MODEL_GUIDE_EXCLUDED_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(
          z
            .string()
            .max(256)
            .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/),
        )
        .max(100),
    ),
  FEATURE_FLAGS_JSON: optionalText,
  MAX_PROMPT_LENGTH: integer(20_000),
  MAX_HISTORY_ITEMS: integer(10),
  SESSION_CACHE_MAX_BYTES: integer(33_554_432),
  SESSION_CACHE_MAX_SESSIONS: integer(500),
  SESSION_CACHE_MAX_MESSAGES: integer(10_000),
  SESSION_CACHE_TTL_MS: integer(86_400_000),
  MONTHLY_TOKEN_LIMIT: integer(1_000_000).refine(Number.isSafeInteger),

  RATE_LIMIT_WINDOW_MS: integer(60_000),
  RATE_LIMIT_MAX: integer(30),

  MCP_BASE_URL: optionalText,
  MCP_ENDPOINT_PATH: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).default("/chat"),
  ),
  MCP_TIMEOUT_MS: integer(300_000),
  CHAT_STREAMING_ENABLED: bool.default(false),
  MCP_STREAM_ENDPOINT_PATH: z.string().min(1).default("/chat/stream"),
  // Anonymous request metadata, not a verified user identity.
  MCP_STREAM_EMAIL: z.string().email().default("test@example.com"),
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
  MCP_REQUEST_SESSION_FIELD: optionalText,
  MCP_REQUEST_MODEL_FIELD: optionalText,
  MCP_REQUEST_STATIC_FIELDS_JSON: optionalText,
  MCP_MODEL_ID_MAP_JSON: optionalText,
  MCP_REQUEST_CORRELATION_FIELD: optionalText,
  MCP_REQUEST_USER_FIELD: optionalText,
  MCP_REQUEST_USER_VALUE_SOURCE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["browser_user_id", "oid", "sub", "preferred_username"]).optional(),
  ),
  MCP_RESPONSE_TEXT_PATH: optionalText,
  MCP_RESPONSE_DATA_PATH: optionalText,
  MCP_RESPONSE_DEBUG_PATH: optionalText,
  MCP_RESPONSE_VISUALIZATION_PATH: optionalText,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new ConfigurationError("Invalid environment configuration", parsed.error.flatten());
}

export const config = parsed.data;
export const mcpRequestConfiguration = parseMcpRequestConfiguration(config);

function requireConfig<K extends keyof typeof config>(...keys: K[]): void {
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
  requireConfig("MCP_BASE_URL", "MCP_ENDPOINT_PATH", "MCP_REQUEST_PROMPT_FIELD");
  const requestConfiguration = parseMcpRequestConfiguration(config);
  if (config.CHAT_STREAMING_ENABLED) {
    const email = requestConfiguration.staticBody.email ?? config.MCP_STREAM_EMAIL;
    const bearer = requestConfiguration.staticBody.bearer_token ?? "";
    if (!z.string().email().safeParse(email).success || typeof bearer !== "string")
      throw new ConfigurationError("Invalid MCP streaming metadata configuration");
  }
  try {
    const base = new URL(getRequired("MCP_BASE_URL"));
    if (!["https:", "http:"].includes(base.protocol) || base.username || base.password || base.hash)
      throw new Error("Invalid MCP origin");
    for (const path of [config.MCP_ENDPOINT_PATH, config.MCP_STREAM_ENDPOINT_PATH]) {
      const endpoint = new URL(path, base);
      if (
        endpoint.origin !== base.origin ||
        endpoint.username ||
        endpoint.password ||
        endpoint.hash
      )
        throw new Error("Invalid MCP endpoint");
    }
  } catch {
    throw new ConfigurationError(
      "MCP URLs must use HTTP(S) and endpoints must remain on MCP_BASE_URL origin",
    );
  }

  if (config.MCP_AUTH_MODE === "api-key") {
    requireConfig("MCP_API_KEY_HEADER", "MCP_API_KEY_VALUE");
    const header = getRequired("MCP_API_KEY_HEADER");
    if (/^(cookie|host|content-length)$/i.test(header))
      throw new ConfigurationError("MCP_API_KEY_HEADER uses a prohibited header name");
    try {
      new Headers({ [header]: getRequired("MCP_API_KEY_VALUE") });
    } catch {
      throw new ConfigurationError("Invalid MCP API key header configuration");
    }
  }
  if (config.MCP_REQUEST_USER_FIELD && !config.MCP_REQUEST_USER_VALUE_SOURCE) {
    throw new ConfigurationError(
      "MCP_REQUEST_USER_VALUE_SOURCE is required when MCP_REQUEST_USER_FIELD is configured",
    );
  }
}
