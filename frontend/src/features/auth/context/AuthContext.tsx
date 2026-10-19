import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import type { UserProfile } from "../../../shared/types/app";
import { setAuthTokenProvider } from "../../../shared/services/tokenStore";
import {
  isEntraConfigured,
  getActiveEntraAccount,
  loginWithEntra,
  logoutFromEntra,
  acquireEntraToken,
} from "../services/msal";
import { env } from "../../../shared/config/env";
import type { AccountInfo } from "@azure/msal-browser";

export type AuthUser = UserProfile & {
  tenantId?: string;
  objectId?: string;
  roles?: string[];
  initials?: string;
};

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  isEntraEnabled: boolean;
  authError: string | null;
}

const LOCAL_USER: AuthUser = {
  name: "Workspace User",
  email: "workspace@local",
  authProvider: "Local Workspace",
  initials: "WU",
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: true,
  isLoading: false,
  user: LOCAL_USER,
  login: async () => { },
  logout: async () => { },
  getAccessToken: async () => null,
  isEntraEnabled: false,
  authError: null,
});

function calculateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mapAccountToUser(account: AccountInfo): AuthUser {
  const name = account.name || account.username || "Entra User";
  const idClaims = account.idTokenClaims as Record<string, unknown> | undefined;
  const rawRoles = idClaims?.roles;
  const roles = Array.isArray(rawRoles)
    ? (rawRoles as string[])
    : typeof rawRoles === "string"
      ? [rawRoles]
      : [];

  return {
    name,
    email: account.username || (idClaims?.preferred_username as string) || (idClaims?.email as string) || "",
    authProvider: "Microsoft Entra ID",
    tenantId: account.tenantId,
    objectId: account.localAccountId,
    roles,
    initials: calculateInitials(name),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isEnabled = env.entraEnabled;
  const [isLoading, setIsLoading] = useState(isEnabled);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isEnabled && isEntraConfigured()) {
      setAuthTokenProvider(acquireEntraToken);
    } else {
      setAuthTokenProvider(null);
    }
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      setIsLoading(false);
      return;
    }

    if (!isEntraConfigured()) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const current = await getActiveEntraAccount();
        if (isMounted) {
          setAccount(current);
        }
      } catch (err) {
        console.error("Error discovering active Entra account:", err);
        if (isMounted) {
          setAuthError(err instanceof Error ? err.message : "Failed to load authentication state");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isEnabled]);

  const handleLogin = useCallback(async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const loggedInAccount = await loginWithEntra();
      if (loggedInAccount) {
        setAccount(loggedInAccount);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microsoft Entra sign-in failed";
      setAuthError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutFromEntra();
      setAccount(null);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const user: AuthUser = useMemo(() => {
    if (!isEnabled || !account) {
      return LOCAL_USER;
    }
    return mapAccountToUser(account);
  }, [isEnabled, account]);

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated: !isEnabled || Boolean(account),
      isLoading,
      user,
      login: handleLogin,
      logout: handleLogout,
      getAccessToken: acquireEntraToken,
      isEntraEnabled: isEnabled,
      authError,
    }),
    [isEnabled, account, isLoading, user, handleLogin, handleLogout, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
