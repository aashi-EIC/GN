import {
  Check,
  CircleGauge,
  Code2,
  LogOut,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { SettingsState } from "../../../shared/types/app";

export function SettingsModal({
  close,
  settings,
  saveSettings,
  toggleDebug,
  themeMode,
  toggleTheme,
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
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    saveSettings(draft);
    close();
  };

  return (
    <div
      className="settings-sidebar-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <aside
        className="gemini-sidebar-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace settings"
      >
        <form className="sidebar-settings-form" onSubmit={submit}>
          <label className="sidebar-settings-row">
            <UserRound />
            <span>Display name</span>
            <input
              value={draft.displayName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, displayName: event.target.value }))
              }
              aria-label="Display name"
            />
          </label>

          {toggleTheme && (
            <button type="button" className="sidebar-settings-row" onClick={toggleTheme}>
              {themeMode === "dark" ? <Sun /> : <Moon />}
              <span>Dark theme</span>
              <div className={`settings-switch ${themeMode === "dark" ? "active" : ""}`}>
                <span className="settings-switch-thumb" />
              </div>
            </button>
          )}

          {toggleDebug && (
            <button
              type="button"
              className="sidebar-settings-row"
              onClick={() => {
                setDraft((current) => ({
                  ...current,
                  keepDebugOpen: !current.keepDebugOpen,
                }));
                toggleDebug();
              }}
            >
              <Code2 />
              <span>Debug mode</span>
              <div className={`settings-switch ${draft.keepDebugOpen ? "active" : ""}`}>
                <span className="settings-switch-thumb" />
              </div>
            </button>
          )}

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

          <div className="sidebar-settings-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit">
              <Check />
              Save
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

