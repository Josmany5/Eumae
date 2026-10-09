import { accessToken } from './auth';
import { storedSpeed, storedVoice, voiceName } from './voices';

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
 *
 *  The other half is the speaker, and it is the same story from the mockup's
 *  other end: `wxSpeak` (1689) is what the "Read aloud" button calls, `chunks`
 *  (1670) and `speakNext` (1677) are how a reply becomes sound, `unlock` (1668)
 *  is how iOS is persuaded to allow it, and the two halves meet at one variable
 *  — while sound is coming out, the mic does not type and does not send (1756,
 *  1768). It is the microphone that yields, because a person hearing an answer
 *  is not, at that moment, talking to it.
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
const SILENCE_MS = 800;
const BUSY_RETRY_MS = 800;
const RUNAWAY_WINDOW_MS = 5000;
const RUNAWAY_MAX = 4;
/** The longest piece the speaker asks for in one request. The mockup's own was
 *  420 (1673); this app asks for 4500 — just under Google's per-request text cap
 *  of ~5000 bytes, so one ordinary reply is one request instead of several. */
const CHUNK_MAX = 4500;

/** How long after `onend` before the recogniser is started again. iOS refuses a
 *  restart issued inside the end event itself, and accepts the same call half a
 *  second later — the revive Wove used. */
const RESTART_DELAY_MS = 500;

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

/* ── The speaker ─────────────────────────────────────────────────────────────
   Read aloud, from the mockup. `speakNext` (1677) is the loop that makes it feel
   immediate: the text is cut into sentence-sized pieces (`chunks`, 1670), each is
   asked for as its own short request, and the next one is asked for while the
   last is still playing — so the first words arrive after one small synthesis
   rather than after the whole reply has been synthesized.

   The audio element is one element, reused (1669), and it is also how iOS
   decides: Safari will not start a sound that no gesture began, and the answer
   from the server arrives long after the tap did. The mockup's answer is
   `unlock` (1668) — silence played while a gesture is still happening, which
   opens the element for everything after it. Neither half of this file touches
   `document` or `window` at import time: a server render imports this module
   (§5), so the element, the unlock listener and the silence are all made on
   first use. */

/* The mockup's `AUD`, `UNL`, `SPKQ`, `SPKON` and `SPEAKING`. `sounding` is the
   one the mic watches; `running` is the one the button toggles off. */
let audio: HTMLAudioElement | null = null;
let unlocked = false;
let running = false;
let sounding = false;
/** Bumped on every stop, so an in-flight run can see it was cancelled and bail. */
let runId = 0;
/** Resolves the clip currently playing, so a stop can interrupt it mid-play. */
let currentClip: (() => void) | null = null;
/** What the speaker is reading now, so "Read aloud" can tell a toggle-off (same
 *  text) from a switch (a different message). */
let readingText: string | null = null;
/** One refusal is said out loud per run, not one per piece (see `refused`). */
let noticed = false;
let silent: string | null = null;
/* Which voice this run speaks in, as the name Google answers to (src/voices.ts).
   Held per run rather than read per piece, so changing the setting halfway
   through a reply changes the next thing said, not the sentence being said. */
let speakVoice: string | null = null;
/* And how fast, in the same shape and for the same reason: `speakVoice`'s
   paragraph applies to the rate word for word — settled once when the run starts
   (src/voices.ts `storedSpeed`), so moving the setting lands on the next thing
   read and never on the sentence already coming out of the speaker, which would
   sound like a fault rather than a setting. */
let speakRate = 1;

/** Is sound coming out? The mic's own guard (1756, 1768). */
export function speaking(): boolean {
  return sounding;
}

function element(): HTMLAudioElement {
  if (!audio) audio = new Audio();
  return audio;
}

/** A silent WAV, built rather than inlined: the mockup's `unlock` carries about
 *  1.4kB of base64 MP3 to do this, and the same job takes a RIFF header and
 *  zeroed samples — 24 lines that can be checked instead of a blob that cannot. */
