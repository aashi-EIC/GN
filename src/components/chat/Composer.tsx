import { Mic, Send } from "lucide-react";
import type { CountryCode, ModelId } from "../../types/semantic";
import { handleEnter } from "../../utils/keyboard";
import { getModel } from "../../utils/semantic";
import { startVoiceInput } from "../../utils/speech";
import { CountryPicker } from "./CountryPicker";
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

  return (
    <div className="composer-wrap">
      <div className="composer-model-control">
        <ModelPicker
          modelId={modelId}
          setModelId={setModelId}
          open={modelsOpen}
          setOpen={setModelsOpen}
          compact
          disabled={modelLocked}
        />
      </div>
      <div className="composer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => handleEnter(event, () => submitPrompt())}
          placeholder="Ask me about TV shows and movies"
          aria-label={`Ask ${model.name}`}
        />
        <div className="composer-bottom">
          <CountryPicker countryCode={countryCode} setCountryCode={setCountryCode} />
          <div className="composer-actions">
            <button
              className="mic-btn"
              onClick={() => startVoiceInput(prompt, setPrompt)}
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
              aria-label="Send"
            >
              <Send />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
