export const env = {
  entraTenantId: import.meta.env.VITE_ENTRA_TENANT_ID || "organizations",
  entraClientId: import.meta.env.VITE_ENTRA_CLIENT_ID || "",
  entraApiScope: import.meta.env.VITE_ENTRA_API_SCOPE || "User.Read",
  mcpHostUrl: import.meta.env.VITE_MCP_HOST_URL || "/api/mcp",
  cloudBiLoginUrl: import.meta.env.VITE_CLOUD_BI_LOGIN_URL || "/api/auth/cloud-bi/login",
  cloudBiSessionUrl: import.meta.env.VITE_CLOUD_BI_SESSION_URL || "/api/auth/cloud-bi/session",
  cloudBiLogoutUrl: import.meta.env.VITE_CLOUD_BI_LOGOUT_URL || "/api/auth/cloud-bi/logout",
} as const;
