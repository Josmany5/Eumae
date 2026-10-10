import { accessToken } from './auth';
import { storedSpeed, storedVoice, voiceName } from './voices';

/* The voice session — one variable, four states. Everything the mic and the
 * speaker do reads and writes this one place, so the two halves can never
 * disagree about what is happening:
 *
 *   off        the mic is down. Nothing listens, nothing speaks.
 *   listening  the mic is up and the floor is yours. Results accumulate, and
 *              800ms of quiet sends.
 *   thinking   your words are with the AI. The mic is still up — you can talk,
 *              but nothing sends until the reply lands.
 *   speaking   the AI's answer is coming out of the speaker. The recogniser is
 *              still running, but every result is dropped: your voice is not
 *              picked up while it talks.
 *
 * The recogniser starts when the mic goes up and is replaced after every
 * reading. While the AI speaks the mic is muted, not killed — but a phone
 * test showed iOS leaves the survivor deaf: its audio input is cut once the
 * speaker has played, without `onend` ever firing. So when the reading ends a
 * fresh recogniser starts after the half-second beat, and the floor is yours
 * again with no tap.
 */

/** What the mic needs from the app it is typing into. */
export interface VoiceTyping {
  /** Show the running transcript while you speak. */
  write: (text: string) => void;
  /** Send. `byVoice` marks a mic send, which is what makes the reply get read
   *  aloud afterwards. Returns false if there was nothing to send. */
  send: (byVoice: boolean) => boolean;
  /** True while a reply is streaming. Kept for the composer's contract; the
   *  session state above is what the mic actually gates on. */
  busy: () => boolean;
  /** Light the button, or put it back. */
  lit: (on: boolean) => void;
  /** The app's `notify`. A silent mic is the failure this file is trying to
   *  avoid, so the two sentences below depend on it. */
  say: (message: string) => void;
}

type Session = 'off' | 'listening' | 'thinking' | 'speaking';

/* 800ms of quiet sends — the time a sentence needs to finish. A busy reply
 * used to be retried on the same beat; the session gate below made that
 * unnecessary: a send is only ever attempted from `listening`. */
const SILENCE_MS = 800;
/** The longest piece the speaker asks for in one request, in UTF-8 bytes —
 *  just under Google's per-request text cap of ~5000 bytes, so one ordinary
 *  reply is one request instead of several. Bytes, not characters: an emoji or
 *  a CJK character counts the three or four bytes it takes. */
const CHUNK_MAX = 4500;
/** How long after an unexpected end before the recogniser is revived. iOS
 *  refuses a restart issued inside the end event itself, and accepts the same
 *  call half a second later. */
const RESTART_DELAY_MS = 500;
/** The revive backs off this far and no further — and it never gives up. A
 *  dropped connection is routine on a phone (a tunnel, a WiFi handoff); the
 *  session stays up through it rather than making the person re-tap. */
const RESTART_MAX_DELAY_MS = 8000;

/* The speech API is spelled `webkitSpeechRecognition` in the browsers that
 * have it (Safari and Chrome both, so iOS and PC are the same code path), and
 * TypeScript's DOM lib still does not carry it — it is a draft, not a
 * standard. The members this file uses are declared here instead of being
 * reached for through `any`. */
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
  /** Graceful end: final results, then `onend`. Unlike `abort()`, this does not
   *  poison iOS's speech service — a phone test showed an aborted recogniser
   *  stays deaf until the page reloads. */
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string } | null) => void) | null;
}

type RecognizerCtor = new () => Recognizer;

/* ── Session state ─────────────────────────────────────────────────────────── */
let session: Session = 'off';
/** The composer's side of the contract, held for the whole mic session. */
let listener: VoiceTyping | null = null;
let recognizer: Recognizer | null = null;
/** What has been heard as settled text since the last send. */
let transcript = '';
/** What is being heard but not yet settled. Shown in the field, never sent on
 *  the silence timer: sending the tail is how a phrase goes out twice — once
 *  as the timer's guess, once when the same words settle a beat later. */
