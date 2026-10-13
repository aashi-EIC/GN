import { AlertTriangle, Check, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { ToastState } from "../types/app";
import "./toastNotification.css";

export function ToastNotification({
  message,
  tone,
  dismiss,
}: ToastState & { dismiss: () => void }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`workspace-notification ${tone}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <span className="workspace-notification-icon" aria-hidden="true">
        {tone === "warning" ? <AlertTriangle /> : <Check />}
      </span>
      <span className="workspace-notification-message">{message}</span>
      <button
        className="workspace-notification-dismiss"
        type="button"
        aria-label="Dismiss notification"
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </button>
    </motion.div>
  );
}
