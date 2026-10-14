import { useMemo, useState } from "react";
import { ArrowUp, Mic } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { ModelId, SemanticModel } from "../types/semantic";
import { startVoiceInput } from "../utils/speech";
import { ModelPicker } from "./ModelPicker";
import { ChatPromptInput } from "./ChatPromptInput";
import { TeamFooter } from "../../../shared/components/TeamFooter";

import { firstName } from "../../../shared/utils/identity";
import type { UserProfile } from "../../../shared/types/app";

const WELCOME_MESSAGES = [
  "Hola {Name}! Ready to talk metrics in plain English?",
  "Bring a smart question, {Name}, let the data flex!",
  "Ending spreadsheet civil wars, {Name} - welcome back!",
  "Ask away, {Name} - facts before your coffee cools!",
  "Numbers don't lie, {Name} - they're just waiting on you!",
  "Your dashboards can now talk, {Name} - what's first?",
  "Direct line to your data, {Name} - what’s on your mind?",
  "Welcome, {Name}! What insights are we uncovering today?",
  "Spotting outliers, {Name}? Hit me with the tough stuff!",
  "Hi {Name} - no question is niche when data is on the line",
  "Welcome, truth-seeker {Name}! What are we analyzing?",
  "Fair warning, {Name} - I take data seriously. Let's dig in!",
  "Coffee poured, metrics calibrated. What's next, {Name}?",
  "The data's ready, {Name} - are you?",
  "Magnifying glass out, {Name} - which metrics today?",
  "Hi {Name}, let's uncover those hidden insights!",
];

export function WelcomePanel({
  user,
  model,
  modelId,
  setModelId,
  modelsOpen,
  setModelsOpen,
  prompt,
  setPrompt,
  submitPrompt,
  showMagicHint,
  dismissMagicHint,
}: {
  user?: UserProfile | null;
  model: SemanticModel;
  modelId: ModelId;
  setModelId: (modelId: ModelId) => void;
  modelsOpen: boolean;
  setModelsOpen: (open: boolean) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  submitPrompt: (prompt?: string) => void;
  showMagicHint: boolean;
  dismissMagicHint: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const reduceMotion = useReducedMotion();

  const selectedTemplate = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * WELCOME_MESSAGES.length);
    return WELCOME_MESSAGES[randomIndex];
  }, []);

  const messageParts = useMemo(() => {
    return selectedTemplate.split("{Name}");
  }, [selectedTemplate]);

  const userName = user?.name ? firstName(user.name) : "User";

  return (
    <>
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
        <div className="welcome-composer" onPointerDown={dismissMagicHint}>
          <ChatPromptInput
            prompt={prompt}
            setPrompt={setPrompt}
            submitPrompt={submitPrompt}
            label={"Ask " + model.name}
            showMagicHint={showMagicHint}
            dismissMagicHint={dismissMagicHint}
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
                    "en-US",
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
                aria-label="Send prompt"
              >
                <ArrowUp />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <TeamFooter />
    </>
  );
}
