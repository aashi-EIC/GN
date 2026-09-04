type SpeechRecognitionResultEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function startVoiceInput(
  currentPrompt: string,
  setPrompt: (prompt: string) => void,
  speechLocale = "en-US",
  onStart?: () => void,
  onEnd?: () => void,
) {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    window.alert("Voice input is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = speechLocale;
  recognition.maxAlternatives = 1;

  let hasEnded = false;
  const handleEnd = () => {
    if (!hasEnded) {
      hasEnded = true;
      onEnd?.();
    }
  };

  recognition.onstart = () => {
    onStart?.();
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (transcript) {
      setPrompt([currentPrompt.trim(), transcript].filter(Boolean).join(" "));
    }
  };

  recognition.onerror = () => {
    window.alert("Voice input could not start. Check your browser microphone permission.");
    handleEnd();
  };

  recognition.onend = () => {
    handleEnd();
  };

  recognition.start();
}
