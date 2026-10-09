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
 *  What the page gives per voice is a name, a gender and a recording, and nothing
 *  else — no adjectives at all. So each row says the two things that are facts
 *  (Google's own gender for it, and where the name is from: every one of the
 *  thirty is a star, a moon, or a figure out of myth) and claims nothing about how
 *  the voice sounds. How it sounds is what Play sample is for.
 */

export interface Voice {
  /** What the request sends: the name Google's API answers to, spelled whole so
   *  a stored value reads the same as a request. */
  id: string;
  /** What the row is called — the same name, without the `en-US-Chirp3-HD-`. */
  name: string;
  /** Google's column for this voice, not a guess (§ api/ai.ts, same table). */
  gender: 'Female' | 'Male';
  /** Where the name comes from. Nothing here describes how it sounds. */
  about: string;
}

/** The six, in the order the pane shows them. The default is first, and it is
 *  the same one the server falls back to, so a request that names no voice is
 *  answered by the row that is ticked. */
export const VOICES: Voice[] = [
  {
    id: 'en-US-Chirp3-HD-Achernar',
    name: 'Achernar',
    gender: 'Female',
    about: 'A star — the end of the river Eridanus.',
  },
  {
    id: 'en-US-Chirp3-HD-Achird',
    name: 'Achird',
    gender: 'Male',
    about: 'A star in Cassiopeia, sharing its light with a companion.',
  },
  {
    id: 'en-US-Chirp3-HD-Kore',
    name: 'Kore',
    gender: 'Female',
    about: 'Persephone under her oldest name: the maiden of the mysteries.',
  },
  {
    id: 'en-US-Chirp3-HD-Puck',
    name: 'Puck',
    gender: 'Male',
    about: 'A moon of Uranus, and the sprite who meddles in midsummer.',
  },
  {
    id: 'en-US-Chirp3-HD-Leda',
    name: 'Leda',
    gender: 'Female',
    about: 'A moon of Jupiter, and the mother of Helen.',
  },
  {
    id: 'en-US-Chirp3-HD-Fenrir',
    name: 'Fenrir',
    gender: 'Male',
    about: 'The wolf of Norse myth, spoken as one of Google\u2019s voices.',
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
