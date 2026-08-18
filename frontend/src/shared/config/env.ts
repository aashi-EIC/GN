function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  entraTenantId: import.meta.env.VITE_ENTRA_TENANT_ID || "organizations",
  entraClientId: import.meta.env.VITE_ENTRA_CLIENT_ID || "",
  entraApiScope: import.meta.env.VITE_ENTRA_API_SCOPE || "User.Read",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1",
  apiTimeoutMs: readPositiveNumber(import.meta.env.VITE_API_TIMEOUT_MS, 70_000),
} as const;
