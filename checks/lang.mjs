#!/usr/bin/env node
/* Language check: the Voice language setting decides the language Eumae replies
 * in, for every language, English included, whatever earlier messages were in.
 *
 * The bug this exists for (Oct 20): the line was blank for English and soft
 * ("unless they clearly write in another language") for the rest, so a chat
 * that started in Spanish stayed Spanish after switching to Italian or English,
 * even after a reload. These cases build the real request the way Chat and the
 * office do (toApiBody, then withEumae) and read what the model would see.
 *
 * Exit codes: 0 everything holds, 1 something does not. */
import { buildSync } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const setLang = (code) => localStorage.setItem('eumae:voiceLang', JSON.stringify(code));

const out = buildSync({
  stdin: {
    contents: `export * from './src/voiceLang'; export { toApiBody } from './src/request'; export { withEumae } from './src/eumae/loop';`,
    resolveDir: new URL('..', import.meta.url).pathname,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
});
const dir = mkdtempSync(join(tmpdir(), 'lang-'));
const file = join(dir, 'lang.mjs');
writeFileSync(file, out.outputFiles[0].text);
const M = await import(pathToFileURL(file).href);

let bad = 0;
const ok = (cond, what) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`); if (!cond) bad++; };

// 1. Every language gets the same hard rule. No language is skipped, no loophole.
for (const l of M.VOICE_LANGS) {
  const line = M.replyLanguageLine(l);
  if (!line.includes(`reply only in ${l.english}`) || !/even if earlier messages/.test(line) || /unless/i.test(line)) {
    ok(false, `rule for ${l.code}: ${line}`);
  }
}
ok(true, `all ${M.VOICE_LANGS.length} languages get the hard rule, English included`);

// 2. The real request, Spanish history, then switch languages.
const spanish = [
  { role: 'you', text: 'Hola Eumae, ¿cómo estás hoy?' },
  { role: 'eumae', text: '¡Hola! Estoy bien, gracias. ¿En qué te ayudo?' },
  { role: 'you', text: 'Hazme un tracker de hábitos por favor' },
  { role: 'eumae', text: 'Claro, aquí tienes tu tracker de hábitos.' },
];
const req = (text) => ({ text, refs: [] });
function seen(code, text) {
  setLang(code);
  const body = M.withEumae(M.toApiBody(req(text), spanish), 'Chat');
  return { sp: body.data.systemPrompt, msg: body.data.message };
}
for (const [code, name] of [['it-IT', 'Italian'], ['en-US', 'English'], ['ja-JP', 'Japanese'], ['es-US', 'Spanish']]) {
  const { sp, msg } = seen(code, 'ok');
  ok(sp.trimEnd().endsWith(M.replyLanguageLine(M.voiceLangByCode(code)).trim()), `${name}: the rule is the last thing in the prompt`);
  ok(sp.split('LANGUAGE (app setting').length === 2, `${name}: the rule appears once`);
  ok(msg.endsWith(`(Reply in ${name}.)`), `${name}: the newest message carries the nudge`);
  ok(!/Spanish/.test(sp) || name === 'Spanish', `${name}: nothing in the prompt names Spanish`);
}

// 3. Reload: the setting is read fresh from storage each turn, never cached.
setLang('it-IT');
setLang('en-US');
ok(seen('en-US', 'what time is it').msg.endsWith('(Reply in English.)'), 'after switching back, English holds (reload reads storage)');

// 4. A missing or broken setting falls back to English, never to the chat.
delete store['eumae:voiceLang'];
ok(M.toApiBody(req('hi'), spanish).data.message.endsWith('(Reply in English.)'), 'no setting means English');
store['eumae:voiceLang'] = '{broken';
ok(M.toApiBody(req('hi'), spanish).data.message.endsWith('(Reply in English.)'), 'a broken setting means English');

// 5. The thread keeps what was typed; the nudge goes to the model only.
setLang('it-IT');
const hist = M.toApiBody(req('ciao'), [...spanish, { role: 'you', text: 'ciao' }]).data.conversationHistory;
ok(!hist.some((m) => m.content.includes('(Reply in')), 'history holds no nudges');

console.log(bad ? `\n${bad} failed` : '\nlanguage: all good');
process.exit(bad ? 1 : 0);
