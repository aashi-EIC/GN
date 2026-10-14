import { useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { getCountryLocale } from "../../../shared/constants/locales";
import type { CountryCode, ModelId } from "../types/semantic";
import { getModel } from "../utils/semantic";
import { startVoiceInput } from "../utils/speech";
import { ModelPicker } from "./ModelPicker";
import { ChatPromptInput } from "./ChatPromptInput";
import { TeamFooter } from "../../../shared/components/TeamFooter";

export function Composer({
  prompt,
  setPrompt,
  submitPrompt,
  busy,
  modelId,
  setModelId,
  modelsOpen,
  setModelsOpen,
  modelLocked,
  countryCode,
  showMagicHint,
  dismissMagicHint,
}: {
  prompt: string;
  setPrompt: (prompt: string) => void;
  submitPrompt: (prompt?: string) => void;
  busy: boolean;
  modelId: ModelId;
  setModelId: (modelId: ModelId) => void;
  modelsOpen: boolean;
  setModelsOpen: (open: boolean) => void;
  modelLocked: boolean;
  countryCode: CountryCode;
  showMagicHint: boolean;
  dismissMagicHint: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  const model = getModel(modelId);
  const locale = getCountryLocale(countryCode);

  return (
    <div className="composer-wrap">
      <div className="composer" aria-busy={busy} onPointerDown={dismissMagicHint}>
        <ChatPromptInput
          prompt={prompt}
          setPrompt={setPrompt}
          submitPrompt={submitPrompt}
          label={"Ask " + model.name}
          showMagicHint={showMagicHint}
          dismissMagicHint={dismissMagicHint}
          disabled={busy}
        />
        <div className="composer-bottom">
          <ModelPicker
            modelId={modelId}
            setModelId={setModelId}
            open={modelsOpen}
            setOpen={setModelsOpen}
            compact
            disabled={busy || modelLocked}
          />
          <div className="composer-actions">
            <button
              className={`mic-btn ${isRecording ? "recording" : ""}`}
              onClick={() =>
                startVoiceInput(
                  prompt,
                  (nextPrompt) => {
                    if (!busyRef.current) setPrompt(nextPrompt);
                  },
                  locale.speechLocale,
                  () => setIsRecording(true),
                  () => setIsRecording(false),
                )
              }
              type="button"
              aria-label="Use voice input"
              disabled={busy}
            >
              <Mic />
            </button>
            <button
              className="send-btn"
              onClick={() => submitPrompt()}
              disabled={busy || !prompt.trim()}
              type="button"
              aria-label={locale.sendLabel}
            >
              <Send />
            </button>
          </div>
        </div>
      </div>
      <TeamFooter className="chat-team-footer" />
    </div>
  );
}
