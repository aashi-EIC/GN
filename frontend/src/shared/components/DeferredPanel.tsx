import { Component, Suspense, useEffect, type ReactNode } from "react";
import { Modal } from "./Modal";

type PanelProps = {
  children: ReactNode;
  label: string;
  close: () => void;
};

class PanelErrorBoundary extends Component<PanelProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <Modal close={this.props.close} label={this.props.label}>
        <h2>{this.props.label} couldn't be opened</h2>
        <p role="alert">Refresh the page and try again. Your saved chats haven't changed.</p>
      </Modal>
    );
  }
}

function PendingPanel({ label, close }: Omit<PanelProps, "children">) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [close]);
  return (
    <span className="sr-only" role="status">
      Opening {label.toLowerCase()}…
    </span>
  );
}

export function DeferredPanel({ children, label, close }: PanelProps) {
  return (
    <PanelErrorBoundary label={label} close={close}>
      <Suspense fallback={<PendingPanel label={label} close={close} />}>{children}</Suspense>
    </PanelErrorBoundary>
  );
}
