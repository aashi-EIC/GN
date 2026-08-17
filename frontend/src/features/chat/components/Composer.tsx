import { useState } from "react";
import { Mic, Send } from "lucide-react";
import { getCountryLocale } from "../../../shared/constants/locales";
import type { CountryCode, ModelId } from "../types/semantic";
import { handleEnter } from "../../../shared/utils/keyboard";
import { getModel } from "../utils/semantic";
import { startVoiceInput } from "../utils/speech";
import { ModelPicker } from "./ModelPicker";

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
}) {
  const [isRecording, setIsRecording] = useState(false);
  const model = getModel(modelId);
  const locale = getCountryLocale(countryCode);

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          rows={1}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => handleEnter(event, () => submitPrompt())}
          aria-label={`Ask ${model.name}`}
          placeholder=""
        />
        <div className="composer-bottom">
          <ModelPicker
            modelId={modelId}
            setModelId={setModelId}
            open={modelsOpen}
            setOpen={setModelsOpen}
            compact
            disabled={modelLocked}
          />
          <div className="composer-actions">
            <button
              className={`mic-btn ${isRecording ? "recording" : ""}`}
              onClick={() =>
                startVoiceInput(
                  prompt,
                  setPrompt,
                  locale.speechLocale,
                  () => setIsRecording(true),
                  () => setIsRecording(false),
                )
              }
              type="button"
              aria-label="Use voice input"
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
    </div>
  );
}

