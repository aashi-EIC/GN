function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const runtimeConfig = window.__APP_CONFIG__ ?? {};

function readConfig(runtimeValue: string | undefined, buildValue: string | undefined) {
  return runtimeValue?.trim() || buildValue?.trim() || "";
}

export const env = {
  chatStreamingEnabled:
    readConfig(
      runtimeConfig.VITE_CHAT_STREAMING_ENABLED,
      import.meta.env.VITE_CHAT_STREAMING_ENABLED,
    ) === "true",
  apiBaseUrl:
    readConfig(runtimeConfig.VITE_API_BASE_URL, import.meta.env.VITE_API_BASE_URL) ||
    "http://localhost:3000/api/v1",
  apiTimeoutMs: readPositiveNumber(
    readConfig(runtimeConfig.VITE_API_TIMEOUT_MS, import.meta.env.VITE_API_TIMEOUT_MS),
    70_000,
  ),
  entraEnabled:
    readConfig(runtimeConfig.VITE_ENTRA_ENABLED, import.meta.env.VITE_ENTRA_ENABLED) === "true",
  entraClientId: readConfig(runtimeConfig.VITE_ENTRA_CLIENT_ID, import.meta.env.VITE_ENTRA_CLIENT_ID),
  entraTenantId:
    readConfig(runtimeConfig.VITE_ENTRA_TENANT_ID, import.meta.env.VITE_ENTRA_TENANT_ID) || "common",
  entraRedirectUri:
    readConfig(runtimeConfig.VITE_ENTRA_REDIRECT_URI, import.meta.env.VITE_ENTRA_REDIRECT_URI) ||
    (typeof window !== "undefined" ? window.location.origin : ""),
  entraAuthority: readConfig(runtimeConfig.VITE_ENTRA_AUTHORITY, import.meta.env.VITE_ENTRA_AUTHORITY),
  entraApiScope: readConfig(
    runtimeConfig.VITE_ENTRA_API_SCOPE,
    import.meta.env.VITE_ENTRA_API_SCOPE,
  ),
  entraScopes: (() => {
    const raw = readConfig(
      runtimeConfig.VITE_ENTRA_SCOPES,
      import.meta.env.VITE_ENTRA_SCOPES,
    );
    const apiScope = readConfig(
      runtimeConfig.VITE_ENTRA_API_SCOPE,
      import.meta.env.VITE_ENTRA_API_SCOPE,
    );
    const list = raw
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (apiScope && !list.includes(apiScope)) {
      list.unshift(apiScope);
    }
    return list.length > 0 ? list : ["User.Read"];
  })(),
} as const;

