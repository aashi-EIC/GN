import {
  PublicClientApplication,
  type Configuration,
  type AccountInfo,
  type SilentRequest,
  type RedirectRequest,
  InteractionRequiredAuthError,
  LogLevel,
} from "@azure/msal-browser";
import { env } from "../../../shared/config/env";

export const apiScope = env.entraApiScope;

export const entraSettingsAreConfigured =
  Boolean(env.entraClientId) && !env.entraClientId.startsWith("00000000");

export function isEntraConfigured(): boolean {
  return Boolean(env.entraEnabled && env.entraClientId && env.entraClientId.trim());
}

export const msalConfig: Configuration = {
  auth: {
    clientId: env.entraClientId || "00000000-0000-0000-0000-000000000000",
    authority:
      env.entraAuthority || `https://login.microsoftonline.com/${env.entraTenantId || "common"}`,
    redirectUri: env.entraRedirectUri || (typeof window !== "undefined" ? window.location.origin : ""),
    postLogoutRedirectUri:
      env.entraRedirectUri || (typeof window !== "undefined" ? window.location.origin : ""),
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    allowPlatformBroker: false,
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) {
          console.error("[MSAL]", message);
        } else if (level === LogLevel.Warning) {
          console.warn("[MSAL]", message);
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

/**
 * Strips lingering MSAL authentication parameters (code, state, error)
 * from window.location.hash and window.location.search to prevent MSAL's
 * isInPopup() check from falsely identifying the main window as a nested popup.
 */
export function cleanStaleAuthUrl(): void {
  if (typeof window === "undefined") return;
  const { hash, search, pathname, origin } = window.location;
  const hasAuthParams =
    hash.includes("code=") ||
    hash.includes("state=") ||
    hash.includes("error=") ||
    search.includes("code=") ||
    search.includes("state=") ||
    search.includes("error=");

  if (hasAuthParams) {
    try {
      window.history.replaceState({}, document.title, origin + pathname);
    } catch {
      // Ignore in non-standard environments
    }
  }
}

let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<PublicClientApplication | null> | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication | null> {
  if (!isEntraConfigured()) return null;

  if (msalInstance) return msalInstance;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const pca = new PublicClientApplication(msalConfig);
        await pca.initialize();

        // Handle redirect promise if user arrived via redirect
        try {
          const redirectResponse = await pca.handleRedirectPromise();
          if (redirectResponse?.account) {
            pca.setActiveAccount(redirectResponse.account);
          } else {
            const accounts = pca.getAllAccounts();
            if (accounts.length > 0 && !pca.getActiveAccount()) {
              pca.setActiveAccount(accounts[0]);
            }
          }
        } catch (redirectError) {
          const isBenignCacheError =
            redirectError instanceof Error &&
            (redirectError.message.includes("no_token_request_cache_error") ||
              redirectError.message.includes("hash_empty_error"));
          if (!isBenignCacheError) {
            console.warn("[MSAL] Redirect handling encountered an unexpected error:", redirectError);
          }
        } finally {
          // Immediately remove any lingering state/code parameters so future
          // preflight checks do not mistake this page for an in-flight popup
          cleanStaleAuthUrl();
        }

        msalInstance = pca;
        return pca;
      } catch (error) {
        console.error("Failed to initialize MSAL:", error);
        initPromise = null;
        return null;
      }
    })();
  }

  return initPromise;
}

export async function getActiveEntraAccount(): Promise<AccountInfo | null> {
  const pca = await getMsalInstance();
  if (!pca) return null;

  let active = pca.getActiveAccount();
  if (!active) {
    const accounts = pca.getAllAccounts();
    if (accounts.length > 0) {
      active = accounts[0];
      pca.setActiveAccount(active);
    }
  }
  return active;
}

export async function loginWithEntra(): Promise<AccountInfo | null> {
  const pca = await getMsalInstance();
  if (!pca) throw new Error("Microsoft Entra ID is not enabled or configured");

  // If already authenticated in cache, restore and proceed immediately
  const existingAccount = pca.getActiveAccount() || pca.getAllAccounts()[0];
  if (existingAccount) {
    pca.setActiveAccount(existingAccount);
    return existingAccount;
  }

  const loginRequest: RedirectRequest = {
    scopes: env.entraScopes,
    prompt: "select_account",
  };

  await pca.loginRedirect(loginRequest);
  return null;
}

/**
 * Signs the user out of this application only (local logout).
 * Clears the active account and cached MSAL tokens for this application
 * WITHOUT navigating to Microsoft's global SSO sign-out endpoint (which would
 * terminate the user's Microsoft session across all other browser tabs like Teams, Outlook, etc.).
 */
export async function logoutFromEntra(): Promise<void> {
  const pca = await getMsalInstance();

  try {
    if (pca) {
      const activeAccount = pca.getActiveAccount();
      if (typeof pca.clearCache === "function") {
        await pca.clearCache({ account: activeAccount ?? undefined });
      }
      pca.setActiveAccount(null);
    }
  } catch (err) {
    console.warn("[MSAL] Error during local cache clearing:", err);
  }

  // Remove any remaining MSAL-related keys from localStorage and sessionStorage
  if (typeof window !== "undefined") {
    try {
      const clearMsalKeys = (storage: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && (key.toLowerCase().includes("msal") || key.toLowerCase().includes("entra"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => storage.removeItem(k));
      };

      clearMsalKeys(window.localStorage);
      clearMsalKeys(window.sessionStorage);
    } catch (storageErr) {
      console.warn("[MSAL] Error clearing storage keys:", storageErr);
    }

    cleanStaleAuthUrl();
  }
}

export async function acquireEntraToken(): Promise<string | null> {
  const pca = await getMsalInstance();
  if (!pca) return null;

  let account = pca.getActiveAccount();
  if (!account) {
    const accounts = pca.getAllAccounts();
    if (accounts.length > 0) {
      account = accounts[0];
      pca.setActiveAccount(account);
    } else {
      return null;
    }
  }

  // Request token with the BFF API scopes so the token is accepted for OBO
  const silentRequest: SilentRequest = {
    scopes: env.entraScopes,
    account,
  };

  try {
    const response = await pca.acquireTokenSilent(silentRequest);
    return response.accessToken || response.idToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      try {
        const response = await pca.acquireTokenPopup(silentRequest);
        return response.accessToken || response.idToken;
      } catch (popupError) {
        console.error("Interactive token acquisition failed:", popupError);
        return null;
      }
    }
    console.error("Token acquisition error:", error);
    return null;
  }
}
