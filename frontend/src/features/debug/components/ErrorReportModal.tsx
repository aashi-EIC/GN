import { AlertTriangle, Clipboard } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { IssueReport, Message } from "../../../shared/types/app";
import type { ModelId } from "../../chat/types/semantic";
import { createId } from "../../../shared/utils/session";
import { Modal } from "../../../shared/components/Modal";

export function ErrorReportModal({
  close,
  submitIssue,
  activeConversationId,
  modelId,
  modelName,
  lastUserMessage,
}: {
  close: () => void;
  submitIssue: (issue: IssueReport) => void;
  activeConversationId: string | null;
  modelId: ModelId;
  modelName: string;
  lastUserMessage?: Message;
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
      modelName,
      lastMessage: lastUserMessage
        ? {
            id: lastUserMessage.id,
            role: lastUserMessage.role,
            text: lastUserMessage.text,
            createdAt: lastUserMessage.createdAt,
          }
        : undefined,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <Modal close={close} label="Report an issue">
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
          Selected model
          <input value={modelName} readOnly />
        </label>
        {lastUserMessage && (
          <label>
            Your last question
            <textarea value={lastUserMessage.text} readOnly aria-label="Your last question" />
          </label>
        )}
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
