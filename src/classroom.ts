/* Classroom: courses with progress, sections, tutorials.
 *
 * CR8 (course progress + lessons + quiz), CX8 (four sections: blurb +
 * yours + discover + create CTA) and TUT12 (tutorial steps) are the
 * mockup's own copy, verbatim. Progress writes back (lesson done flips,
 * percent recomputes); quiz answers are pure (right/wrong pick out).
 */

export interface CourseLesson {
  t: string;
  done: boolean;
}

export interface CourseQuiz {
  q: string;
  right: string;
  wrong: string;
}

export interface Course {
  /** Progress percent — the mockup's c.p. Recomputed from lessons. */
  p: number;
  les: CourseLesson[];
  q: CourseQuiz;
}

export const COURSES: Record<string, Course> = {
  Spanish: {
    p: 42,
    les: [
      { t: 'Lesson 4 · Ordering food', done: true },
      { t: 'Lesson 5 · The past tense', done: false },
      { t: 'Lesson 6 · Giving directions', done: false },
    ],
    q: { q: 'How do you say "the bill, please"?', right: 'La cuenta, por favor', wrong: 'La cuenta, gracias' },
  },
  'AI Engineering': {
    p: 30,
    les: [
      { t: 'Ch 2 · Prompts as programs', done: true },
      { t: 'Ch 3 · The harness', done: false },
      { t: 'Ch 4 · Memory that lasts', done: false },
    ],
    q: {
      q: 'What does a harness actually do?',
      right: 'Keeps the model on the current task',
      wrong: 'Gives it a bigger context window',
    },
  },
};

export const COURSE_ORDER = Object.keys(COURSES);

/** Hero: what continues — the mockup's Spanish L5 card. */
export const CONTINUE = { course: 'Spanish', lesson: 'Lesson 5 of 12 — The past tense' };

export interface CxSection {
  blurb: string;
  yours: string[];
  discover: string[];
  create: string;
}

export const SECTIONS: Record<string, CxSection> = {
  Courses: {
    blurb: 'Structured subjects with lessons, quizzes and progress.',
    yours: ['Spanish · Lesson 5 of 12', 'AI Engineering · Ch 3'],
    discover: ['Physics', 'Design basics', 'Public speaking'],
    create: 'Create a course',
  },
  Training: {
    blurb: 'Professional material built for your team. Assigning happens in Guild.',
    yours: ['Sales onboarding · assigned to you', 'Onboarding · you assigned'],
    discover: ['Safety basics', 'New hire checklist'],
    create: 'Create a training',
  },
  Digest: {
    blurb: 'Drop in a link, video or book — get the key points. No lesson plan, no progress.',
    yours: ['gbrain teardown', 'Speech as programming'],
    discover: ['Fed rate explainer', 'Weekly AI news'],
    create: '',
  },
  'App tutorials': {
    blurb: 'How to get the most from each part of Eumae. Reference only.',
    yours: ['Using Chat', 'Using Studio', 'Using Console', 'Using Library', 'Using Classroom', 'Using Guild'],
    discover: [],
    create: '',
  },
};

export const SECTION_ORDER = Object.keys(SECTIONS);
export const TUTORIALS: Record<string, string[]> = {
  'Using Chat': [
    'Open Chat and ask for anything — a draft, a plan, a lesson.',
    'Type / to bring up modes, roles and skills.',
    'Attach a file from + when the chat needs context.',
  ],
  'Using Studio': [
    "Studio holds everything you've made — drafts, published, every version.",
    'Open anything to see it full; text pieces open in the editor.',
    'Publish when it is ready and it files into Library.',
  ],
  'Using Guild': [
    'Guild is people: messages, requests, assigned work, the marketplace.',
    'Pin a conversation or the marketplace to your Guild page.',
    'Classroom builds training; Guild assigns it.',
  ],
  'Using Console': [
    'Console is right now: tasks, calendar, the briefing.',
    'Hold a page to edit; add widgets Quick or Full.',
    'Full pages live in the menu.',
  ],
  'Using Library': [
    'Library holds published and saved things only.',
    'Drafts live in Studio until you publish them.',
    'Folders, by type, recent — same items, different lenses.',
  ],
  'Using Classroom': [
    'Courses keep progress; Digest is on-demand answers.',
    'Assigned training appears here; progress flows back to Guild.',
    'Lessons happen here or in Chat — progress counts either way.',
  ],
};

export interface DigestItem {
  t: string;
  k: string;
  d: string;
}

/* Digest rows — the mockup's dg() three. */
export const DIGEST: DigestItem[] = [
  { t: "gbrain teardown — Garry Tan's memory system", k: 'VID', d: 'YouTube · 18:24' },
  { t: 'Speech as programming', k: 'VID', d: 'Video · 12:48' },
  { t: 'Fed rate explainer', k: 'LINK', d: 'Article · 6 min read' },
];

const KEY = 'eumae:classroom';

interface CxState {
  done: Record<string, string[]>;
}

let cache: CxState | null = null;

function load(): CxState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = { done: {} };
      return cache;
    }
    const p = JSON.parse(raw);
    cache = p && typeof p === 'object' && p.done && typeof p.done === 'object' ? { done: p.done } : { done: {} };
    return cache;
  } catch {
    cache = { done: {} };
    return cache;
  }
}

function save(s: CxState): void {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Non-fatal. */
  }
}

/* Lessons done = seed flags + stored extras. Percent = done/total. */
export function courseProgress(name: string): number {
  const c = COURSES[name];
  if (!c) return 0;
  const extra = load().done[name] || [];
  const done = c.les.filter((l) => l.done || extra.includes(l.t)).length;
  return Math.round((done / Math.max(1, c.les.length)) * 100);
}

export function isLessonDone(course: string, lesson: string): boolean {
  const c = COURSES[course];
  if (!c) return false;
  const seed = c.les.find((l) => l.t === lesson);
  if (seed?.done) return true;
  return (load().done[course] || []).includes(lesson);
}

export function markLessonDone(course: string, lesson: string): void {
  const s = load();
  const list = s.done[course] || [];
  if (!list.includes(lesson) && (COURSES[course]?.les.some((l) => l.t === lesson) ?? false)) {
    save({ done: { ...s.done, [course]: [...list, lesson] } });
  }
}

/* Quiz answer: which button is right — the mockup's qA(el,ok). Pure. */
export function quizRight(course: string): string | null {
  return COURSES[course]?.q.right ?? null;
}
