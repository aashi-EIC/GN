/// <reference types="vite/client" />

interface Window {
  __APP_CONFIG__?: {
    VITE_CHAT_STREAMING_ENABLED?: string;
    VITE_API_BASE_URL?: string;
    VITE_API_TIMEOUT_MS?: string;
  };
}
