import { ConfidentialClientApplication, type Configuration, LogLevel } from "@azure/msal-node";
import { config, getDownstreamScopes, getOboTenantId, getRequired } from "../config/env.js";
import { ConfigurationError, UpstreamError } from "../errors.js";
import { logger } from "../observability/logger.js";

let confidentialClientApp: ConfidentialClientApplication | null = null;

export function isOboConfigured(): boolean {
  return (
    config.MCP_AUTH_MODE === "obo" &&
    Boolean(config.OBO_CLIENT_ID && config.OBO_CLIENT_SECRET && config.OBO_DOWNSTREAM_SCOPE)
  );
}

function createMsalNodeConfiguration(): Configuration {
  const tenantId = getOboTenantId();
  const clientId = getRequired("OBO_CLIENT_ID");
  const clientSecret = getRequired("OBO_CLIENT_SECRET");

  return {
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          if (level === LogLevel.Error) {
            logger.error({ msalMessage: message }, "[MSAL-Node] Error");
          } else if (level === LogLevel.Warning) {
            logger.warn({ msalMessage: message }, "[MSAL-Node] Warning");
          }
        },
        logLevel: LogLevel.Warning,
      },
    },
  };
}

export function getConfidentialClientApplication(): ConfidentialClientApplication {
  if (!confidentialClientApp) {
    confidentialClientApp = new ConfidentialClientApplication(createMsalNodeConfiguration());
  }
  return confidentialClientApp;
}

export async function acquireTokenOnBehalfOf(
  userAssertion: string,
  targetScopes?: string[],
): Promise<string> {
  if (!userAssertion || !userAssertion.trim()) {
    throw new ConfigurationError("Inbound user token is required for On-Behalf-Of (OBO) token exchange");
  }

  const client = getConfidentialClientApplication();
  const scopes = targetScopes && targetScopes.length > 0 ? targetScopes : getDownstreamScopes();

  try {
    const result = await client.acquireTokenOnBehalfOf({
      oboAssertion: userAssertion,
      scopes,
      skipCache: false,
    });

    if (!result?.accessToken) {
      throw new UpstreamError("Microsoft Entra OBO token exchange did not return an access token");
    }

    return result.accessToken;
  } catch (error) {
    if (error instanceof UpstreamError || error instanceof ConfigurationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, "MSAL OBO token acquisition failed");
    throw new UpstreamError(`Microsoft Entra OBO token exchange failed: ${message}`, undefined, 502);
  }
}
