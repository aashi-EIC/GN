import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight, Mic, Plus } from "lucide-react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { getCountryLocale } from "../../../shared/constants/locales";
import type { UserProfile } from "../../../shared/types/app";
import type { CountryCode, ModelId, SemanticModel } from "../types/semantic";
import { firstName } from "../../../shared/utils/identity";
import { handleEnter } from "../../../shared/utils/keyboard";
import { startVoiceInput } from "../utils/speech";
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
  const [isRecording, setIsRecording] = useState(false);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const promptTrackRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const reduceMotion = useReducedMotion();
  const locale = getCountryLocale(countryCode);
  const localizedPrompts = locale.prompts[modelId] ?? model.prompts;
  const promptTopics =
    modelId === "schedule_completeness_tsg"
      ? ["Tomorrow", "Coverage", "Gaps", "Markets", "Channels", "Priority"]
      : ["Latency", "Sources", "Match rate", "Alerts", "Trends", "Providers"];

  const updateCarouselState = () => {
    const track = promptTrackRef.current;
    if (!track) return;

    const firstCard = track.querySelector<HTMLElement>("button");
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = (firstCard?.offsetWidth ?? track.clientWidth) + gap;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);

    setActivePromptIndex(Math.min(localizedPrompts.length - 1, Math.round(track.scrollLeft / step)));
    setCanScrollLeft(track.scrollLeft > 2);
    setCanScrollRight(track.scrollLeft < maxScroll - 2);
  };

  const moveCarousel = (direction: -1 | 1) => {
    const track = promptTrackRef.current;
    const firstCard = track?.querySelector<HTMLElement>("button");
    if (!track || !firstCard) return;

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = firstCard.offsetWidth + gap;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const target = Math.max(0, Math.min(track.scrollLeft + direction * step, maxScroll));

    scrollAnimationRef.current?.stop();
    if (reduceMotion) {
      track.scrollLeft = target;
      updateCarouselState();
      return;
    }

    scrollAnimationRef.current = animate(track.scrollLeft, target, {
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => {
        track.scrollLeft = value;
      },
      onComplete: updateCarouselState,
    });
  };

  useEffect(() => {
    const track = promptTrackRef.current;
    if (!track) return undefined;

    track.scrollLeft = 0;
    updateCarouselState();
    const resizeObserver = new ResizeObserver(updateCarouselState);
    resizeObserver.observe(track);

    return () => {
      scrollAnimationRef.current?.stop();
      resizeObserver.disconnect();
    };
  }, [modelId, localizedPrompts.length]);

  return (
    <motion.div
      className={`welcome-inner ${modelsOpen ? "model-menu-open" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1>
        <span className="welcome-greeting-accent">
          Hello, {firstName(user.name)}!
        </span>{" "}
        <span className="welcome-greeting-question">
          How can I help you today?
        </span>
      </h1>
      <div className="welcome-composer">
        <textarea
          rows={1}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => handleEnter(event, () => submitPrompt())}
          aria-label={`Ask ${model.name}`}
          placeholder={locale.placeholder ?? `Ask ${model.name}`}
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

      <section className="suggestion-section" aria-labelledby="suggested-prompts-title">
        <div className="suggestion-section-head">
          <h2 id="suggested-prompts-title">Suggested prompts</h2>
          <span>
            {String(activePromptIndex + 1).padStart(2, "0")} /{" "}
            {String(localizedPrompts.length).padStart(2, "0")}
          </span>
        </div>
        <div className="prompt-gallery-shell">
          <button
            className="prompt-gallery-control previous"
            type="button"
            aria-label="Show previous prompts"
            disabled={!canScrollLeft}
            onClick={() => moveCarousel(-1)}
          >
            <ChevronLeft />
          </button>
          <div
            className="suggestions"
            ref={promptTrackRef}
            onScroll={updateCarouselState}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveCarousel(-1);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                moveCarousel(1);
              }
            }}
            role="region"
            aria-label="Suggested prompt gallery"
            tabIndex={0}
          >
          {localizedPrompts.map((suggestion, index) => (
            <motion.button
              key={suggestion}
              type="button"
              onClick={() => submitPrompt(suggestion)}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: reduceMotion ? 0 : 0.08 + index * 0.055,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            >
              <span className="prompt-card-meta">
                <span>{promptTopics[index] ?? model.short}</span>
                <Plus aria-hidden="true" />
              </span>
              <span className="prompt-card-text">{suggestion}</span>
            </motion.button>
          ))}
          </div>
          <button
            className="prompt-gallery-control next"
            type="button"
            aria-label="Show more prompts"
            disabled={!canScrollRight}
            onClick={() => moveCarousel(1)}
          >
            <ChevronRight />
          </button>
        </div>
      </section>
    </motion.div>
  );
}

