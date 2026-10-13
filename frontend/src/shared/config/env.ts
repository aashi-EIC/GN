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
} as const;
