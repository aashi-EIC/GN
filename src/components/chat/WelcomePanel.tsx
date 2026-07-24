import { ArrowUp, Mic } from "lucide-react";
import { getCountryLocale } from "../../constants/locales";
import type { UserProfile } from "../../types/app";
import type { CountryCode, ModelId, SemanticModel } from "../../types/semantic";
import { firstName } from "../../utils/identity";
import { handleEnter } from "../../utils/keyboard";
import { startVoiceInput } from "../../utils/speech";
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
  const locale = getCountryLocale(countryCode);
  const localizedPrompts = locale.prompts[modelId] ?? model.prompts;

  return (
    <div className="welcome-inner">
      <h1>{locale.welcomeGreeting(firstName(user.name))}</h1>

      <div className="welcome-composer">
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
              disabled={!prompt.trim()}
              type="button"
              aria-label={locale.sendLabel}
            >
              <ArrowUp />
            </button>
          </div>
        </div>
      </div>

      <div className="suggestions">
        {localizedPrompts.map((suggestion) => (
          <button key={suggestion} onClick={() => submitPrompt(suggestion)}>
            <span>{suggestion}</span>
            <ArrowUp />
          </button>
        ))}
      </div>
    </div>
  );
}
