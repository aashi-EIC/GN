import { config, getRequired } from "../../config/env.js";
import { ConfigurationError } from "../../errors.js";
import { acquireTokenOnBehalfOf } from "../../security/msal.js";
import type { AuthenticatedUser } from "../../types.js";

export type OutboundAuthenticationProvider = {
  getHeaders(user: AuthenticatedUser, signal: AbortSignal): Promise<Record<string, string>>;
  getToken?(user: AuthenticatedUser, signal: AbortSignal): Promise<string | undefined>;
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

class OboAuthenticationProvider implements OutboundAuthenticationProvider {
  async getToken(user: AuthenticatedUser): Promise<string> {
    if (!user.rawAccessToken) {
      throw new ConfigurationError(
        "Inbound user access token is required for Microsoft Entra On-Behalf-Of (OBO) token exchange",
      );
    }

    return acquireTokenOnBehalfOf(user.rawAccessToken);
  }

  async getHeaders(user: AuthenticatedUser): Promise<Record<string, string>> {
    const token = await this.getToken(user);
    return { authorization: `Bearer ${token}` };
  }
}

class NoAuthenticationProvider implements OutboundAuthenticationProvider {
  async getHeaders() {
    return {};
  }
}

export function createAuthenticationProvider(): OutboundAuthenticationProvider {
  if (config.MCP_AUTH_MODE === "obo") return new OboAuthenticationProvider();
  if (config.MCP_AUTH_MODE === "api-key") return new ApiKeyAuthenticationProvider();
  return new NoAuthenticationProvider();
}
