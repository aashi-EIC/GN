import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { ModelId } from "../../features/chat/types/semantic";
import { getModel } from "../../features/chat/utils/semantic";

type SpotlightRect = { top: number; left: number; width: number; height: number };

const TOUR_TARGETS = [
  [".welcome-composer"],
  [".welcome .model-picker"],
  [".sidebar.open .history-label-row", ".sidebar.closed .collapsed-brand-trigger"],
  [".header-actions"],
  [],
] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

function cardPosition(rect: SpotlightRect | null) {
  if (!rect || window.innerWidth <= 640) return undefined;

  const width = 420;
  const height = 350;
  const gap = 16;
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const fitsRight = right + gap + width < window.innerWidth - 16;
  const fitsLeft = rect.left - gap - width > 16;

  if (fitsRight || fitsLeft) {
    return {
      left: fitsRight ? right + gap : rect.left - width - gap,
      top: clamp(
        rect.top + rect.height / 2 - height / 2,
        16,
        Math.max(16, window.innerHeight - height - 16),
      ),
    };
  }

  return {
    left: clamp(rect.left, 16, Math.max(16, window.innerWidth - width - 16)),
    top:
      bottom + gap + height < window.innerHeight
        ? bottom + gap
        : clamp(rect.top - height - gap, 16, Math.max(16, window.innerHeight - height - 16)),
  };
}

export function TourModal({ close, modelId }: { close: () => void; modelId: ModelId }) {
  const model = getModel(modelId);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const steps = [
    {
      eyebrow: "Getting started",
      title: "Ask in plain English",
      description:
        "Start with a question about your data. Continue in the same chat to explore the result with follow-ups.",
      tipLabel: "Try asking",
      tip: model.prompts[0] ?? "Ask a question about your selected model.",
    },
    {
      eyebrow: "Choose your data",
      title: "Pick the right semantic model",
      description:
        "Choose the Power BI data for your question before sending it. Each chat keeps its selected model.",
      tipLabel: "Selected model",
      tip: `${model.name}: ${model.guide}`,
    },
    {
      eyebrow: "Keep your context",
      title: "Return to recent chats",
      description:
        "Find earlier conversations in the sidebar, or start a fresh one whenever you need a clean slate.",
      tipLabel: "Remember",
      tip: "Follow-up questions stay in the same conversation and retain its selected model.",
    },
    {
      eyebrow: "Make it yours",
      title: "Use the header controls",
      description: "Switch themes, or open the model guide for details and suggested questions.",
      tipLabel: "Your preference",
      tip: "Your theme choice is remembered in this browser.",
    },
    {
      eyebrow: "After an answer",
      title: "Explore and share the result",
      description:
        "Copy, rate, retry, or report an answer. Debug details show the underlying request when you need it.",
      tipLabel: "Next step",
      tip: "Type /tour in the chat box whenever you want to revisit this walkthrough.",
    },
  ];
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const position = cardPosition(spotlight);

  useLayoutEffect(() => {
    const target = TOUR_TARGETS[stepIndex]
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .find((element) => element && element.getBoundingClientRect().width > 0);

    if (!target) {
      setSpotlight(null);
      return;
    }

    const update = () => {
      const bounds = target.getBoundingClientRect();
      const padding = 8;
      setSpotlight({
        top: Math.max(0, bounds.top - padding),
        left: Math.max(0, bounds.left - padding),
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [stepIndex]);

  useEffect(() => {
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    dialogRef.current?.focus();

    return () => {
      if (root) root.inert = wasInert;
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".welcome-composer textarea")?.focus(),
      );
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [stepIndex]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowRight" && !isLastStep) {
      event.preventDefault();
      setStepIndex((current) => current + 1);
    } else if (event.key === "ArrowLeft" && stepIndex > 0) {
      event.preventDefault();
      setStepIndex((current) => current - 1);
    } else if (event.key === "Tab") {
      const buttons =
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <div className="guided-tour">
      {spotlight ? (
        <div className="guided-tour-spotlight" style={spotlight} aria-hidden="true" />
      ) : (
        <div className="guided-tour-backdrop" aria-hidden="true" />
      )}
      <section
        ref={dialogRef}
        className={`guided-tour-card ${position ? "is-anchored" : ""} ${spotlight && spotlight.top > window.innerHeight * 0.42 ? "is-mobile-top" : ""}`}
        style={position}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="guided-tour-topline">
          <span className="guided-tour-label">
            <span className="guided-tour-brand-dot" aria-hidden="true" />
            Workspace tour
          </span>
          <span className="guided-tour-top-actions">
            <span className="guided-tour-step-count">
              {String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
            </span>
            <button
              className="guided-tour-close"
              type="button"
              onClick={close}
              aria-label="Close walkthrough"
            >
              <X aria-hidden="true" />
            </button>
          </span>
        </div>
        <div className="guided-tour-content" key={stepIndex}>
          <p className="guided-tour-eyebrow">{step.eyebrow}</p>
          <h2 id="guided-tour-title">{step.title}</h2>
          <p id="guided-tour-description">{step.description}</p>
          <div className="guided-tour-tip">
            <span>{step.tipLabel}</span>
            {step.tip}
          </div>
        </div>
        <div
          className="guided-tour-progress"
          role="progressbar"
          aria-label="Walkthrough progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={stepIndex + 1}
        >
          {steps.map((item, index) => (
            <span
              key={item.title}
              className={
                index === stepIndex ? "is-current" : index < stepIndex ? "is-complete" : ""
              }
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="guided-tour-actions">
          <button className="guided-tour-skip" type="button" onClick={close}>
            {isLastStep ? "Close guide" : "Skip for now"}
          </button>
          <div>
            {stepIndex > 0 ? (
              <button
                className="guided-tour-back"
                type="button"
                onClick={() => setStepIndex((current) => current - 1)}
              >
                <ArrowLeft aria-hidden="true" /> Back
              </button>
            ) : null}
            <button
              className="guided-tour-next"
              type="button"
              onClick={isLastStep ? close : () => setStepIndex((current) => current + 1)}
            >
              {isLastStep ? (
                <>
                  Get started <Check aria-hidden="true" />
                </>
              ) : (
                <>
                  Continue <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