let pending = '';
let timer: ReturnType<typeof setTimeout> | null = null;
/** Clear the send countdown. */
function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
/** The revive's current delay. Reset whenever words arrive — recognition that
 *  is producing results is not failing. */
let reviveDelay = RESTART_DELAY_MS;

/* ── The speaker ─────────────────────────────────────────────────────────────
 * Web Audio, not a media element. A played <audio> element leaves iOS's audio
 * session claimed in playback mode and speech recognition stays deaf
 * afterwards — a documented WebKit bug no element trick (pause, src removal)
 * clears. An AudioContext suspended when the run ends hands the session back,
 * so the mic hears after a reading. The text becomes sentences; each sentence
 * becomes a clip; the clips play in order through a chained promise, so a
 * sentence fetched while the previous one plays starts with no gap. A
 * generation counter (`speakGen`) invalidates a run the moment it is
 * cancelled, so late audio can never play over what replaced it. */

let ctx: AudioContext | null = null;
let unlocked = false;
/** The current TTS run's generation. Bumped on every cancel. */
let speakGen = 0;
let speakActive = false;
/** The text `speak` was asked for, so a second tap on the same message toggles
 *  the reading off instead of starting it again. */
let speakText: string | null = null;
let speakVoice: string | null = null;
let speakRate = 1;
let tokenP: Promise<string | null> = Promise.resolve(null);
/** How much of the streaming reply has been consumed into sentences. */
let speakFed = 0;
/** The incomplete sentence held back for the next feed. */
let speakTail = '';
/** The sequential playback chain. Sentences are fetched the moment they are
 *  complete (in parallel); the chain plays them strictly in order. */
let chain: Promise<void> = Promise.resolve();
/** One refusal is said per run, not one per sentence. */
let saidOnce = false;
let speakSay: ((message: string) => void) | undefined;
/** Resolves the clip currently playing, so a stop can interrupt it mid-play. */
let currentClip: (() => void) | null = null;
/** The buffer source playing now, so a stop can silence it at once. */
let currentSrc: AudioBufferSourceNode | null = null;

function audioCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Inside a tap gesture: create and resume the context, so the read-aloud
 *  that arrives long after the tap is allowed to make sound on iOS. Resuming
 *  is the whole unlock — no silent clip needed. */
function unlock(): void {
  const c = audioCtx();
  if (!c) return;
  const state = c.state as string;
  if (state === 'suspended' || state === 'interrupted') {
    c.resume().then(
      () => {
        unlocked = true;
      },
      () => {
      },
    );
  } else if (!unlocked) {
    unlocked = true;
  }
}

/** Hand the audio session back when a run ends. A suspended context claims
 *  nothing, so speech recognition can take the mic immediately. */
function suspendAudio(): void {
  if (!ctx || ctx.state !== 'running') return;
  ctx.suspend().catch(() => {
    /* Already suspending. */
  });
}

/** Cut text into sentence-sized pieces: code fences are dropped (there is
 *  nothing in them to hear), the rest splits on sentence ends and line breaks,
 *  and pieces are glued back together so none exceeds `CHUNK_MAX` bytes. */
export function chunks(text: string): string[] {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const parts = text.replace(/```[\s\S]*?```/g, ' ').match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
  const out: string[] = [];
  let current = '';
  for (const part of parts) {
    if (bytes(current + part) > CHUNK_MAX) {
      if (current) out.push(current);
      current = part;
    } else current += part;
  }
  if (current.trim()) out.push(current);
  return out.length ? out : [''];
}

/** Split streaming text into complete sentences, holding the incomplete tail
 *  back for the next feed. A sentence is complete when it ends in `.`, `!`,
 *  `?` or a line break. */
function splitStream(text: string): { complete: string[]; tail: string } {
  const clean = text.replace(/```[\s\S]*?```/g, ' ');
  const parts = clean.match(/[^.!?\n]+[.!?\n]*/g) ?? [];
  const complete: string[] = [];
  let tail = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const last = i === parts.length - 1;
    if (!last || /[.!?\n]\s*$/.test(part)) {
      if (part.trim()) complete.push(part);
    } else {
      tail = part;
    }
  }
  return { complete, tail };
}

