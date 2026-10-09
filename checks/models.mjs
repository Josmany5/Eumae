#!/usr/bin/env node
/* Ask Google whether the model IDs this repo sends are still being served.
 *
 * A retired or access-limited model ID is not a build error. Nothing fails
 * until someone sends a message, and then the reply that does not arrive is the
 * only symptom — which is how `best` was found: `gemini-2.5-flash` is not
 * deprecated, but Google serves the 2.5 generation only to accounts that used it
 * while it was current, and a new deployment never did
 * (ai.google.dev/gemini-api/docs/deprecations, read 2026-10-08).
 *
 * The IDs are read out of api/ai.ts rather than repeated here, so this file
 * cannot drift from the code it checks. Only two places in that file count as
 * naming a model: the `MODEL_IDS` table, and a `models/<id>:generateContent`
 * URL. An ID named in prose — in the comments explaining what was replaced — is
 * history, not traffic, and is skipped on purpose.
 *
 * Run it with a key to ask with:
 *   GEMINI_API_KEY=... node checks/models.mjs
 * or pull the project's own environment down first:
 *   vercel env pull .env.local && set -a && . ./.env.local && set +a && node checks/models.mjs
 *
 * The two pure parts of this file — which IDs the source sends, and what to say
 * about them — are covered by checks/models.selftest.mjs, which needs no key.
 *
 * Exit codes: 0 every ID is served, 1 at least one is not, 2 no key to ask with.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = new URL('../api/ai.ts', import.meta.url);
const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Every model ID the code actually sends, with where it was found.
 *
 *  Two shapes count: a quoted literal in the code, and a
 *  `models/<id>:generateContent` URL. Block comments are removed first, so an
 *  ID named in prose — in a comment explaining what was replaced — is history,
 *  not traffic. Quoted literals are read on purpose, and not just the table: a
 *  model ID hard-coded beside the table is precisely the duplicate worth
 *  finding, and scanning only `MODEL_IDS` would have missed the copy that was
 *  sitting in both chat branches.
 */
export function idsIn(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = new Map();
  for (const line of code.split('\n')) {
    for (const quoted of line.matchAll(/['"](gemini-[a-z0-9.-]+)['"]/g)) {
      const entry = line.match(/(\w+):\s*['"]gemini-/);
      const where = entry
        ? `MODEL_IDS.${entry[1]}`
        : line.includes('MODEL_IDS')
          ? 'a literal beside MODEL_IDS'
          : 'a literal';
      found.set(quoted[1], where);
    }
    for (const url of line.matchAll(/models\/([a-z0-9][a-z0-9.-]*):generateContent/g)) {
      found.set(url[1], 'a generateContent URL');
    }
  }
  return found;
}

/** What to say about each ID, given Google's list of what it serves. */
export function judge(ids, served) {
  return [...ids].map(([id, where]) => {
    const methods = served.get(id);
    if (!methods) return { id, where, ok: false, why: 'Google does not list it' };
    if (!methods.includes('generateContent')) {
      return { id, where, ok: false, why: `listed, but only for ${methods.join(', ') || 'nothing'}` };
    }
    return { id, where, ok: true, why: 'served for generateContent' };
  });
}

/** Every model Google lists, id to the methods it supports, across pages. */
async function servedByGoogle(key, hide) {
  const served = new Map();
  let pageToken = '';
  do {
    const url = new URL(LIST_URL);
    url.searchParams.set('key', key);
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google refused to list models: HTTP ${res.status} ${hide(body).slice(0, 300)}`);
    }
    const page = await res.json();
    for (const model of page.models || []) {
      const name = String(model.name || '').replace(/^models\//, '');
      if (name) served.set(name, Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : []);
    }
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return served;
}

async function main() {
  const key = process.env.GEMINI_API_KEY || '';
  /* Nothing printed from here on can carry the key, whatever it came from. */
  const hide = (text) => (key ? String(text).split(key).join('***') : String(text));
  const say = (text) => console.log(hide(text));

  let source = '';
  try {
    source = readFileSync(SOURCE, 'utf8');
  } catch (err) {
    say(`Cannot read ${fileURLToPath(SOURCE)}: ${err.message}`);
    process.exit(1);
  }
  const ids = idsIn(source);
  if (ids.size === 0) {
    say('No model IDs found in api/ai.ts — either they all moved, or this check has stopped looking in the right place.');
    process.exit(1);
  }

  if (!key) {
    say('No GEMINI_API_KEY in the environment, so there is nothing to ask Google with.');
    say(`${ids.size} IDs would have been checked: ${[...ids.keys()].join(', ')}`);
    say('Pull the deployment\'s own environment down and run this again:');
    say('  vercel env pull .env.local && set -a && . ./.env.local && set +a && node checks/models.mjs');
    process.exit(2);
  }

  let served;
  try {
    served = await servedByGoogle(key, hide);
  } catch (err) {
    say(err.message);
    process.exit(1);
  }
  say(`Google lists ${served.size} models.`);

  const results = judge(ids, served);
  for (const r of results) {
    say(`  ${r.ok ? 'ok  ' : 'GONE'}  ${r.id.padEnd(28)} ${r.why}  (${r.where})`);
  }
  const missing = results.filter((r) => !r.ok);
  if (missing.length) {
    say('');
    say(`${missing.length} of ${results.length} cannot be used. Check the replacement on`);
    say('https://ai.google.dev/gemini-api/docs/deprecations, then update MODEL_IDS/api/ai.ts.');
    process.exit(1);
  }
  say('');
  say(`All ${results.length} are served.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
