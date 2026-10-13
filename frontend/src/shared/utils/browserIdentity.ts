import { storageKeys } from "../config/storage";
import { createSessionId, isSessionId } from "./session";

let fallbackBrowserUserId: string | undefined;

/**
 * Returns an anonymous correlation ID for this browser profile. This value
 * separates demo traffic; it is user-controlled and must never authorize access.
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
