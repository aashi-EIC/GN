import type { ReactNode } from "react";
import { Button } from "./Button";

export function IconButton({
  label,
  onClick,
  children,
  className = "",
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`icon-btn ${className} ${active ? "active" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active || undefined}
      data-tooltip={label}
      disabled={disabled}
      type="button"
    >
      {children}
    </Button>
  );
}
