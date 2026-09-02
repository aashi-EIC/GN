/// <reference types="vite/client" />

interface Window {
  __APP_CONFIG__?: {
    VITE_ENTRA_CLIENT_ID?: string;
    VITE_ENTRA_TENANT_ID?: string;
    VITE_ENTRA_API_SCOPE?: string;
    VITE_API_BASE_URL?: string;
    VITE_API_TIMEOUT_MS?: string;
  };
}
