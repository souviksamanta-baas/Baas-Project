type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  results: {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

export type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

export function getWebSpeechRecognition(): WebSpeechRecognition | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const ctor =
    (window as Window & { SpeechRecognition?: new () => WebSpeechRecognition }).SpeechRecognition ??
    (window as Window & { webkitSpeechRecognition?: new () => WebSpeechRecognition }).webkitSpeechRecognition;

  return ctor ? new ctor() : null;
}

export function isWebSpeechRecognitionSupported(): boolean {
  return getWebSpeechRecognition() !== null;
}
