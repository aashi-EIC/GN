import { useEffect, useState } from "react";

const COMMAND_HINTS = [
  "Type / to browse commands",
  "Type /help for a guided tour",
  "Type /new to start fresh",
] as const;

type Frame = { index: number; length: number; deleting: boolean };

export function MagicCommandHint() {
  const [frame, setFrame] = useState<Frame>({ index: 0, length: 0, deleting: false });

  useEffect(() => {
    const hint = COMMAND_HINTS[frame.index];
    const delay = frame.deleting
      ? frame.length === 0
        ? 360
        : 32
      : frame.length === hint.length
        ? 1500
        : 58;

    const timer = window.setTimeout(() => {
      setFrame((current) => {
        const currentHint = COMMAND_HINTS[current.index];
        if (current.deleting) {
          return current.length > 0
            ? { ...current, length: current.length - 1 }
            : { index: (current.index + 1) % COMMAND_HINTS.length, length: 0, deleting: false };
        }
        return current.length < currentHint.length
          ? { ...current, length: current.length + 1 }
          : { ...current, deleting: true };
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [frame]);

  const hint = COMMAND_HINTS[frame.index];

  return (
    <div className="magic-command-hint" aria-hidden="true">
      <span className="magic-command-text">{hint.slice(0, frame.length)}</span>
      <span className="magic-command-caret" />
    </div>
  );
}
