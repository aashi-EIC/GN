import { Mic, Send } from "lucide-react";
import { getCountryLocale } from "../../constants/locales";
import type { CountryCode, ModelId } from "../../types/semantic";
import { handleEnter } from "../../utils/keyboard";
import { getModel } from "../../utils/semantic";
import { startVoiceInput } from "../../utils/speech";
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
  setCountryCode,
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
  setCountryCode: (countryCode: CountryCode) => void;
}) {
  const model = getModel(modelId);
  const locale = getCountryLocale(countryCode);

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => handleEnter(event, () => submitPrompt())}
          placeholder={locale.placeholder}
          aria-label={`Ask ${model.name}`}
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
              className="mic-btn"
              onClick={() => startVoiceInput(prompt, setPrompt, locale.speechLocale)}
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
