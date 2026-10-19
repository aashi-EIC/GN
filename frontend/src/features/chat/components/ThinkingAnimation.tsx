import { useEffect, useMemo, useState } from "react";
import { generateThinkingSteps } from "../utils/keywordExtractor";
import "./thinkingAnimation.css";

export interface ThinkingAnimationProps {
  prompt?: string;
  preview?: boolean;
  statusText?: string;
  className?: string;
}

export function ThinkingAnimation({
  prompt,
  preview = false,
  statusText,
  className = "",
}: ThinkingAnimationProps) {
  const steps = useMemo(() => generateThinkingSteps(prompt), [prompt]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Reset index when prompt changes
  useEffect(() => {
    setCurrentStepIndex(0);
  }, [prompt]);

  // Cycle through thinking steps while waiting for response streaming to start
  useEffect(() => {
    if (preview || statusText) {
      return;
    }

    if (steps.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentStepIndex((prevIndex) => {
        // Once all steps are traversed, cycle through steps 1..end so it stays alive
        if (prevIndex + 1 < steps.length) {
          return prevIndex + 1;
        }
        return steps.length > 2 ? 1 : 0;
      });
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [preview, statusText, steps]);

  const activeText = preview
    ? "Writing response…"
    : statusText || steps[currentStepIndex] || "Analyzing your data…";

  return (
    <div
      className={`thinking ${preview ? "streaming-status" : ""} ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={preview ? "streaming-dots" : "thinking-wave"} aria-hidden="true">
        <i />
        <i />
        <i />
        {!preview && <i />}
      </span>
      <span className="thinking-label">
        <span
          key={preview ? "writing-response" : `${currentStepIndex}-${activeText}`}
          className="thinking-step-text"
        >
          {activeText}
        </span>
      </span>
    </div>
  );
}

export default ThinkingAnimation;
