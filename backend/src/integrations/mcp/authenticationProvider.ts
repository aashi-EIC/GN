import { ConfidentialClientApplication } from '@azure/msal-node';
import { config, getDownstreamScopes, getOboTenantId, getRequired } from '../../config/env.js';
import { ConfigurationError, UpstreamError } from '../../errors.js';
import type { AuthenticatedUser } from '../../types.js';

export type OutboundAuthenticationProvider = {
  getHeaders(user: AuthenticatedUser, signal: AbortSignal): Promise<Record<string, string>>;
};

class ApiKeyAuthenticationProvider implements OutboundAuthenticationProvider {
  async getHeaders() {
    const header = getRequired('MCP_API_KEY_HEADER');
    const value = getRequired('MCP_API_KEY_VALUE');

    if (/^(cookie|host|content-length)$/i.test(header)) {
      throw new ConfigurationError('MCP_API_KEY_HEADER uses a prohibited header name');
    }

    return { [header]: value };
  }
}

class NoAuthenticationProvider implements OutboundAuthenticationProvider {
  async getHeaders() {
    return {};
  }
}

class OboAuthenticationProvider implements OutboundAuthenticationProvider {
  private application?: ConfidentialClientApplication;

  async getHeaders(user: AuthenticatedUser) {
    const tenantId = getOboTenantId();
    const clientId = getRequired('OBO_CLIENT_ID');
    const clientSecret = getRequired('OBO_CLIENT_SECRET');
    const scopes = getDownstreamScopes();

    this.application ??= new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    });

    const result = await this.application.acquireTokenOnBehalfOf({
      oboAssertion: user.rawAccessToken,
      scopes,
      skipCache: false,
    });

    if (!result?.accessToken) {
      throw new UpstreamError('OBO token acquisition failed');
    }

    return { authorization: `Bearer ${result.accessToken}` };
  }
}

export function createAuthenticationProvider(): OutboundAuthenticationProvider {
  if (config.MCP_AUTH_MODE === 'obo') return new OboAuthenticationProvider();
  if (config.MCP_AUTH_MODE === 'api-key') return new ApiKeyAuthenticationProvider();
  return new NoAuthenticationProvider();
}