function silence(): string {
  if (silent) return silent;
  const rate = 8000;
  const samples = 480; // 0.06s. Long enough to be playback; nothing to hear.
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const put = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  put(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  view.setUint32(16, 16, true); // header size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true); // byte rate: 8-bit mono
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  put(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit PCM silence is 128, not 0
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  silent = `data:audio/wav;base64,${btoa(binary)}`;
  return silent;
}

/** `unlock` (1668): a silent sound played in a gesture, which is what opens the
 *  element for iOS Safari — everything after it can play without a gesture. */
function unlock(): void {
  if (unlocked) return;
  /* Never over a piece that is playing. The silence goes through the same element
     the reply is coming out of (140), so setting `src` on it stops what was
     playing — and a piece stopped that way never fires `ended`, which is the only
     thing that asks for the next one. The run would then sit there "speaking" for
     ever, and `sounding` is what the mic checks before it types or sends: one tap
     on the mic while a reply is being read would leave the microphone dead. A
     later Read-aloud tap is its own gesture, and opens the element then. */
  if (running || sounding) return;
  try {
    const el = element();
    el.src = silence();
    const started = el.play();
    if (started && typeof started.then === 'function') {
      started.then(
        () => {
          unlocked = true;
        },
        () => {
          /* Refused. The next gesture tries again — which is the mockup's
             `UNL` flag doing its work, and why this is a listener rather than
             a one-shot. */
        },
      );
    }
  } catch {
    /* No audio in this browser at all. Nothing to do here: playback below
       fails the same way and says so. */
  }
}

/** Cut text into sentence-sized pieces — the mockup's `chunks` (1670): code
 *  fences are dropped, because there is nothing in them to hear, the rest splits
 *  on sentence ends and line breaks, and the pieces are glued back together so
 *  none is longer than `CHUNK_MAX` (4500, not the mockup's 420 at 1673, so one
 *  reply is one request instead of several). */
export function chunks(text: string): string[] {
  const parts = text.replace(/```[\s\S]*?```/g, ' ').match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
  const out: string[] = [];
  let current = '';
  for (const part of parts) {
    if ((current + part).length > CHUNK_MAX) {
      if (current) out.push(current);
      current = part;
    } else current += part;
  }
  if (current.trim()) out.push(current);
  return out.length ? out : [''];
}

/** Why the sound is not the server's voice: said once per run, in the server's
 *  own terms where it gave any, because the alternative — the mockup's silent
 *  fallback (1685) — is a voice that "just sounds different" for reasons nobody
 *  can see. The reading continues either way, in the browser's voice. */
function refused(status: number, message: string | undefined, say?: (m: string) => void): void {
  if (noticed) return;
  noticed = true;
  if (!say) return;
  if (status === 401) say('Signed out — reading with the browser voice');
  else if (status === 501) say(message || 'Read aloud is not set up on this server');
  else say('The server could not read this — using the browser voice');
}

/** The browser's own voice, the fallback when the server sends no audio (1685).
 *  Resolves on end or error, so the run can carry on rather than stall. */
function playBrowserPiece(text: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

/** What the speak action answers with (api/ai.ts): base64 audio, or a sentence
 *  saying why it could not. */
interface Spoken {
  audio?: string;
  mimeType?: string;
  error?: string;
}

/** One piece after the server has been asked for its audio — a ready data URI,
 *  or a refusal to fall back from. */
interface Clip {
  text: string;
  src: string | null;
  status: number;
  error?: string;
}

/** Ask for one piece's audio. Returns a playable data URI, or `src: null` when
 *  the server or the network could not produce audio, with the status `refused`
 *  can turn into a sentence. */
async function fetchClip(piece: string, token: string | null): Promise<Clip> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: 'speak',
        data: {
          text: piece,
          voice: speakVoice ?? voiceName(storedVoice()),
          rate: String(speakRate),
        },
      }),
    });
    let body: Spoken = {};
    try {
      body = (await response.json()) as Spoken;
    } catch {
      /* Not JSON. The status is what matters. */
    }
    if (!response.ok || !body.audio) {
      return { text: piece, src: null, status: response.status, error: body.error };
    }
    return {
      text: piece,
      src: `data:${body.mimeType || 'audio/mpeg'};base64,${body.audio}`,
      status: response.status,
    };
  } catch {
    return { text: piece, src: null, status: 0 };
  }
}

