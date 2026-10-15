type TokenProvider = () => Promise<string | null>;

let currentTokenProvider: TokenProvider | null = null;

export function setAuthTokenProvider(provider: TokenProvider | null) {
  currentTokenProvider = provider;
}

export async function getAuthToken(): Promise<string | null> {
  if (!currentTokenProvider) return null;
  try {
    return await currentTokenProvider();
  } catch (err) {
    console.warn("Failed to acquire auth token:", err);
    return null;
  }
}
