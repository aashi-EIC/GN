import React, { useId, useState } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  disabled?: boolean;
  className?: string;
}

export function Tooltip({ content, children, disabled = false, className = "" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  if (disabled || !content) {
    return children;
  }

  return (
    <div
      className={`tooltip-container ${className}`}
      tabIndex={0}
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setVisible(false);
      }}
    >
      {children}
      {visible && (
        <div className="tooltip-bubble" id={tooltipId} role="tooltip">
          {content}
        </div>
      )}
    </div>
  );
}
