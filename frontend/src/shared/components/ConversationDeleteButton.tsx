import { Check, LoaderCircle, Trash2 } from "lucide-react";

export type ConversationDeleteStatus = "idle" | "deleting" | "deleted" | "error";

export function ConversationDeleteButton({
  status,
  onDelete,
}: {
  status: ConversationDeleteStatus;
  onDelete: () => void;
}) {
  const disabled = status === "deleting" || status === "deleted";
  const label =
    status === "deleted"
      ? "Deleted"
      : status === "deleting"
        ? "Deleting..."
        : status === "error"
          ? "Try again"
          : "Delete Chat";

  return (
    <button
      type="button"
      role="menuitem"
      className={`history-delete-action ${status === "deleted" ? "delete-confirmed" : "danger"}`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (!disabled) onDelete();
      }}
    >
      {status === "deleted" ? (
        <Check aria-hidden="true" />
      ) : status === "deleting" ? (
        <LoaderCircle className="history-delete-spinner" aria-hidden="true" />
      ) : (
        <Trash2 aria-hidden="true" />
      )}
      <span aria-live="polite">{label}</span>
    </button>
  );
}
