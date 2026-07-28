export const env = {
  entraTenantId: import.meta.env.VITE_ENTRA_TENANT_ID || "organizations",
  entraClientId: import.meta.env.VITE_ENTRA_CLIENT_ID || "",
  entraApiScope: import.meta.env.VITE_ENTRA_API_SCOPE || "User.Read",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1",
  cloudBiLoginUrl: import.meta.env.VITE_CLOUD_BI_LOGIN_URL || "/api/auth/cloud-bi/login",
  cloudBiSessionUrl: import.meta.env.VITE_CLOUD_BI_SESSION_URL || "/api/auth/cloud-bi/session",
  cloudBiLogoutUrl: import.meta.env.VITE_CLOUD_BI_LOGOUT_URL || "/api/auth/cloud-bi/logout",
} as const;
