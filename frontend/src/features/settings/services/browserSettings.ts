import { defaultSettings, storageKeys } from "../../../shared/config/storage";
import type { SettingsState, TablePageSize } from "../../../shared/types/app";

export const TABLE_PAGE_SIZE_MIN = 1;
export const TABLE_PAGE_SIZE_MAX = 100;

export function normalizeTablePageSize(
  value: unknown,
  fallback: TablePageSize = defaultSettings.tablePageSize,
): TablePageSize {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(TABLE_PAGE_SIZE_MAX, Math.max(TABLE_PAGE_SIZE_MIN, Math.trunc(parsed)));
}

// This distribution has one shared backend identity. Personal preferences stay on this device.
export function readBrowserSettings(): SettingsState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKeys.settings) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return defaultSettings;
    const saved = value as Record<string, unknown>;
    return {
      displayName: typeof saved.displayName === "string" ? saved.displayName.slice(0, 120) : "",
      region: typeof saved.region === "string" && saved.region.trim() ? saved.region : "Global",
      density: saved.density === "compact" ? "compact" : "comfortable",
      keepDebugOpen: saved.keepDebugOpen === true,
      tablePageSize: normalizeTablePageSize(saved.tablePageSize),
    };
  } catch {
    return defaultSettings;
  }
}

export function persistBrowserSettings(settings: SettingsState): string | null {
  try {
    localStorage.setItem(storageKeys.settings, JSON.stringify(settings));
    return null;
  } catch {
    return "Could not save preferences. Allow browser storage to keep them after a refresh.";
  }
}
