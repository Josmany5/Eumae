/* The cases behind checks/models.mjs, run against the real api/ai.ts.
 *
 *   node checks/models.selftest.mjs        (or: npm run check:models:selftest)
 *
 * Needs no key and makes no network call: it exercises the two pure parts —
 * which IDs the source sends, and what to say about them given Google's list —
 * so the check can be trusted before a key exists to point it at Google.
 *
 * Exit codes: 0 all cases hold, 1 one does not.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { idsIn, judge } from './models.mjs';

const SOURCE = fileURLToPath(new URL('../api/ai.ts', import.meta.url));
const source = readFileSync(SOURCE, 'utf8');
const ids = idsIn(source);
const names = [...ids.keys()].sort();

const cases = [];
const check = (name, got, expect) => cases.push({ name, got, expect });

check(
  'finds every model the code sends, and only those',
  names,
  ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite-image', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'].sort(),
);

/* Which entry a request that names no model lands on is the whole of Auto, and
   nothing about an ID makes it true — the fallback does. Read off the source, so
   a third chat branch, or a literal put back on those two lines, is caught here
   rather than by the person whose first message never answers. */
check(
  'both chat branches fall back to the same table entry, and it is Auto',
  [...source.matchAll(/\|\| MODEL_IDS\.(\w+);/g)].map((m) => m[1]),
  ['auto', 'auto'],
);

check('knows which entry Auto is', ids.get('gemini-2.5-flash-lite'), 'MODEL_IDS.auto');

check(
  'ignores the retired IDs that only appear in comments',
  { flash: names.includes('gemini-2.5-flash'), image: names.includes('gemini-2.5-flash-image') },
  { flash: false, image: false },
);

check('knows the table entry each ID came from', ids.get('gemini-3.8-flash'), 'MODEL_IDS.best');

check(
  'finds an ID hard-coded beside the table',
  [
    ...idsIn("const MODEL_IDS = { lite: 'gemini-9.9-flash' };\nconst m = MODEL_IDS[x] || 'gemini-9.9-pro';").entries(),
  ],
  [
    ['gemini-9.9-flash', 'MODEL_IDS.lite'],
    ['gemini-9.9-pro', 'a literal beside MODEL_IDS'],
  ],
);

check(
  'skips an ID that is only inside a comment',
  [...idsIn("/* 'gemini-1.1-old' was the model once */\nconst a = 'gemini-9.9-flash';").keys()],
  ['gemini-9.9-flash'],
);

check(
  'reads the model out of a generateContent URL',
  idsIn('const u = `...models/gemini-7.7-image:generateContent?key=${K}`;').get('gemini-7.7-image'),
  'a generateContent URL',
);

const served = new Map([
  ['gemini-2.5-flash-lite', ['generateContent']],
  ['gemini-3.5-flash-lite', ['generateContent']],
  ['gemini-3.8-flash', ['generateContent', 'countTokens']],
  ['gemini-3.1-flash-lite-image', ['generateContent']],
]);

check('passes when Google serves everything', judge(ids, served).every((r) => r.ok), true);

const oneGone = new Map(served);
oneGone.delete('gemini-3.8-flash');
check(
  'fails when one is no longer listed',
  judge(ids, oneGone).filter((r) => !r.ok).map((r) => `${r.id}: ${r.why}`),
  ['gemini-3.8-flash: Google does not list it'],
);

const wrongMethods = new Map(served);
wrongMethods.set('gemini-3.5-flash-lite', ['countTokens', 'embedContent']);
check(
  'fails when one is listed but cannot answer',
  judge(ids, wrongMethods).filter((r) => !r.ok).map((r) => `${r.id}: ${r.why}`),
  ['gemini-3.5-flash-lite: listed, but only for countTokens, embedContent'],
);

let failed = 0;
for (const c of cases) {
  const ok = JSON.stringify(c.got) === JSON.stringify(c.expect);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!ok) console.log(`      got      ${JSON.stringify(c.got)}\n      expected ${JSON.stringify(c.expect)}`);
}
console.log(failed === 0 ? `\nall ${cases.length} passed` : `\n${failed} of ${cases.length} FAILED`);
process.exit(failed === 0 ? 0 : 1);
