import { storageKeys } from "../config/storage";
import { createSessionId, isSessionId } from "./session";

let fallbackBrowserUserId: string | undefined;

/**
 * Returns a browser-scoped correlation ID, not an authentication credential.
 */
export function getBrowserUserId(): string {
  try {
    const storedId = localStorage.getItem(storageKeys.browserUserId);
    if (storedId && isSessionId(storedId)) return storedId;

    const browserUserId = createSessionId();
    localStorage.setItem(storageKeys.browserUserId, browserUserId);
    return browserUserId;
  } catch {
    fallbackBrowserUserId ??= createSessionId();
    return fallbackBrowserUserId;
  }
}
