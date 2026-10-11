#!/usr/bin/env node
/* Chat markdown check — runs renderMd for real, no browser, no network.
 *
 *  src/md.ts is pure (no fetch, no DOM), but it is TypeScript. Like
 *  checks/chat.mjs, this lifts the functions out by name and transpiles
 *  them with the project's own esbuild — so the check runs what ships,
 *  not a copy of it.
 *
 *  Its own cases live in checks/chat-md.selftest.mjs.
 *  Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const SOURCE = readFileSync(new URL('../src/md.ts', import.meta.url), 'utf8');

/* md.ts is pure (no imports, no fetch, no DOM) — transpile the whole file
   and import it. No brace-matching lifter: the regexes carry `{1,4}`
   quantifiers that a naive counter reads as blocks. */
const js = transformSync(SOURCE, { loader: 'ts', format: 'esm' }).code;
const mod = await import(`data:text/javascript,${encodeURIComponent(js)}`);

const failures = [];
const check = (name, cond) => {
  if (!cond) failures.push(name);
};

// Bold renders, stars gone.
check('bold', mod.renderMd('**hi**').includes('<strong>hi</strong>'));
// Italic.
check('italic', mod.renderMd('*hi*').includes('<em>hi</em>'));
// Inline code.
check('code', mod.renderMd('`x`').includes('md-code'));
// Bullet list.
check('ul', mod.renderMd('- a\n- b').includes('<ul'));
// Numbered list.
check('ol', mod.renderMd('1. a\n2. b').includes('<ol'));
// Header.
check('h', mod.renderMd('### T').includes('md-h'));
// Titled link — blue class, opens out.
{
  const out = mod.renderMd('[NIH](https://nih.gov/x)');
  check('link', out.includes('md-link') && out.includes('target="_blank"') && out.includes('NIH'));
}
// Bare URL becomes tappable.
check('bare', mod.renderMd('see https://example.com/a').includes('md-link'));
// XSS washed — no script runs.
{
  const out = mod.renderMd('<script>alert(1)</script>');
  check('xss', !out.includes('<script>') && out.includes('&lt;script&gt;'));
}
// Code fence — gray box, language label not shown.
{
  const out = mod.renderMd('```html\n<b>x</b>\n```');
  check('fence', out.includes('md-pre') && out.includes('&lt;b&gt;'));
}
// Unclosed bold tolerated, not broken.
check('unclosed', mod.renderMd('**half').includes('**half'));
// Empty string — empty out.
check('empty', mod.renderMd('') === '');

if (failures.length) {
  console.error(`chat-md: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`all ${12 - failures.length} passed`);
