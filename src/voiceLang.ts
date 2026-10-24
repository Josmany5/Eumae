/* Voice language — the one language the mic listens in, Eumae answers in, and
 * read-aloud speaks in.
 *
 * The list is Google's Chirp 3: HD locales (cloud.google.com/text-to-speech/docs/
 * chirp3-hd, read 2026-10-20): 54 locales, 48 languages. Read-aloud is the
 * narrowest of the three, so it decides what is offered. `rec` is the tag the
 * browser's speech recogniser is given, which differs from the voice locale in
 * three places (Arabic, Mandarin, Cantonese).
 *
 * The setting is stored by Settings through `useStored` under `eumae:voiceLang`,
 * as JSON, and read here at the moment it is needed — no subscription, so a
 * change lands on the next thing said. */

export interface VoiceLang {
  /** Google's TTS locale, and the stored value. */
  code: string;
  /** What the picker shows, in the language itself. */
  label: string;
  /** The English name Eumae is told to answer in. */
  english: string;
  /** The tag the browser's recogniser listens with. */
  rec: string;
}

const L = (code: string, label: string, english: string, rec = code): VoiceLang => ({ code, label, english, rec });

export const VOICE_LANGS: VoiceLang[] = [
  L('en-US', 'English (US)', 'English'),
  L('en-GB', 'English (UK)', 'English'),
  L('en-AU', 'English (Australia)', 'English'),
  L('en-IN', 'English (India)', 'English'),
  L('es-US', 'Español (EE. UU.)', 'Spanish'),
  L('es-ES', 'Español (España)', 'Spanish'),
  L('pt-BR', 'Português (Brasil)', 'Portuguese'),
  L('fr-FR', 'Français (France)', 'French'),
  L('fr-CA', 'Français (Canada)', 'French'),
  L('it-IT', 'Italiano', 'Italian'),
  L('de-DE', 'Deutsch', 'German'),
  L('nl-NL', 'Nederlands', 'Dutch'),
  L('nl-BE', 'Nederlands (België)', 'Dutch'),
  L('cmn-CN', '中文（普通话）', 'Mandarin Chinese (Simplified)', 'zh-CN'),
  L('yue-HK', '粵語（香港）', 'Cantonese (Traditional Chinese)', 'zh-HK'),
  L('ja-JP', '日本語', 'Japanese'),
  L('ko-KR', '한국어', 'Korean'),
  L('ar-XA', 'العربية', 'Arabic', 'ar-SA'),
  L('hi-IN', 'हिन्दी', 'Hindi'),
  L('bn-IN', 'বাংলা', 'Bengali'),
  L('ur-IN', 'اردو', 'Urdu'),
  L('pa-IN', 'ਪੰਜਾਬੀ', 'Punjabi'),
  L('gu-IN', 'ગુજરાતી', 'Gujarati'),
  L('mr-IN', 'मराठी', 'Marathi'),
  L('ta-IN', 'தமிழ்', 'Tamil'),
  L('te-IN', 'తెలుగు', 'Telugu'),
  L('kn-IN', 'ಕನ್ನಡ', 'Kannada'),
  L('ml-IN', 'മലയാളം', 'Malayalam'),
  L('ru-RU', 'Русский', 'Russian'),
  L('uk-UA', 'Українська', 'Ukrainian'),
  L('pl-PL', 'Polski', 'Polish'),
  L('cs-CZ', 'Čeština', 'Czech'),
  L('sk-SK', 'Slovenčina', 'Slovak'),
  L('sl-SI', 'Slovenščina', 'Slovenian'),
  L('hr-HR', 'Hrvatski', 'Croatian'),
  L('sr-RS', 'Српски', 'Serbian (Cyrillic)'),
  L('bg-BG', 'Български', 'Bulgarian'),
  L('ro-RO', 'Română', 'Romanian'),
  L('hu-HU', 'Magyar', 'Hungarian'),
  L('el-GR', 'Ελληνικά', 'Greek'),
  L('tr-TR', 'Türkçe', 'Turkish'),
  L('he-IL', 'עברית', 'Hebrew'),
  L('sv-SE', 'Svenska', 'Swedish'),
  L('nb-NO', 'Norsk bokmål', 'Norwegian'),
  L('da-DK', 'Dansk', 'Danish'),
  L('fi-FI', 'Suomi', 'Finnish'),
  L('et-EE', 'Eesti', 'Estonian'),
  L('lv-LV', 'Latviešu', 'Latvian'),
  L('lt-LT', 'Lietuvių', 'Lithuanian'),
  L('id-ID', 'Bahasa Indonesia', 'Indonesian'),
  L('vi-VN', 'Tiếng Việt', 'Vietnamese'),
  L('th-TH', 'ไทย', 'Thai'),
  L('sw-KE', 'Kiswahili', 'Swahili'),
];

export const DEFAULT_VOICE_LANG = VOICE_LANGS[0];

const LANG_KEY = 'eumae:voiceLang';

export function voiceLangByCode(code: unknown): VoiceLang {
  return VOICE_LANGS.find((l) => l.code === code) ?? DEFAULT_VOICE_LANG;
}

/** The setting as it stands, or English (US). */
export function storedVoiceLang(): VoiceLang {
  try {
    return voiceLangByCode(JSON.parse(localStorage.getItem(LANG_KEY) ?? 'null'));
  } catch {
    return DEFAULT_VOICE_LANG;
  }
}

/** The language rule, the same template for every language (English too):
 *  the setting decides, never the language earlier messages happen to be in.
 *  It was soft before ("unless they clearly write in another language") and
 *  blank for English, so an old Spanish chat kept Eumae in Spanish (Oct 20). */
export function replyLanguageLine(l: VoiceLang = storedVoiceLang()): string {
  return `\n\nLANGUAGE (app setting, overrides everything above): reply only in ${l.english}, even if earlier messages in this chat are in a different language. Short replies like "ok" or "yes" do not change the language.`;
}

/** The same rule in one line, riding under the newest message, where the model
 *  weighs it most. It goes to the model only; the thread stores what was typed. */
export function replyLanguageNudge(l: VoiceLang = storedVoiceLang()): string {
  return `\n\n(Reply in ${l.english}.)`;
}

/** Moves the language rule to the very end of a system prompt, after anything
 *  later code appended (sandbox, hints, tool rules). */
export function languageLast(systemPrompt: string, l: VoiceLang = storedVoiceLang()): string {
  const line = replyLanguageLine(l);
  return systemPrompt.split(line).join('') + line;
}
