#!/usr/bin/env node
/* Chat markdown selftest — the deliberate breaks the check must catch.
 *
 *  Needs no browser, no network. Exit 0 all caught, 1 something slipped.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const SOURCE = readFileSync(new URL('../src/md.ts', import.meta.url), 'utf8');

/* Whole-file transpile — see chat-md.mjs for why no lifter. */
const js = transformSync(SOURCE, { loader: 'ts', format: 'esm' }).code;
const mod = await import(`data:text/javascript,${encodeURIComponent(js)}`);

const cases = [
  ['xss-link', () => !mod.renderMd('[x](javascript:alert(1))').includes('<a')],
  ['xss-img', () => !mod.renderMd('<img src=x onerror=y>').includes('<img')],
  ['bold-in-code', () => mod.renderMd('`**not bold**`').includes('**not bold**')],
  ['link-in-code', () => mod.renderMd('`https://a.com`').includes('md-code')],
  ['multi-para', () => (mod.renderMd('a\n\nb').match(/md-p/g) || []).length === 2],
  ['header-level', () => mod.renderMd('# T').includes('md-h1')],
  ['mixed-list', () => mod.renderMd('- a\n1. b').includes('<ul') && mod.renderMd('- a\n1. b').includes('<ol')],
  ['empty-code', () => mod.renderMd('```\n```').includes('md-pre') === false],
  ['amp', () => mod.renderMd('a & b').includes('&amp;')],
  ['nested-bold-link', () => mod.renderMd('[**t**](https://a.com)').includes('<strong>')],
  ['trailing-punct', () => mod.renderMd('see https://a.com.').includes('md-link')],
];

const failures = cases.filter(([, fn]) => {
  try {
    return !fn();
  } catch {
    return true;
  }
});
if (failures.length) {
  console.error(`chat-md selftest: ${failures.length} slipped: ${failures.map(([n]) => n).join(', ')}`);
  process.exit(1);
}
console.log(`all ${cases.length} passed`);
