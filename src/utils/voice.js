/**
 * Voice input utility using the Web Speech API
 * Falls back gracefully on unsupported browsers.
 */

export const isVoiceSupported = () =>
  typeof window !== 'undefined' &&
  Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Creates a SpeechRecognition instance configured for batch ID capture
 * @param {{ lang: string, onResult: (text: string) => void, onError: (err: string) => void, onEnd: () => void }} opts
 * @returns {{ start: () => void, stop: () => void } | null}
 */
export function createVoiceRecognizer({ lang = 'en-US', onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const recognition = new SR();
  recognition.lang              = lang;
  recognition.interimResults    = false;
  recognition.maxAlternatives   = 1;
  recognition.continuous        = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim().toUpperCase();
    // Replace spoken separators with dashes for batch IDs like "BATCH 2024 PC 001"
    const normalised = transcript.replace(/\s+/g, '-');
    onResult(normalised);
  };

  recognition.onerror = (event) => {
    const messages = {
      'no-speech':      'No speech detected. Please try again.',
      'audio-capture':  'Microphone not available.',
      'not-allowed':    'Microphone permission denied.',
      'network':        'Network error during recognition.',
    };
    onError(messages[event.error] || `Voice error: ${event.error}`);
  };

  recognition.onend = () => { onEnd?.(); };

  return {
    start: () => recognition.start(),
    stop:  () => recognition.stop(),
  };
}
