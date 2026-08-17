import { useMemo, useState } from "react";
import { ArrowUp, Mic } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { getCountryLocale } from "../../../shared/constants/locales";
import type { CountryCode, ModelId, SemanticModel } from "../types/semantic";
import { handleEnter } from "../../../shared/utils/keyboard";
import { startVoiceInput } from "../utils/speech";
import { ModelPicker } from "./ModelPicker";

import { firstName } from "../../../shared/utils/identity";
import type { UserProfile } from "../../../shared/types/app";

const WELCOME_MESSAGES = [
  "Hola {Name}! Ready to talk to your metrics in plain english?",
  "Bring a smart question, {Name} , and let the data do the flex!",
  "Ending spreadsheet civil wars one question at a time - welcome back, {Name}!",
  "Ask away, {Name}-get real facts before your coffee gets cold!",
  "Numbers never lie-they were just waiting for someone to ask, {Name}!",
  "Welcome {Name}! Your dashboards can now talk. What do you want to ask today?",
  "Connecting you directly with data, {Name}. What’s on your mind?",
  "Welcome, {Name}! Let’s uncover some great insights today. Your query?",
  "Ready to spot some outliers, {Name}? Ask your toughest questions",
  "Ask away, {Name} - no question is too niche when data is on the line",
  "My favorite seeker of truth is here, {Name}! What trends or metrics are we analyzing today?",
  "Good to see you, {Name}! Fair warning: I take data very seriously. Let's dig in",
  "Coffee? Check. Metrics? Calibrated. Let's see what the data is telling us today, {Name}",
  "The data's ready, {Name}. The real question is-are you? Let's find out",
  "Welcome back, {Name}! Virtual magnifying glasses ready. What metrics are we looking at today?",
  "Hey {Name}, let's uncover the insights hidden in data",
];

export function WelcomePanel({
  user,
  model,
  modelId,
  setModelId,
  modelsOpen,
  setModelsOpen,
  countryCode,
  prompt,
  setPrompt,
  submitPrompt,
}: {
  user?: UserProfile | null;
  model: SemanticModel;
  modelId: ModelId;
  setModelId: (modelId: ModelId) => void;
  modelsOpen: boolean;
  setModelsOpen: (open: boolean) => void;
  countryCode: CountryCode;
  prompt: string;
  setPrompt: (prompt: string) => void;
  submitPrompt: (prompt?: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const reduceMotion = useReducedMotion();
  const locale = getCountryLocale(countryCode);

  const selectedTemplate = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * WELCOME_MESSAGES.length);
    return WELCOME_MESSAGES[randomIndex];
  }, []);

  const messageParts = useMemo(() => {
    return selectedTemplate.split("{Name}");
  }, [selectedTemplate]);

  const userName = user?.name ? firstName(user.name) : "User";

  return (
    <motion.div
      className="welcome-inner"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1>
        {messageParts[0]}
        <span className="welcome-name-gradient">{userName}</span>
        {messageParts[1]}
      </h1>
      <div className="welcome-composer">
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
              disabled={!prompt.trim()}
              type="button"
              aria-label={locale.sendLabel}
            >
              <ArrowUp />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