/** One sentence about a failed read, once per run. */
function sayOnce(message: string): void {
  if (saidOnce) return;
  saidOnce = true;
  if (speakSay) speakSay(message);
}

function refusalText(status: number, error: string | undefined): string {
  if (status === 401) return 'Signed out — read aloud needs a sign-in';
  if (status === 501) return error || 'Read aloud is not set up on this server';
  return error || 'Read aloud failed. Try again.';
}

/** What the speak action answers with (api/ai.ts): base64 audio, or a sentence
 *  saying why it could not. */
interface Spoken {
  audio?: string;
  mimeType?: string;
  error?: string;
}

/** One sentence after the server has been asked for its audio — decoded bytes,
 *  or a refusal. */
interface Clip {
  text: string;
  bytes: Uint8Array | null;
  mimeType?: string;
  status: number;
  error?: string;
}

/** Ask for one sentence's audio. Returns the audio as bytes, or `bytes: null`
 *  when the server or the network could not produce it. */
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
      return { text: piece, bytes: null, status: response.status, error: body.error };
    }
    return {
      text: piece,
      bytes: Uint8Array.from(atob(body.audio), (c) => c.charCodeAt(0)),
      mimeType: body.mimeType || 'audio/mpeg',
      status: response.status,
    };
  } catch {
    return { text: piece, bytes: null, status: 0 };
  }
}

/** Play one decoded clip through the shared AudioContext. Resolves `true` when
 *  it played out, `false` when it could not start at all — so the caller can
 *  say so and stop, rather than walk the rest of the queue in silence. The
 *  buffer arrives already decoded (see enqueuePiece): decoding here, after the
 *  previous clip ended, is the half-second seam the phone could hear. */
function playClip(buffer: AudioBuffer): Promise<boolean> {
  const c = audioCtx();
  if (!c) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    let played = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (currentClip === finish) currentClip = null;
      resolve(played);
    };
    currentClip = finish;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    currentSrc = src;
    src.onended = () => {
      played = true;
      if (currentSrc === src) currentSrc = null;
      finish();
    };
    const start = () => {
      if (done) return;
      try {
        src.start();
      } catch {
        finish();
      }
    };
    const state = c.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      c.resume().then(start, () => finish());
    } else {
      start();
    }
  });
}

/** The session becomes `speaking` when the first sound actually starts — not
 *  when the run is armed. Until then the mic is still live: you can talk while
 *  the answer is on its way, and the send waits its turn. */
function setSessionSpeaking(): void {
  if (session === 'speaking') return;
  session = 'speaking';
  clearTimer();
  if (listener) listener.lit(false);
}

/** The run is over: back to listening if the mic is up, off if it is not. The
 *  context is suspended so the audio session is handed straight back — the
 *  mic hears immediately after a reading. The recogniser is replaced here —
 *  the one that lived through the reading cannot be trusted to hear
 *  afterwards. Words spoken while the answer was on its way get their 800ms. */
function settleSessionAfterSpeak(): void {
  speakActive = false;
  speakText = null;
  suspendAudio();
  if (listener) {
    session = 'listening';
    listener.lit(true);
    restartRecognizer();
  } else {
    session = 'off';
  }
}

/** Begin a TTS run. The voice and rate are settled once, up front, so changing
 *  the setting mid-reply changes the next thing said, never the sentence
 *  already coming out of the speaker. */
function beginRun(say?: (m: string) => void, voice?: string): number {
  const id = ++speakGen;
  speakActive = true;
  speakSay = say;
  speakVoice = voice ?? voiceName(storedVoice());
  speakRate = storedSpeed();
  tokenP = accessToken().catch(() => null);
  speakFed = 0;
  speakTail = '';
  saidOnce = false;
  chain = Promise.resolve();
  return id;
}

