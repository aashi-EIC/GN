import { AlertTriangle, Clipboard } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { FeedbackValue, IssueReport, Message } from "../../../shared/types/app";
import type { ModelId } from "../../chat/types/semantic";
import { messageToPlainText } from "../../../shared/utils/clipboard";
import { createId } from "../../../shared/utils/session";
import { Modal } from "../../../shared/components/Modal";
import { IconButton } from "../../../shared/components/ui/IconButton";
import { Copy, ThumbsDown, ThumbsUp } from "lucide-react";

export function ErrorReportModal({
  close,
  submitIssue,
  activeConversationId,
  modelId,
  modelName,
  lastMessage,
  lastMessageFeedback,
  copyMessage,
  markFeedback,
}: {
  close: () => void;
  submitIssue: (issue: IssueReport) => void;
  activeConversationId: string | null;
  modelId: ModelId;
  modelName: string;
  lastMessage?: Message;
  lastMessageFeedback?: FeedbackValue;
  copyMessage: (message: Message) => void;
  markFeedback: (messageId: string, value: FeedbackValue) => void;
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
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            role: lastMessage.role,
            text: lastMessage.text,
            createdAt: lastMessage.createdAt,
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
        {lastMessage && (
          <label>
            Last message sent
            <textarea
              value={messageToPlainText(lastMessage)}
              readOnly
              aria-label="Last message sent"
            />
            <div className="response-actions">
              <IconButton label="Copy response" onClick={() => copyMessage(lastMessage)}>
                <Copy />
              </IconButton>
              <IconButton
                label="Mark helpful"
                active={lastMessageFeedback === "helpful"}
                onClick={() => markFeedback(lastMessage.id, "helpful")}
              >
                <ThumbsUp />
              </IconButton>
              <IconButton
                label="Mark not helpful"
                active={lastMessageFeedback === "not-helpful"}
                onClick={() => markFeedback(lastMessage.id, "not-helpful")}
              >
                <ThumbsDown />
              </IconButton>
            </div>
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
