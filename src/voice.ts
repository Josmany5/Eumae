/* The mic — voice typing, from the mockup.
 *
 *  The mockup's composer ships the mic as a stub: `onclick="toast('Voice
 *  mode')"` (line 391). What makes it real is `inject()` (1831-1833), which
 *  finds that one stub by its own toast text, hangs an id on it and swaps the
 *  handler for `micTap` (1786). "From wove" here therefore means the injection,
 *  not the markup above it — and our button keeps the markup's own
 *  `aria-label="Mic"` rather than the toast the stub used to say.
 *
 *  The machinery is the mockup's, four functions and three variables:
 *
 *    micTap (1786)    toggle. No recogniser in this browser? Say so, don't sit
 *                     there looking armed.
 *    startRec (1763)  continuous recognition; finals accumulate, the interim
 *                     text shows in the field as you speak, and half a second
 *                     of quiet sends it.
 *    voiceSend (1755) the send itself, deferred while a reply is streaming.
 *    voiceOff (1781)  off, and stop listening.
 *
 *  Two of its details are what make it survivable rather than merely working,
 *  and both are kept. `onend` fires whenever the browser stops the stream on
 *  its own, so a blind restart is how it works — and a blind restart that keeps
 *  failing is an infinite loop, so more than four restarts inside five seconds
 *  turns the mic off and says so (1777). And a denied microphone is not a retry:
 *  `onerror` puts the button back off (1778).
 *
 *  What this module cannot know is anything about the app: whether a reply is in
 *  flight, what is in the field, what to do with the text. Those arrive as
 *  `VoiceTyping`, handed over at the tap — so this file reads no React state,
 *  and the composer reads no speech API.
 */

/** What the mic needs from the app it is typing into. */
export interface VoiceTyping {
  /** What is in the field now — the mockup reads `#cin.value` (1758, 1772). */
  read: () => string;
  /** Show the running transcript while you speak (1772). */
  write: (text: string) => void;
  /** Send. `byVoice` is the mockup's `VOICESEND` flag (1761), which is what
   *  makes it read the answer aloud afterwards (1902). Returns false if there
   *  was nothing to send — the mockup's own `if(!v)return` (1760). */
  send: (byVoice: boolean) => boolean;
  /** True while a reply is streaming: the mockup waits for it rather than
   *  sending into it (1757). */
  busy: () => boolean;
  /** Light the button, or put it back (1753). */
  lit: (on: boolean) => void;
  /** The mockup's `toast()`, which is this app's `notify`. Two sentences below
   *  depend on it, and a silent mic is exactly the failure this file is trying
   *  to avoid. */
  say: (message: string) => void;
}

/* The mockup's own numbers: half a second of quiet sends (1774), and a busy
   reply is retried after 800ms (1757). Then the runaway guard's — a five second
   window (1777), and more than four restarts inside it. */
const SILENCE_MS = 500;
const BUSY_RETRY_MS = 800;
const RUNAWAY_WINDOW_MS = 5000;
const RUNAWAY_MAX = 4;

/* The speech API is spelled `webkitSpeechRecognition` in the browsers that have
   it (Safari and Chrome both), and TypeScript's DOM lib still does not carry it
   — it is a draft, not a standard. So the three members this file uses are
   declared here instead of being reached for through `any`, which would have
   thrown the checking away for every line that touched them. */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex?: number;
  results: { length: number; [index: number]: RecognitionResult };
}

interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string } | null) => void) | null;
}

type RecognizerCtor = new () => Recognizer;

/** Both spellings, in the order the mockup tries them (1765). */
function recognizerCtor(): RecognizerCtor | undefined {
  const host = window as unknown as {
    SpeechRecognition?: RecognizerCtor;
    webkitSpeechRecognition?: RecognizerCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}


/* One microphone, one listener — the mockup's `VON` and `REC` at module scope
   (1754), for the same reason the log is module scope: the answer is a property
   of the app, not of whichever component happens to be mounted. */
let listener: VoiceTyping | null = null;
let recognizer: Recognizer | null = null;
/** The mockup's `ACC`: what has been heard as settled text since the mic came
 *  on — and, because the mockup clears it as it sends, since the last send. */
let transcript = '';
/** The mockup's `SIL`, one timer doing two jobs: send after quiet, and try again
 *  after a busy reply. */
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** The send, from `voiceSend` (1755): nothing while a reply is streaming, and
 *  nothing at all if the field is empty. Either way the mic keeps listening —
 *  the mockup never stops it here, which is what lets you speak the next thing
 *  without reaching for the button again. */
function voiceSend(voice: VoiceTyping): void {
  if (listener !== voice) return;
  if (voice.busy()) {
    timer = setTimeout(() => voiceSend(voice), BUSY_RETRY_MS);
    return;
  }
  if (!voice.read().trim()) return;
  /* Emptied at send time, exactly as the mockup does (1759) — otherwise the
     next sentence arrives appended to the one just sent. */
  transcript = '';
  voice.send(true);
}

/** `startRec` (1763). */
function startRec(voice: VoiceTyping): void {
  const Ctor = recognizerCtor();
  if (!Ctor || listener !== voice) return;

  const rec = new Ctor();
  recognizer = rec;
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (event) => {
    let settled = '';
    let pending = '';
    for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) settled += result[0].transcript;
      else pending += result[0].transcript;
    }
    if (settled) transcript += settled;
    voice.write(transcript + pending);
    clearTimer();
    timer = setTimeout(() => voiceSend(voice), SILENCE_MS);
  };

  /* The restart count lives on the recogniser, as it does in the mockup (1776):
     a restart reuses this same object, so the window survives it, and a fresh
     tap starts a fresh count. */
  const restarts: number[] = [];
  rec.onend = () => {
    if (listener !== voice) return;
    const now = Date.now();
    const recent = restarts.filter((at) => now - at < RUNAWAY_WINDOW_MS);
    recent.push(now);
    restarts.length = 0;
    restarts.push(...recent);
    if (recent.length > RUNAWAY_MAX) {
      stopListening();
      voice.say('Voice stopped. Tap the mic to start again.');
      return;
    }
    try {
      rec.start();
    } catch {
      /* Already restarting — the end event will come round again. */
    }
  };

  rec.onerror = (event) => {
    const reason = event?.error;
    if (reason === 'not-allowed' || reason === 'service-not-allowed') stopListening();
  };

  try {
    rec.start();
  } catch {
    /* The browser refused to open the stream. Nothing to say here: if it was
       the microphone being refused, `onerror` is what reports it. */
  }
}

/** Off — `voiceOff` (1781). */
export function stopListening(): void {
  const voice = listener;
  listener = null;
  clearTimer();
  if (recognizer) {
    try {
      recognizer.abort();
    } catch {
      /* Already finished. */
    }
    recognizer = null;
  }
  transcript = '';
  if (voice) voice.lit(false);
}

/** The tap — `micTap` (1786): on if it is off, off if it is on. */
export function toggleMic(voice: VoiceTyping): void {
  if (listener) {
    stopListening();
    return;
  }
  if (!recognizerCtor()) {
    voice.say('Voice typing is not available in this browser.');
    return;
  }
  transcript = '';
  listener = voice;
  voice.lit(true);
  startRec(voice);
}