/** Queue one piece for speaking. The fetch starts now, and the decode starts
 *  the moment the bytes arrive — both in parallel, while the previous piece is
 *  still playing. The chain plays the decoded buffers strictly in order, so by
 *  the time a piece is due its buffer is ready and there is no seam. */
function enqueuePiece(piece: string, id: number): void {
  const clipP = tokenP.then((t) => fetchClip(piece, t));
  const bufP: Promise<AudioBuffer | null> = clipP.then((c) => {
    if (!c.bytes) return null;
    const ctx = audioCtx();
    if (!ctx) return null;
    /* decodeAudioData detaches the buffer it is given, so it decodes a copy. */
    return ctx.decodeAudioData(c.bytes.slice().buffer).catch(() => null);
  });
  chain = chain.then(async () => {
    if (id !== speakGen) return;
    const buffer = await bufP;
    if (id !== speakGen) return;
    if (!buffer) {
      const c = await clipP;
      sayOnce(refusalText(c.status, c.error));
      stopSpeaking();
      return;
    }
    setSessionSpeaking();
    const played = await playClip(buffer);
    if (id !== speakGen) return;
    if (!played) {
      sayOnce('Read aloud failed. Try again.');
      stopSpeaking();
    }
  });
}

function finishRun(id: number): void {
  if (id !== speakGen) return;
  settleSessionAfterSpeak();
}

/** Read this aloud — a toggle: called while it is already reading this text,
 *  it stops instead of starting again. */
export function speak(text: string, say?: (m: string) => void, voice?: string): void {
  if (!text.trim()) return;
  if (speakActive && speakText === text) {
    stopSpeaking();
    return;
  }
  if (speakActive) stopSpeaking();
  speakText = text;
  /* A deliberate out-of-flow read: anything half-dictated is dropped rather
     than sent into the reading. */
  clearTimer();
  transcript = '';
  pending = '';
  /* In the tap gesture, so a standalone read-aloud can play on iOS without a
     mic session behind it. */
  unlock();
  const id = beginRun(say, voice);
  const { complete, tail } = splitStream(text);
  for (const s of complete) for (const piece of chunks(s)) enqueuePiece(piece, id);
  if (tail.trim()) for (const piece of chunks(tail)) enqueuePiece(piece, id);
  chain = chain.then(() => finishRun(id));
}

/** Arm the streaming read-aloud for a reply that is about to stream in.
 *  Returns the run id the feed and end calls must carry. */
export function startVoiceReply(say?: (m: string) => void): number {
  if (speakActive) stopSpeaking();
  return beginRun(say);
}

/** Feed the reply so far (the whole text, each time). Newly completed
 *  sentences are queued for speaking immediately — the first sound starts about
 *  a second after the first sentence is complete, while the rest of the reply
 *  is still arriving. */
export function feedVoiceReply(id: number, full: string): void {
  if (id !== speakGen || !speakActive) return;
  if (full.length < speakFed) {
    speakFed = 0;
    speakTail = '';
  }
  const fresh = full.slice(speakFed);
  speakFed = full.length;
  const { complete, tail } = splitStream(speakTail + fresh);
  speakTail = tail;
  for (const s of complete) for (const piece of chunks(s)) enqueuePiece(piece, id);
}

/** The reply stream ended. Flush the held-back tail, then finish the run when
 *  the queue drains. A failed reply says why once and stops. */
export function endVoiceReply(id: number, ok: boolean, error?: string): void {
  if (id !== speakGen || !speakActive) return;
  if (!ok) {
    sayOnce(error || 'The reply was cut short.');
    stopSpeaking();
    return;
  }
  const tail = speakTail.trim();
  speakTail = '';
  if (tail) for (const piece of chunks(tail)) enqueuePiece(piece, id);
  chain = chain.then(() => finishRun(id));
}

/** Stop the reading now. The generation bump invalidates the run; resolving the
 *  current clip unblocks the chain so it bails instead of hanging. */
export function stopSpeaking(): void {
  speakGen++;
  speakActive = false;
  if (currentSrc) {
    const src = currentSrc;
    currentSrc = null;
    try {
      src.stop();
    } catch {
      /* Already ended. */
    }
  }
  if (currentClip) {
    const finish = currentClip;
    currentClip = null;
    finish();
  }
  settleSessionAfterSpeak();
}

