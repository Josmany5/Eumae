/* The voices the app offers — by Google's own names.
 *
 *  The mockup offers four: Nova, Alloy, Onyx and Shimmer (197, 613, 692). Those
 *  are OpenAI's voice names, and this server does not speak them: `speak`
 *  (api/ai.ts:416) asks Google Cloud Text-to-Speech for an `en-US-Chirp3-HD-*`
 *  name, and a name it does not recognise is answered with the default — so the
 *  four rows were one voice wearing four labels, which is why they all sounded
 *  the same. A row that names a voice nothing can fetch promises something that
 *  will never arrive.
 *
 *  So the names here are the ones that API answers to: six of the thirty Chirp 3:
 *  HD voices Google documents for en-US
 *  (cloud.google.com/text-to-speech/docs/chirp3-hd, read 2026-10-08 — the page
 *  the server's own table was checked against). The first two are the voices the
 *  server already spoke: Achernar was its fallback and Achird its `male`, so the
 *  default is unchanged and a stored name from the old four lands on it.
 *
 *  What that page gives per voice is a name, a gender and a recording — no
 *  adjectives at all. So each row used to say where the name came from (every one
 *  of the thirty is a star, a moon, or a figure out of myth) and claimed nothing
 *  about the sound. The owner asked for the sound (2026-10-08), and he is right
 *  about the picker: six names and six star stories is a list about Google's
 *  naming, not about the only question this pane has to answer — which of these
 *  do I want to listen to. So `sound` says that, and it is the one line in this
 *  file that Google's page does not contain: written here, by this app, as a
 *  guide to how each voice reads. `gender` beside it stays Google's own column,
 *  which checks/voice.mjs holds it to, and Play sample is still where any
 *  description can be checked against the thing itself.
 */

export interface Voice {
  /** What the request sends: the name Google's API answers to, spelled whole so
   *  a stored value reads the same as a request. */
  id: string;
  /** What the row is called — the same name, without the `en-US-Chirp3-HD-`. */
  name: string;
  /** Google's column for this voice, not a guess (§ api/ai.ts, same table). */
  gender: 'Female' | 'Male';
  /** How this voice is to listen to — this app's own guide, since Google
   *  publishes none, and the reason the row is worth reading at all. */
  sound: string;
}

/** The six, in the order the pane shows them. The default is first, and it is
 *  the same one the server falls back to, so a request that names no voice is
 *  answered by the row that is ticked. */
export const VOICES: Voice[] = [
  {
    id: 'en-US-Chirp3-HD-Achernar',
    name: 'Achernar',
    gender: 'Female',
    sound: 'Warm and even, unhurried — the calm one for a long answer.',
  },
  {
    id: 'en-US-Chirp3-HD-Achird',
    name: 'Achird',
    gender: 'Male',
    sound: 'Low and steady, with a narrator\u2019s edge.',
  },
  {
    id: 'en-US-Chirp3-HD-Kore',
    name: 'Kore',
    gender: 'Female',
    sound: 'Bright and clear, a little brisk — facts read quickly.',
  },
  {
    id: 'en-US-Chirp3-HD-Puck',
    name: 'Puck',
    gender: 'Male',
    sound: 'Light and young, with a lift at the end of a sentence.',
  },
  {
    id: 'en-US-Chirp3-HD-Leda',
    name: 'Leda',
    gender: 'Female',
    sound: 'Soft and close, slower than the rest — the bedtime one.',
  },
  {
    id: 'en-US-Chirp3-HD-Fenrir',
    name: 'Fenrir',
    gender: 'Male',
    sound: 'Deep and heavy, the slowest read of the six.',
  },
];

/** The one a request names when the setting is missing or unreadable. */
export const DEFAULT_VOICE: Voice = VOICES[0];

/* The setting lives under `eumae:voice`, written by Settings through `useStored`
   (Settings.tsx:53) — which stores JSON, so the value on disk is a quoted string
   and an old install holds `"Nova"`. Reading it here, in the module the voice is
   chosen from, instead of in the sender, is what keeps the wire honest: see
   `voiceName`. */
const VOICE_KEY = 'eumae:voice';

/** The row with this id — or with this bare name, since a value written by hand
 *  is as likely to say `Kore` as `en-US-Chirp3-HD-Kore`. Anything else at all is
 *  the default: a name this app no longer offers is a reason to speak in the
 *  default voice, never a reason to fail a reply. */
export function voiceById(id: unknown): Voice {
  return VOICES.find((v) => v.id === id || v.name === id) ?? DEFAULT_VOICE;
}

/** The setting as it stands, read where it is set rather than passed in: the two
 *  callers (`Settings`' sample button, `voice.ts`'s speak) are both one shot and
 *  neither has the value to hand. There is no subscription on purpose — a change
 *  lands on the next thing said, not on a re-render. */
export function storedVoice(): Voice {
  try {
    return voiceById(JSON.parse(localStorage.getItem(VOICE_KEY) ?? 'null'));
  } catch {
    /* No storage, or a value that is not JSON. Either way: the default. */
    return DEFAULT_VOICE;
  }
}

/** What travels as the voice name for a row. One function, so no call site can
 *  send a bare `name` (which Google would not know) or a label like `female`. */
export function voiceName(voice: Voice): string {
  return voice.id;
}

/* ── How fast it is read ──────────────────────────────────────────────────────
 *
 *  The server has taken a `rate` since `speak` was written (api/ai.ts:437): it
 *  parses the string, clamps it to 0.25–4.0 and hands it to Google as
 *  `speakingRate`. Nothing ever sent one, so every reply was read at 1.0 and the
 *  parameter was a promise with no caller — which is what the owner found when he
 *  went looking for the speed control (2026-10-08).
 *
 *  The four steps are the ones a person actually reaches for, and they double as
 *  the labels, so nothing here has to be translated into what the row shows.
 *  Anything else the setting could hold — a hand-edited file, a value from a
 *  build that had different steps — is treated as the default rather than
 *  clamped to whatever is nearest: a reading rate is not something to guess at,
 *  and 1× is the one speed that is never wrong.
 */

export interface Speed {
  /** What the speak request sends as `rate`, and what `speakRate` compares to. */
  rate: number;
  /** What the row shows. The same number, spelled the way a person writes it. */
  label: string;
}

export const SPEEDS: Speed[] = [
  { rate: 0.75, label: '0.75×' },
  { rate: 1, label: '1×' },
  { rate: 1.25, label: '1.25×' },
  { rate: 1.5, label: '1.5×' },
];

/** The step a missing or unreadable setting lands on: the middle one, and the
 *  speed every reply was read at before this setting existed. */
export const DEFAULT_SPEED = SPEEDS[1];

/** The setting lives under `eumae:voiceSpeed`, written by Settings through
 *  `useStored` (Settings.tsx:55) — which stores JSON, so the value on disk is a
 *  bare number and an old install holds nothing at all. Read here, in the module
 *  the voice settings live in, for the same reason `storedVoice` is: `voice.ts`
 *  asks for it at the start of a run and has no value to hand in. */
const SPEED_KEY = 'eumae:voiceSpeed';

/** The speed to read at, or the default. A rate that is not one of the four is
 *  the default — see the note above about not guessing. */
export function storedSpeed(): number {
  try {
    const stored = JSON.parse(localStorage.getItem(SPEED_KEY) ?? 'null') as unknown;
    return SPEEDS.find((s) => s.rate === stored)?.rate ?? DEFAULT_SPEED.rate;
  } catch {
    /* No storage, or a value that is not JSON. Either way: the middle step. */
    return DEFAULT_SPEED.rate;
  }
}
