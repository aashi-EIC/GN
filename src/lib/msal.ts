import type { Configuration } from "@azure/msal-browser";
import { env } from "../config/env";

export const apiScope = env.entraApiScope;

export const entraSettingsAreConfigured =
  Boolean(env.entraClientId) && !env.entraClientId.startsWith("00000000");

export const msalConfig: Configuration = {
  auth: {
    clientId: env.entraClientId || "00000000-0000-0000-0000-000000000000",
    authority: `https://login.microsoftonline.com/${env.entraTenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
  system: {
    allowPlatformBroker: false,
  },
};
