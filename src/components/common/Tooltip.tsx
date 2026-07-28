import React, { useState } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  disabled?: boolean;
  className?: string;
}

export function Tooltip({ content, children, disabled = false, className = "" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  if (disabled || !content) {
    return children;
  }

  return (
    <div
      className={`tooltip-container ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && <div className="tooltip-bubble">{content}</div>}
    </div>
  );
}
