import type { ReactNode } from "react";
import { Button } from "./Button";

export function IconButton({
  label,
  onClick,
  children,
  className = "",
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`icon-btn ${className} ${active ? "active" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      type="button"
    >
      {children}
    </Button>
  );
}

export function IconTextButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant="outline" size="sm" className="outline" onClick={onClick} type="button">
      {children}
      <span>{label}</span>
    </Button>
  );
}