/* ── The microphone ──────────────────────────────────────────────────────────
 * One recogniser per mic session: it starts when the mic goes up and is
 * aborted when it comes down, and never in between. If the browser ends the
 * stream on its own (iOS does, after a phrase), it is revived silently — the
 * button never flickers, the session never dies. */

function recognizerCtor(): RecognizerCtor | undefined {
  const host = window as unknown as {
    SpeechRecognition?: RecognizerCtor;
    webkitSpeechRecognition?: RecognizerCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}

/** After a reading the recogniser is replaced — always, even if it never ended.
 *  A phone test proved the survivor goes deaf: iOS cuts its audio input once
 *  the speaker has played, without firing `onend`, so "still alive" is not
 *  "still hearing". The old instance is neutered first, so its late events
 *  belong to nobody; the fresh one starts after the half-second beat iOS
 *  insists on. */
let restartTimer: ReturnType<typeof setTimeout> | null = null;

function restartRecognizer(): void {
  const voice = listener;
  if (!voice) return;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  const old = recognizer;
  recognizer = null;
  if (!old) {
    startRec(voice);
    return;
  }
  /* Clean handoff: the new recognizer starts only after iOS has fully ended
     the old one. Starting while it is still stopping leaves the new one deaf —
     iOS reports audio-capture and the mic never recovers. This is what killed
     the mic after every reply. */
  let handed = false;
  const handoff = () => {
    if (handed) return;
    handed = true;
    old.onend = null;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (listener !== voice || recognizer) return;
    startRec(voice);
  };
  old.onresult = null;
  old.onerror = null;
  old.onend = handoff;
  try {
    old.stop();
  } catch {
    handoff();
  }
  if (!handed) {
    restartTimer = setTimeout(handoff, 4000);
  }
}

function startRec(voice: VoiceTyping): void {
  const Ctor = recognizerCtor();
  if (!Ctor || listener !== voice) return;

  const rec = new Ctor();
  recognizer = rec;
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (event) => {
    /* A result that arrives after the mic was put away belongs to nobody. */
    if (listener !== voice) return;
    /* Only your turn: anything arriving while the answer is on its way or being
       spoken is dropped. iOS delivers speech late, and keeping it is how text
       lands in the field from nowhere and gets stuck there, unable to send. */
    if (session !== 'listening') {
      return;
    }
    /* Words arrived — the revive is not failing, so its backoff starts over. */
    reviveDelay = RESTART_DELAY_MS;
    let settled = '';
    let interim = '';
    for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) settled += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (settled) transcript += settled;
    /* The tail replaces rather than accumulates: the browser's latest guess at
       the words still coming is the whole of what is not yet settled. */
    pending = interim;
    voice.write(transcript + pending);
    clearTimer();
    timer = setTimeout(() => voiceSend(voice), SILENCE_MS);
  };

  rec.onend = () => {
    if (listener !== voice) return;
    /* Ended while the answer was playing: not a failure, and reviving now
       would loop on the AI's own voice. The end of the reading revives it. */
    if (session === 'speaking') {
      recognizer = null;
      return;
    }
    /* A browser that ends the stream on its own may never give the silence
       timer its 800ms — flush anything still waiting, settled or not, so a
       phrase is never lost. */
    if ((transcript + pending).trim()) {
      clearTimer();
      voiceSend(voice, true);
    }
    /* Silent revive, backing off but never giving up. No UI change, no beep
       choreography — the session stays up through it. */
    recognizer = null;
    const delay = reviveDelay;
    reviveDelay = Math.min(reviveDelay * 2, RESTART_MAX_DELAY_MS);
    setTimeout(() => {
      if (listener !== voice || session === 'speaking' || recognizer) return;
      startRec(voice);
    }, delay);
  };

  rec.onerror = (event) => {
    const reason = event?.error;
    if (reason === 'not-allowed' || reason === 'service-not-allowed') {
      const v = listener;
      endMicSession();
      if (v) v.say('Microphone access was denied.');
    } else if (reason === 'language-not-supported') {
      const v = listener;
      endMicSession();
      if (v) v.say(`Microphone failed: ${reason}.`);
    } else if (reason === 'audio-capture') {
      /* Transient on iOS when the audio session has not been handed back yet
         after playback. Never fatal: onend follows and the revive brings a
         fresh recognizer. Ending the session here is what stranded the mic. */
    } else {
    }
    /* `no-speech`, `aborted` and `network` are not fatal: the browser stopped
       on its own — a dropped connection is routine on a phone — and `onend`
       follows and revives it. */
  };

  try {
    rec.start();
  } catch {
    /* The browser refused to open the stream synchronously. Leave nothing lit
       and silent. */
    const v = listener;
    endMicSession();
    if (v) v.say('Could not open the microphone.');
  }
}

