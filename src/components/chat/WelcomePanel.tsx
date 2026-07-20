import { ArrowUp, Mic } from "lucide-react";
import type { UserProfile } from "../../types/app";
import type { CountryCode, ModelId, SemanticModel } from "../../types/semantic";
import { firstName } from "../../utils/identity";
import { handleEnter } from "../../utils/keyboard";
import { startVoiceInput } from "../../utils/speech";
import { CountryPicker } from "./CountryPicker";
import { ModelPicker } from "./ModelPicker";

export function WelcomePanel({
  user,
  model,
  modelId,
  setModelId,
  modelsOpen,
  setModelsOpen,
  countryCode,
  setCountryCode,
  prompt,
  setPrompt,
  submitPrompt,
}: {
  user: UserProfile;
  model: SemanticModel;
  modelId: ModelId;
  setModelId: (modelId: ModelId) => void;
  modelsOpen: boolean;
  setModelsOpen: (open: boolean) => void;
  countryCode: CountryCode;
  setCountryCode: (countryCode: CountryCode) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  submitPrompt: (prompt?: string) => void;
}) {
  return (
    <div className="welcome-inner">
      <div className="welcome-model-control">
        <ModelPicker
          modelId={modelId}
          setModelId={setModelId}
          open={modelsOpen}
          setOpen={setModelsOpen}
          compact
        />
      </div>

      <h1>
        Hello, <span>{firstName(user.name)}</span>! How can I help you today?
      </h1>

      <div className="welcome-composer">
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
              disabled={!prompt.trim()}
              type="button"
              aria-label="Send"
            >
              <ArrowUp />
            </button>
          </div>
        </div>
      </div>

      <div className="suggestions">
        {model.prompts.map((suggestion) => (
          <button key={suggestion} onClick={() => submitPrompt(suggestion)}>
            <span>{suggestion}</span>
            <ArrowUp />
          </button>
        ))}
      </div>
    </div>
  );
}
