import { Braces, CircleGauge, LogOut, UserRound } from "lucide-react";
import { useEffect } from "react";
import type { SettingsState } from "../../../shared/types/app";

export function SettingsModal({
  close,
  settings,
  saveSettings,
  toggleDebug,
  onSignOut,
}: {
  close: () => void;
  settings: SettingsState;
  saveSettings: (settings: SettingsState) => void;
  toggleDebug?: () => void;
  themeMode?: "light" | "dark";
  toggleTheme?: () => void;
  onSignOut?: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  const updateDisplayName = (name: string) => {
    saveSettings({ ...settings, displayName: name });
  };

  return (
    <div
      className="settings-sidebar-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <aside
        className="sidebar-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace settings"
      >
        <div className="sidebar-settings-form">
          <label className="sidebar-settings-row">
            <UserRound />
            <span>Display name</span>
            <input
              value={settings.displayName}
              onChange={(event) => updateDisplayName(event.target.value)}
              aria-label="Display name"
            />
          </label>

          <div className="sidebar-settings-usage">
            <div className="usage-title">
              <CircleGauge />
              <span>Token usage</span>
            </div>
            <div>
              <span>Input tokens</span>
              <strong>-</strong>
            </div>
          </div>

          {toggleDebug && (
            <button
              type="button"
              className={`sidebar-settings-row ${settings.keepDebugOpen ? "active" : ""}`}
              onClick={toggleDebug}
              aria-pressed={settings.keepDebugOpen}
            >
              <Braces />
              <span>
                Debug responses
                <small>Show raw MCP and processed BFF payloads</small>
              </span>
              <span
                className={`settings-switch ${settings.keepDebugOpen ? "active" : ""}`}
                aria-hidden="true"
              >
                <span className="settings-switch-thumb" />
              </span>
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              className="sidebar-settings-row signout"
              onClick={() => {
                close();
                onSignOut();
              }}
            >
              <LogOut />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
