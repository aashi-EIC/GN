import { AlertTriangle, Clipboard } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { IssueReport } from "../../types/app";
import type { ModelId } from "../../types/semantic";
import { createId } from "../../utils/session";
import { Modal } from "./Modal";

export function ErrorReportModal({
  close,
  submitIssue,
  activeConversationId,
  modelId,
}: {
  close: () => void;
  submitIssue: (issue: IssueReport) => void;
  activeConversationId: string | null;
  modelId: ModelId;
}) {
  const [category, setCategory] = useState("Answer quality");
  const [severity, setSeverity] = useState("Medium");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (description.trim().length < 12) {
      setError("Add at least 12 characters so the team has enough context.");
      return;
    }

    submitIssue({
      id: createId("NI"),
      category,
      severity,
      description: description.trim(),
      conversationId: activeConversationId,
      modelId,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <Modal close={close}>
      <span className="modal-icon warning">
        <AlertTriangle />
      </span>
      <h2>Report an issue</h2>
      <form className="modal-form" onSubmit={submit}>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Answer quality</option>
            <option>Data freshness</option>
            <option>Chart mismatch</option>
            <option>Access problem</option>
          </select>
        </label>
        <label>
          Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Critical</option>
          </select>
        </label>
        <label>
          Issue details
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-label="Issue details"
          />
        </label>
        {error && <strong className="form-error">{error}</strong>}
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary-action" type="submit">
            <Clipboard />
            Save issue
          </button>
        </div>
      </form>
    </Modal>
  );
}