/** Play one clip through the shared element. Resolves when it ends or fails, so
 *  the next clip starts immediately — no network wait between pieces. */
function playClip(src: string): Promise<void> {
  return new Promise((resolve) => {
    const el = element();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (currentClip === finish) currentClip = null;
      el.onended = null;
      el.onerror = null;
      resolve();
    };
    currentClip = finish;
    el.onended = finish;
    el.onerror = finish;
    el.src = src;
    el.play().catch(finish);
  });
}

/** One run: fetch every piece in parallel up front, then play them back to back
 *  with no gaps. `id` is the run's generation — a stop bumps `runId`, so an
 *  in-flight run sees it has been cancelled and bails at the next await. */
async function runSpeak(id: number, pieces: string[], say?: (message: string) => void): Promise<void> {
  let token: string | null = null;
  try {
    token = await accessToken();
  } catch {
    token = null;
  }
  const clips = await Promise.all(pieces.map((piece) => fetchClip(piece, token)));
  if (id !== runId) return;

  for (const clip of clips) {
    if (id !== runId) return;
    if (clip.src) {
      await playClip(clip.src);
    } else {
      refused(clip.status, clip.error, say);
      await playBrowserPiece(clip.text);
    }
  }
  if (id === runId) {
    running = false;
    sounding = false;
    readingText = null;
  }
}

/** Read this aloud — the mockup's `wxSpeak` (1689), which is a toggle: called
 *  while it is already reading, it stops instead of starting again. `say` is
 *  optional because reading is not always started by something that can show a
 *  message; where it is, the one sentence about a refusal goes there. */
export function speak(text: string, say?: (message: string) => void, voice?: string): void {
  if (!text.trim()) return;
  /* Same text already reading → toggle it off. A different text → cut the current
     one and start this, so a tap on message B while A reads starts B instead of
     being swallowed as "stop". */
  if (running && readingText === text) {
    stopSpeaking();
    return;
  }
  if (running) {
    stopSpeaking();
  }
  readingText = text;
  /* A speaker turn owns the session: the mic goes off so the button never sits
     lit-but-deaf, and a tap barges back in (toggleMic). */
  turnOffMic();
  /* The voice for this run, settled before any piece is asked for: the caller's
     choice when it names one (Settings' sample names the row being pressed, which
     is not necessarily the row that is ticked) and the stored setting otherwise. */
  speakVoice = voice ?? voiceName(storedVoice());
  speakRate = storedSpeed();
  unlock();
  noticed = false;
  running = true;
  sounding = true;
  clearTimer();
  transcript = '';
  const id = ++runId;
  void runSpeak(id, chunks(text), say);
}

/** Stop — the mockup's own stop (1690): the queue is dropped, the element is
 *  paused and the browser's voice is cancelled, so pressing again cannot leave
 *  either of them still talking. */