/** The send: only from `listening`, only settled text, and the field the mic
 *  wrote is what the send reads — the composer's field ref, the one value
 *  every writer writes. Anything still in flight when the send goes waits its
 *  turn; anything arriving while the answer plays stays in the field for a
 *  deliberate press. `flush` sends the interim tail too, for a stream that
 *  ended and will never settle it. */
function voiceSend(voice: VoiceTyping, flush = false): void {
  if (listener !== voice || session !== 'listening') return;
  const text = (flush ? transcript + pending : transcript).trim();
  if (!text) return;
  if (flush) voice.write(text);
  transcript = '';
  pending = '';
  clearTimer();
  if (voice.send(true)) {
    session = 'thinking';
  } else {
  }
}

/** Start the mic: the browser check, then light the button and begin. The
 *  recogniser starts once here — the iOS beep is the mic unlocking, and it
 *  happens exactly once per session. */
function startMic(voice: VoiceTyping): void {
  if (!recognizerCtor()) {
    voice.say('Voice typing is not available in this browser.');
    return;
  }
  transcript = '';
  pending = '';
  reviveDelay = RESTART_DELAY_MS;
  listener = voice;
  session = 'listening';
  voice.lit(true);
  /* Inside the tap gesture, so the read-aloud that follows a voice message can
     play without a gesture of its own (iOS refuses a first play that no gesture
     began). */
  unlock();
  startRec(voice);
}

/** The mic comes down. The single abort in the whole file: the recogniser is
 *  stopped here and nowhere else. */
function endMicSession(): void {
  const voice = listener;
  listener = null;
  clearTimer();
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (recognizer) {
    const rec = recognizer;
    recognizer = null;
    rec.onresult = null;
    rec.onend = null;
    rec.onerror = null;
    try {
      rec.stop();
    } catch {
      /* Already finished. */
    }
  }
  transcript = '';
  pending = '';
  if (voice) voice.lit(false);
  stopSpeaking();
}

/** Off: the whole voice session ends, mic and speaker. */
export function stopListening(): void {
  endMicSession();
}

/** On iOS, backgrounding Safari mid-read can leave the session stuck speaking
 *  with a dead audio element. On return to the tab, end the session so nothing
 *  is left stuck. Registered once, lazily, so the module still imports cleanly
 *  in a server render. */
let visibilityArmed = false;
export function armVisibility(): void {
  if (visibilityArmed) return;
  visibilityArmed = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (session !== 'off') endMicSession();
  });
}

/** The tap: on if it is off, off if it is on. While the answer is playing the
 *  button is unlit (the speaker owns the session); a tap then means "stop
 *  talking and listen to me" — the reading stops and the mic is listening
 *  again in the same tap. Tapped during a read-aloud with no mic session, the
 *  mic comes on too: stopping the reading is only half the tap. */
export function toggleMic(voice: VoiceTyping): void {
  if (session === 'speaking') {
    const hadMic = !!listener;
    stopSpeaking();
    if (!hadMic) startMic(voice);
    return;
  }
  if (session === 'off') {
    startMic(voice);
    return;
  }
  endMicSession();
}
