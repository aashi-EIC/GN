/// <reference types="vite/client" />

interface Window {
  __APP_CONFIG__?: {
    VITE_CHAT_STREAMING_ENABLED?: string;
    VITE_API_BASE_URL?: string;
    VITE_API_TIMEOUT_MS?: string;
    VITE_ENTRA_ENABLED?: string;
    VITE_ENTRA_CLIENT_ID?: string;
    VITE_ENTRA_TENANT_ID?: string;
    VITE_ENTRA_REDIRECT_URI?: string;
    VITE_ENTRA_AUTHORITY?: string;
    VITE_ENTRA_API_SCOPE?: string;
    VITE_ENTRA_SCOPES?: string;
  };
}

interface ImportMetaEnv {
  readonly VITE_CHAT_STREAMING_ENABLED?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_ENTRA_ENABLED?: string;
  readonly VITE_ENTRA_CLIENT_ID?: string;
  readonly VITE_ENTRA_TENANT_ID?: string;
  readonly VITE_ENTRA_REDIRECT_URI?: string;
  readonly VITE_ENTRA_AUTHORITY?: string;
  readonly VITE_ENTRA_API_SCOPE?: string;
  readonly VITE_ENTRA_SCOPES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
