#!/usr/bin/env node
/* Classroom check - courses + progress + quiz, real code. */
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

function loadMod(path) {
  const r = buildSync({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  return r.outputFiles[0].text;
}

const js = loadMod('../src/classroom.ts');

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) { failures.push(name); console.log('FAIL  ' + name + (detail ? ' - ' + detail : '')); }
  else { console.log('PASS  ' + name); }
};

function run(setup, body) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  setup(store);
  const mod = { exports: {} };
  const load = new Function('module', 'exports', 'localStorage', js + '\nreturn module.exports;');
  const ns = load(mod, mod.exports, localStorage);
  const names = Object.keys(ns).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
  const fn = new Function('ns', 'localStorage', 'const {' + names.join(', ') + '} = ns; return (' + body + ');');
  return { out: fn(ns, localStorage), store };
}

// 1. Two courses, seed percents + lessons verbatim.
{
  const { out } = run(() => {}, '(() => ({ n: COURSE_ORDER.length, sp: COURSES.Spanish.p, ai: COURSES["AI Engineering"].p, les: COURSES.Spanish.les.length }))()');
  check('courses', out.n === 2 && out.sp === 42 && out.ai === 30 && out.les === 3, JSON.stringify(out));
}

// 2. Progress recomputes from lessons; marking one moves it.
{
  const { out } = run(() => {}, '(() => { const a = courseProgress("Spanish"); markLessonDone("Spanish", "Lesson 5 · The past tense"); const b = courseProgress("Spanish"); return { a, b }; })()');
  check('progress', out.a === 33 && out.b === 67, JSON.stringify(out));
}

// 3. Quiz right answer resolves; unknown course is null.
{
  const { out } = run(() => {}, '(() => ({ r: quizRight("Spanish"), n: quizRight("Nope") }))()');
  check('quiz', out.r === 'La cuenta, por favor' && out.n === null, JSON.stringify(out));
}

// 4. Sections + tutorials verbatim counts.
{
  const { out } = run(() => {}, '(() => ({ s: SECTION_ORDER.length, tuts: Object.keys(TUTORIALS).length, digest: DIGEST.length }))()');
  check('sections', out.s === 4 && out.tuts === 6 && out.digest === 3, JSON.stringify(out));
}

// 5. Bad stored progress falls back clean.
{
  const { out } = run((store) => { store['eumae:classroom'] = 'nope{'; }, '(() => courseProgress("Spanish"))()');
  check('bad-falls-back', out === 33, JSON.stringify(out));
}

if (failures.length) { console.error('classroom: ' + failures.length + ' failed: ' + failures.join(', ')); process.exit(1); }
console.log('all 5 passed');
