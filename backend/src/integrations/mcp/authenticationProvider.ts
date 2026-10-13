import { config, getRequired } from "../../config/env.js";
import { ConfigurationError } from "../../errors.js";
import type { AuthenticatedUser } from "../../types.js";

export type OutboundAuthenticationProvider = {
  getHeaders(user: AuthenticatedUser, signal: AbortSignal): Promise<Record<string, string>>;
};

class ApiKeyAuthenticationProvider implements OutboundAuthenticationProvider {
  async getHeaders() {
    const header = getRequired("MCP_API_KEY_HEADER");
    const value = getRequired("MCP_API_KEY_VALUE");

    if (/^(cookie|host|content-length)$/i.test(header)) {
      throw new ConfigurationError("MCP_API_KEY_HEADER uses a prohibited header name");
    }

    return { [header]: value };
  }
}

class NoAuthenticationProvider implements OutboundAuthenticationProvider {
  async getHeaders() {
    return {};
  }
}

export function createAuthenticationProvider(): OutboundAuthenticationProvider {
  if (config.MCP_AUTH_MODE === "api-key") return new ApiKeyAuthenticationProvider();
  return new NoAuthenticationProvider();
}