export function stopSpeaking(): void {
  running = false;
  sounding = false;
  noticed = false;
  readingText = null;
  /* Cancel the run in flight: bump the generation and resolve the clip that is
     playing, so the loop bails instead of hanging on a paused clip. */
  runId++;
  if (currentClip) {
    const finish = currentClip;
    currentClip = null;
    finish();
  }
  if (audio) {
    try {
      audio.pause();
    } catch {
      /* Nothing was playing. */
    }
  }
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* No synthesizer in this browser. */
  }
}

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
  /* The mic yields to the speaker (1756): while an answer is being read out
     nothing is sent, and the words stay in the field for a deliberate press. */
  if (sounding) return;
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

  /* The restart count lives on the recogniser, as it does in the mockup (1776):
     a restart reuses this same object, so the window survives it, and a fresh
     tap starts a fresh count. It is cleared again whenever a result arrives:
     recognition that is producing words is not runaway, so the guard only ever
     fires on a stream that ends over and over with nothing to show. */
  const restarts: number[] = [];

  rec.onresult = (event) => {
    /* Nor is anything typed while it is speaking (1768). */
    if (sounding) return;
    /* Words arrived — whatever loop `onend` is in, it is producing results, so
       the runaway window starts over. This is what lets one utterance be read,
       then the next, without the guard tripping on a browser that ends the
       stream after every phrase. */
    restarts.length = 0;
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

  rec.onend = () => {
    if (listener !== voice) return;
    /* A browser that ends the stream on its own (iOS does, after each phrase)
       may never give the silence timer its 500ms — send anything still waiting,
       so a phrase is never lost. */
    if (transcript.trim()) {
      clearTimer();
      voiceSend(voice);
    }
    /* Bounded by the runaway guard, restart — but after a beat, not in the end
       event itself: iOS refuses a restart issued synchronously and accepts the
       same call half a second later (Wove's revive). */
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
    setTimeout(() => {
      if (listener !== voice) return;
      try {
        rec.start();
      } catch {
        /* The browser will not start this recogniser again. Put the button back
           rather than leaving it lit and silent; the next tap is a fresh start. */
        stopListening();
      }
    }, RESTART_DELAY_MS);
  };

  rec.onerror = (event) => {
    const reason = event?.error;
    if (reason) console.warn('Speech recognition error:', reason);
    if (reason === 'not-allowed' || reason === 'service-not-allowed') {
      stopListening();
      voice.say('Microphone access was denied.');
    } else if (reason === 'audio-capture' || reason === 'network' || reason === 'language-not-supported') {
      stopListening();
      voice.say(`Microphone failed: ${reason}`);
    }
    /* `no-speech` and `aborted` are not fatal: the browser stopped on its own,
       and `onend` follows and restarts. */
  };

  try {
    rec.start();
  } catch {
    /* The browser refused to open the stream synchronously — not an `onerror`
       report but a refusal right here. Leave nothing lit and silent. */
    stopListening();
    voice.say('Could not open the microphone.');
  }
}

/** Turn the mic off: abort the recogniser, drop the held transcript, unlight.
 *  Does not touch the speaker — `stopListening`'s extra job. A speaker turn does
 *  this as it begins, so the button never sits lit-but-deaf while the AI reads. */
function turnOffMic(): void {
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

/** Off — `voiceOff` (1781): the whole voice session ends, mic and speaker. The
 *  field is left alone — a deliberate stop keeps the words for editing; the
 *  auto-restart flushes on its own. */
export function stopListening(): void {
  turnOffMic();
  stopSpeaking();
}

/** On iOS, backgrounding Safari mid-read can leave `sounding` stuck true with a
 *  dead audio element, which makes the mic deaf until toggled by hand. On return
 *  to the tab, reset the voice session so nothing is left stuck. Registered once,
 *  lazily, so the module still imports cleanly in a server render. */
let visibilityArmed = false;
export function armVisibility(): void {
  if (visibilityArmed) return;
  visibilityArmed = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (sounding || listener) stopListening();
  });
}

/** Start the mic fresh: the browser check, then light the button and begin. */
function startMic(voice: VoiceTyping): void {
  if (!recognizerCtor()) {
    voice.say('Voice typing is not available in this browser.');
    return;
  }
  transcript = '';
  listener = voice;
  voice.lit(true);
  startRec(voice);
}

/** The tap — `micTap` (1786): on if it is off, off if it is on. While the AI is
 *  reading, the mic is lit but deaf; a tap then means "shut up, I'm talking" —
 *  stop the reading and start listening in one tap, not two. */
export function toggleMic(voice: VoiceTyping): void {
  if (sounding) {
    stopSpeaking();
    if (recognizer) {
      try {
        recognizer.abort();
      } catch {
        /* Already ended. */
      }
      recognizer = null;
    }
    clearTimer();
    startMic(voice);
    return;
  }
  if (listener) {
    stopListening();
    return;
  }
  startMic(voice);
}
