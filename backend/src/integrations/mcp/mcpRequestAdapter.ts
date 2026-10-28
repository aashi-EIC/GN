import { config, getRequired, mcpRequestConfiguration } from "../../config/env.js";
import { setMcpField as setPath } from "../../config/mcpRequestConfiguration.js";
import { ConfigurationError } from "../../errors.js";
import type { McpRequestContext } from "../../types.js";

/** Maps BFF request fields to the configured MCP payload. */
export function adaptMcpRequest(context: McpRequestContext): Record<string, unknown> {
  const body = structuredClone(mcpRequestConfiguration.staticBody);

  setPath(body, getRequired("MCP_REQUEST_PROMPT_FIELD"), context.prompt);

  if (config.MCP_REQUEST_SESSION_FIELD && context.mcpSessionId) {
    setPath(body, config.MCP_REQUEST_SESSION_FIELD, context.mcpSessionId);
  }

  if (config.MCP_REQUEST_MODEL_FIELD) {
    const modelId = Object.hasOwn(mcpRequestConfiguration.modelIdMap, context.semanticModelId)
      ? mcpRequestConfiguration.modelIdMap[context.semanticModelId]
      : context.semanticModelId;
    setPath(body, config.MCP_REQUEST_MODEL_FIELD, modelId);
  }
  if (config.MCP_REQUEST_CORRELATION_FIELD)
    setPath(body, config.MCP_REQUEST_CORRELATION_FIELD, context.correlationId);
  if (config.MCP_REQUEST_USER_FIELD) {
    if (!config.MCP_REQUEST_USER_VALUE_SOURCE)
      throw new ConfigurationError("MCP_REQUEST_USER_VALUE_SOURCE is not configured");
    const userValue =
      config.MCP_REQUEST_USER_VALUE_SOURCE === "browser_user_id"
        ? context.browserUserId
        : config.MCP_REQUEST_USER_VALUE_SOURCE === "oid"
          ? context.user.objectId
          : config.MCP_REQUEST_USER_VALUE_SOURCE === "sub"
            ? context.user.subject
            : context.user.preferredUsername;
    if (!userValue)
      throw new ConfigurationError(
        `The configured user claim ${config.MCP_REQUEST_USER_VALUE_SOURCE} is absent`,
      );
    setPath(body, config.MCP_REQUEST_USER_FIELD, userValue);
  }
  return body;
}
