import { Check, Settings } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Density, SettingsState } from "../../../shared/types/app";
import { Modal } from "../../../shared/components/Modal";

export function SettingsModal({
  close,
  settings,
  saveSettings,
  totalUsage,
}: {
  close: () => void;
  settings: SettingsState;
  saveSettings: (settings: SettingsState) => void;
  totalUsage: { inputTokens: number; outputTokens: number; cost: number };
}) {
  const [draft, setDraft] = useState(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    saveSettings(draft);
    close();
  };

  return (
    <Modal close={close}>
      <span className="modal-icon">
        <Settings />
      </span>
      <h2>Workspace settings</h2>
      <form className="modal-form" onSubmit={submit}>
        <label>
          Display name
          <input
            value={draft.displayName}
            onChange={(event) =>
              setDraft((current) => ({ ...current, displayName: event.target.value }))
            }
            aria-label="Display name"
          />
        </label>
        <label>
          Region
          <select
            value={draft.region}
            onChange={(event) =>
              setDraft((current) => ({ ...current, region: event.target.value }))
            }
          >
            <option>Global</option>
            <option>Americas</option>
            <option>EMEA</option>
            <option>Asia Pacific</option>
          </select>
        </label>
        <label>
          Density
          <select
            value={draft.density}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                density: event.target.value as Density,
              }))
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.keepDebugOpen}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                keepDebugOpen: event.target.checked,
              }))
            }
          />
          Keep debug events visible
        </label>

        <div className="settings-tokens-summary">
          <h3>Token Usage Summary</h3>
          <div className="settings-token-row">
            <span>Input Tokens</span>
            <strong>{totalUsage.inputTokens.toLocaleString()}</strong>
          </div>
          <div className="settings-token-row">
            <span>Output Tokens</span>
            <strong>{totalUsage.outputTokens.toLocaleString()}</strong>
          </div>
          <div className="settings-token-row">
            <span>Total Session Cost</span>
            <strong className="cost-value">${totalUsage.cost.toFixed(5)}</strong>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary-action" type="submit">
            <Check />
            Save settings
          </button>
        </div>
      </form>
    </Modal>
  );
}
