/* Studio as discovery (his call, Oct 27, 9:42 PM): Chat is where you just
 * make things; Studio is where you see what's possible and get helped into
 * the specifics (who it's for, purpose, style, colors, length, tone, what it
 * must include) before anything is made.
 *
 * Shape (locked Oct 27, 9:00-9:09 PM): 4 groups, 21 kinds. Plan and
 * Checklist are cut (Eumae makes those directly); Course, Training, Quiz and
 * Flashcards live in Classroom. Every kind has a Custom option first.
 *
 * Data only: the screen walks group -> kind -> template -> guided steps, and
 * briefOf() turns the picks into the detailed ask Chat receives. */

import type { LibKind } from './library';

export interface Opt {
  /** What the chip says. */
  l: string;
  /** One line under it, when it helps. */
  d?: string;
  /** Style thumbnail: background, text color, sample words. */
  thumb?: { bg: string; fg: string; t: string };
  /** Palette swatches. */
  sw?: string[];
}

export type StepId = 'describe' | 'for' | 'purpose' | 'style' | 'colors' | 'length' | 'tone' | 'must';

export interface Step {
  id: StepId;
  /** Label in the step row and on the brief card. */
  name: string;
  /** The question at the top of the step. */
  q: string;
  /** Eumae's tip for this step: why it matters. */
  tip: string;
  opts: Opt[];
  /** Pick several (Must include) instead of one. */
  multi?: boolean;
}

export interface Template {
  n: string;
  d: string;
  /** Picks a template fills in for you. */
  preset?: Partial<Record<StepId, string | string[]>>;
}

export interface Kind {
  n: string;
  icon: string;
  d: string;
  lib: LibKind;
  /** Needs the backend: shown, not makeable yet. */
  soon?: boolean;
  templates: Template[];
  purpose: Opt[];
  length?: Opt[];
  must: Opt[];
  /** Kinds where look and color don't apply (an agent, a skill). */
  noLook?: boolean;
}

export interface Group {
  n: string;
  icon: string;
  d: string;
  kinds: string[];
}

/* ---- Shared option sets ---- */

const FOR: Opt[] = [
  { l: 'Myself' },
  { l: 'Customers' },
  { l: 'Investors' },
  { l: 'My team' },
  { l: 'Family and friends' },
  { l: 'A boss or client' },
];

function styles(sample: string): Opt[] {
  return [
    { l: 'Clean', d: 'Calm, clear, numbers first', thumb: { bg: '#0f1530', fg: '#ffffff', t: sample } },
    { l: 'Bold', d: 'Big type, loud color', thumb: { bg: '#ff5a36', fg: '#ffffff', t: sample.toUpperCase() } },
    { l: 'Warm', d: 'Soft colors, photos, friendly', thumb: { bg: '#f4f1ea', fg: '#2a2420', t: sample } },
    { l: 'Minimal', d: 'White space, one idea at a time', thumb: { bg: '#ffffff', fg: '#111111', t: sample } },
    { l: 'Dark', d: 'Dark background, sharp accents', thumb: { bg: '#141414', fg: '#9a86ff', t: sample } },
    { l: 'Playful', d: 'Rounded, bright, fun', thumb: { bg: '#ffd84a', fg: '#1d1d1d', t: sample } },
  ];
}

const COLORS: Opt[] = [
  { l: 'Ocean', sw: ['#0b3d91', '#1e88e5', '#e3f2fd'] },
  { l: 'Sunset', sw: ['#ff5a36', '#ffb347', '#fff3e0'] },
  { l: 'Forest', sw: ['#1b5e20', '#66bb6a', '#f1f8e9'] },
  { l: 'Mono', sw: ['#111111', '#777777', '#f5f5f5'] },
  { l: 'Pastel', sw: ['#f8bbd0', '#b3e5fc', '#fff9c4'] },
  { l: 'Royal', sw: ['#4a148c', '#9a86ff', '#ede7f6'] },
  { l: 'My brand colors', d: 'Tell Eumae the colors' },
];

const TONE: Opt[] = [
  { l: 'Friendly' },
  { l: 'Professional' },
  { l: 'Bold' },
  { l: 'Playful' },
  { l: 'Calm' },
  { l: 'Persuasive' },
];

const SIZE: Opt[] = [{ l: 'Small' }, { l: 'Medium' }, { l: 'Large' }];

/* ---- The 4 groups ---- */

export const GROUPS: Group[] = [
  { n: 'Productivity', icon: 'doc', d: 'Docs, slides, sheets and more for work', kinds: ['Document', 'Slides', 'Sheet', 'Chart', 'PDF', 'Form', 'Email'] },
  { n: 'Apps & Web', icon: 'globe', d: 'Pages, apps, games and widgets that run', kinds: ['App', 'Game', 'Webpage', 'Widget'] },
  { n: 'Creative Materials', icon: 'img', d: 'Images, graphics, ads, scripts and video', kinds: ['Image', 'Graphics', 'Collage', 'Album', 'Video', 'Ads', 'Script'] },
  { n: 'Intelligence', icon: 'zap', d: 'Agents, skills and automations that work for you', kinds: ['Agent', 'Skill', 'Automation'] },
];

/* ---- The 21 kinds ---- */

export const KINDS: Record<string, Kind> = {
  Document: {
    n: 'Document', icon: 'doc', lib: 'DOC', d: 'Résumés, essays, reports and memos',
    templates: [
      { n: 'Résumé', d: 'One page that gets you the interview', preset: { purpose: 'Get hired', length: '1 page', must: ['Contact details', 'Work history', 'Skills'] } },
      { n: 'Essay', d: 'An argument that holds together', preset: { purpose: 'Explain an idea', length: '2 to 3 pages' } },
      { n: 'Report', d: 'Findings and what to do next', preset: { purpose: 'Report results', must: ['Summary up top', 'Next steps'] } },
      { n: 'Memo', d: 'One decision, short and clear', preset: { purpose: 'Get a decision', length: '1 page' } },
    ],
    purpose: [{ l: 'Get hired' }, { l: 'Explain an idea' }, { l: 'Report results' }, { l: 'Get a decision' }, { l: 'Persuade someone' }],
    length: [{ l: '1 page' }, { l: '2 to 3 pages' }, { l: '5+ pages' }],
    must: [{ l: 'Summary up top' }, { l: 'Contact details' }, { l: 'Work history' }, { l: 'Skills' }, { l: 'Headings' }, { l: 'Next steps' }, { l: 'Sources' }],
  },
  Slides: {
    n: 'Slides', icon: 'panel', lib: 'WEB', d: 'Pitch decks, lesson decks and report decks',
    templates: [
      { n: 'Pitch deck', d: 'Win an investor or a client', preset: { for: 'Investors', purpose: 'Raise money', length: '10 slides' } },
      { n: 'Lesson deck', d: 'Teach one topic, step by step', preset: { purpose: 'Teach something', length: '10 slides' } },
      { n: 'Report deck', d: 'Results your boss can skim', preset: { for: 'A boss or client', purpose: 'Report results' } },
    ],
    purpose: [{ l: 'Raise money' }, { l: 'Win a client' }, { l: 'Teach something' }, { l: 'Report results' }, { l: 'Share a plan' }],
    length: [{ l: '5 slides' }, { l: '10 slides' }, { l: '15 slides' }, { l: '20+ slides' }],
    must: [{ l: 'The problem' }, { l: 'Your solution' }, { l: 'One big number' }, { l: 'Pricing' }, { l: 'Team' }, { l: 'The ask' }, { l: 'Contact slide' }],
  },
  Sheet: {
    n: 'Sheet', icon: 'db', lib: 'DOC', d: 'Budgets, trackers and schedules',
    templates: [
      { n: 'Budget', d: 'Money in, money out, what is left', preset: { purpose: 'Track money', must: ['Totals', 'Categories'] } },
      { n: 'Tracker sheet', d: 'Anything you count over time', preset: { purpose: 'Track progress' } },
      { n: 'Schedule', d: 'Who does what, when', preset: { purpose: 'Plan time' } },
    ],
    purpose: [{ l: 'Track money' }, { l: 'Track progress' }, { l: 'Plan time' }, { l: 'Compare options' }],
    length: [{ l: 'A few rows' }, { l: 'A month' }, { l: 'A year' }],
    must: [{ l: 'Totals' }, { l: 'Categories' }, { l: 'Dates' }, { l: 'A chart' }, { l: 'Notes column' }],
  },
  Chart: {
    n: 'Chart', icon: 'up', lib: 'WIDGET', d: 'Charts from your own tasks, training and focus',
    templates: [
      { n: 'Tasks chart', d: 'What you finished, week by week', preset: { purpose: 'See my progress' } },
      { n: 'Training chart', d: 'Sessions and streaks', preset: { purpose: 'See my progress' } },
      { n: 'Focus chart', d: 'Where your hours went', preset: { purpose: 'See where time goes' } },
    ],
    purpose: [{ l: 'See my progress' }, { l: 'See where time goes' }, { l: 'Show someone results' }],
    length: [{ l: 'This week' }, { l: 'This month' }, { l: 'This year' }],
    must: [{ l: 'Labels' }, { l: 'A goal line' }, { l: 'Totals' }, { l: 'Compare to last time' }],
  },
  PDF: {
    n: 'PDF', icon: 'doc', lib: 'PDF', d: 'Menus, rate sheets and one-pagers to print or send',
    templates: [
      { n: 'Menu', d: 'Dishes, prices, your look', preset: { for: 'Customers', purpose: 'Sell something', must: ['Prices', 'Logo'] } },
      { n: 'Rate sheet', d: 'What you charge, at a glance', preset: { for: 'Customers', purpose: 'Sell something', must: ['Prices', 'Contact details'] } },
      { n: 'One-pager', d: 'Your whole pitch on one page', preset: { purpose: 'Sell something', length: '1 page' } },
    ],
    purpose: [{ l: 'Sell something' }, { l: 'Inform people' }, { l: 'Print and hand out' }],
    length: [{ l: '1 page' }, { l: '2 pages' }, { l: 'Booklet' }],
    must: [{ l: 'Logo' }, { l: 'Prices' }, { l: 'Contact details' }, { l: 'Photos' }, { l: 'A QR code' }],
  },
  Form: {
    n: 'Form', icon: 'ed', lib: 'WEB', d: 'Intake forms, surveys and sign-ups',
    templates: [
      { n: 'Intake form', d: 'Everything you need from a new client', preset: { for: 'Customers', purpose: 'Collect details' } },
      { n: 'Survey', d: 'Ask a few questions, learn a lot', preset: { purpose: 'Get feedback' } },
      { n: 'Sign-up', d: 'Names and emails for a list or event', preset: { purpose: 'Sign people up' } },
    ],
    purpose: [{ l: 'Collect details' }, { l: 'Get feedback' }, { l: 'Sign people up' }, { l: 'Take bookings' }],
    length: [{ l: '3 questions' }, { l: '5 to 10 questions' }, { l: '10+ questions' }],
    must: [{ l: 'Name' }, { l: 'Email' }, { l: 'Phone' }, { l: 'Date picker' }, { l: 'Thank-you message' }],
  },
  Email: {
    n: 'Email', icon: 'chat', lib: 'DOC', d: 'Follow-ups, intros and updates',
    templates: [
      { n: 'Follow-up', d: 'Nudge without being pushy', preset: { purpose: 'Get a reply', length: 'Short' } },
      { n: 'Intro', d: 'Connect two people well', preset: { purpose: 'Introduce someone', length: 'Short' } },
      { n: 'Update', d: 'News for your team or clients', preset: { purpose: 'Share news' } },
    ],
    purpose: [{ l: 'Get a reply' }, { l: 'Introduce someone' }, { l: 'Share news' }, { l: 'Say thanks' }, { l: 'Ask for something' }],
    length: [{ l: 'Short' }, { l: 'Medium' }, { l: 'Long' }],
    must: [{ l: 'Subject line' }, { l: 'One clear ask' }, { l: 'A deadline' }, { l: 'Signature' }],
    noLook: true,
  },
  App: {
    n: 'App', icon: 'code', lib: 'WEB', d: 'Trackers and calculators that run',
    templates: [
      { n: 'Tracker', d: 'Log something and see the trend', preset: { purpose: 'Track something' } },
      { n: 'Calculator', d: 'Put numbers in, get answers out', preset: { purpose: 'Work something out' } },
    ],
    purpose: [{ l: 'Track something' }, { l: 'Work something out' }, { l: 'Save time on a chore' }],
    length: SIZE,
    must: [{ l: 'Saves my entries' }, { l: 'A chart' }, { l: 'Works on my phone' }, { l: 'Big buttons' }],
  },
  Game: {
    n: 'Game', icon: 'str', lib: 'GAME', d: 'Word games, trivia and puzzles',
    templates: [
      { n: 'Word game', d: 'Guess, spell, unscramble', preset: { purpose: 'Have fun' } },
      { n: 'Trivia', d: 'Questions on any topic', preset: { purpose: 'Learn while playing' } },
      { n: 'Puzzle', d: 'Logic, matching, sliding tiles', preset: { purpose: 'Have fun' } },
    ],
    purpose: [{ l: 'Have fun' }, { l: 'Learn while playing' }, { l: 'Play with friends' }],
    length: [{ l: '1 minute rounds' }, { l: '5 minute rounds' }, { l: 'Levels' }],
    must: [{ l: 'Score' }, { l: 'Timer' }, { l: 'Sound' }, { l: 'High score' }],
  },
  Webpage: {
    n: 'Webpage', icon: 'globe', lib: 'WEB', d: 'Landing pages, portfolios and invitations',
    templates: [
      { n: 'Landing page', d: 'One page that sells one thing', preset: { for: 'Customers', purpose: 'Sell something' } },
      { n: 'Portfolio', d: 'Your best work, nicely shown', preset: { purpose: 'Show my work' } },
      { n: 'Invitation', d: 'An event page with RSVP', preset: { for: 'Family and friends', purpose: 'Invite people' } },
    ],
    purpose: [{ l: 'Sell something' }, { l: 'Show my work' }, { l: 'Invite people' }, { l: 'Share info' }],
    length: [{ l: 'One screen' }, { l: 'One long page' }, { l: 'A few pages' }],
    must: [{ l: 'Photos' }, { l: 'A button to act' }, { l: 'Contact details' }, { l: 'Map' }, { l: 'RSVP' }, { l: 'Prices' }],
  },
  Widget: {
    n: 'Widget', icon: 'side', lib: 'WIDGET', d: 'Small cards for your home screen',
    templates: [
      { n: 'Dashboard card', d: 'A number you check every day', preset: { purpose: 'Glance at something' } },
      { n: 'Timer', d: 'Countdowns and focus timers', preset: { purpose: 'Time something' } },
      { n: 'Habit tracker', d: 'Tick it off, keep the streak', preset: { purpose: 'Build a habit' } },
    ],
    purpose: [{ l: 'Glance at something' }, { l: 'Time something' }, { l: 'Build a habit' }],
    length: SIZE,
    must: [{ l: 'One big number' }, { l: 'A streak' }, { l: 'A button' }],
  },
  Image: {
    n: 'Image', icon: 'img', lib: 'IMG', d: 'Illustrations, posters and logos',
    templates: [
      { n: 'Illustration', d: 'A picture of anything you describe', preset: { purpose: 'Decorate something' } },
      { n: 'Poster', d: 'An event or a message, big', preset: { purpose: 'Promote an event' } },
      { n: 'Logo', d: 'A mark for your name or business', preset: { purpose: 'Brand my business' } },
    ],
    purpose: [{ l: 'Decorate something' }, { l: 'Promote an event' }, { l: 'Brand my business' }, { l: 'A gift' }],
    length: [{ l: 'Square' }, { l: 'Tall (phone)' }, { l: 'Wide (banner)' }, { l: 'Print size' }],
    must: [{ l: 'My name' }, { l: 'A date' }, { l: 'Transparent background' }, { l: 'A few versions' }],
  },
  Graphics: {
    n: 'Graphics', icon: 'img', lib: 'IMG', d: 'Social posts, banners and icon sets',
    templates: [
      { n: 'Social post', d: 'A post that stops the scroll', preset: { purpose: 'Get attention', length: 'Square' } },
      { n: 'Banner', d: 'Website or profile header', preset: { purpose: 'Brand my business', length: 'Wide (banner)' } },
      { n: 'Icon set', d: 'Matching icons for an app or site', preset: { purpose: 'Brand my business' } },
    ],
    purpose: [{ l: 'Get attention' }, { l: 'Brand my business' }, { l: 'Announce something' }],
    length: [{ l: 'Square' }, { l: 'Tall (phone)' }, { l: 'Wide (banner)' }],
    must: [{ l: 'My logo' }, { l: 'A headline' }, { l: 'A call to action' }, { l: 'Matching set' }],
  },
  Collage: {
    n: 'Collage', icon: 'img', lib: 'IMG', d: 'Mood boards and photo grids',
    templates: [
      { n: 'Mood board', d: 'The feel of an idea in one view', preset: { purpose: 'Plan a look' } },
      { n: 'Photo grid', d: 'Your photos, laid out nicely', preset: { purpose: 'Share memories' } },
    ],
    purpose: [{ l: 'Plan a look' }, { l: 'Share memories' }, { l: 'Pitch an idea' }],
    length: [{ l: '4 pictures' }, { l: '9 pictures' }, { l: '16+ pictures' }],
    must: [{ l: 'My photos' }, { l: 'Captions' }, { l: 'A title' }],
  },
  Album: {
    n: 'Album', icon: 'img', lib: 'IMG', d: 'Photo albums and trip recaps', soon: true,
    templates: [
      { n: 'Photo album', d: 'Your photos, sorted and captioned' },
      { n: 'Trip recap', d: 'A trip told in pictures' },
    ],
    purpose: [{ l: 'Share memories' }, { l: 'Make a gift' }],
    must: [{ l: 'Captions' }, { l: 'Dates' }, { l: 'Map' }],
  },
  Video: {
    n: 'Video', icon: 'vid', lib: 'WEB', d: 'Short clips and slideshow videos', soon: true,
    templates: [
      { n: 'Short clip', d: 'A quick video for social' },
      { n: 'Slideshow video', d: 'Photos and music, made into a video' },
    ],
    purpose: [{ l: 'Get attention' }, { l: 'Share memories' }, { l: 'Explain something' }],
    length: [{ l: '15 seconds' }, { l: '30 seconds' }, { l: '60 seconds' }],
    must: [{ l: 'Music' }, { l: 'Captions' }, { l: 'My logo' }],
  },
  Ads: {
    n: 'Ads', icon: 'bel', lib: 'IMG', d: 'Social ads, flyers and promos',
    templates: [
      { n: 'Social ad', d: 'An ad for Instagram or Facebook', preset: { for: 'Customers', purpose: 'Sell something' } },
      { n: 'Flyer', d: 'Print it, post it, hand it out', preset: { for: 'Customers', purpose: 'Promote an event' } },
      { n: 'Promo', d: 'A deal, a sale, a launch', preset: { for: 'Customers', purpose: 'Sell something' } },
    ],
    purpose: [{ l: 'Sell something' }, { l: 'Promote an event' }, { l: 'Grow followers' }],
    length: [{ l: 'Square' }, { l: 'Tall (phone)' }, { l: 'Letter (print)' }],
    must: [{ l: 'A headline' }, { l: 'Price or deal' }, { l: 'A call to action' }, { l: 'My logo' }, { l: 'Contact details' }],
  },
  Script: {
    n: 'Script', icon: 'ed', lib: 'DOC', d: 'Video scripts, podcast outlines and speeches',
    templates: [
      { n: 'Video script', d: 'What to say, scene by scene', preset: { purpose: 'Explain something', length: '60 seconds' } },
      { n: 'Podcast outline', d: 'Topics, questions and timing', preset: { purpose: 'Run a show' } },
      { n: 'Speech', d: 'Words for a toast or a talk', preset: { purpose: 'Give a talk' } },
    ],
    purpose: [{ l: 'Explain something' }, { l: 'Run a show' }, { l: 'Give a talk' }, { l: 'Sell something' }],
    length: [{ l: '60 seconds' }, { l: '5 minutes' }, { l: '20+ minutes' }],
    must: [{ l: 'A strong opening' }, { l: 'A story' }, { l: 'A call to action' }, { l: 'Timing marks' }],
    noLook: true,
  },
  Agent: {
    n: 'Agent', icon: 'acc', lib: 'ROUTINE', d: 'Helpers that go off and do a job', soon: true, noLook: true,
    templates: [
      { n: 'Researcher', d: 'Finds and sums up what you ask' },
      { n: 'Inbox helper', d: 'Sorts and drafts replies' },
      { n: 'Shopper', d: 'Finds the best price for you' },
    ],
    purpose: [{ l: 'Save me time' }, { l: 'Find things for me' }, { l: 'Watch something for me' }],
    must: [{ l: 'Asks before acting' }, { l: 'Daily summary' }],
  },
  Skill: {
    n: 'Skill', icon: 'zap', lib: 'DOC', d: 'Teach Eumae a job it does your way', noLook: true,
    templates: [
      { n: 'Follow-up writer', d: 'Writes follow-ups in your voice', preset: { purpose: 'Save me time' } },
      { n: 'Site teardown', d: 'Reviews a website and says what to fix', preset: { purpose: 'Check something' } },
      { n: 'Morning researcher', d: 'Finds what matters each morning', preset: { purpose: 'Keep me informed' } },
    ],
    purpose: [{ l: 'Save me time' }, { l: 'Check something' }, { l: 'Keep me informed' }],
    must: [{ l: 'My tone' }, { l: 'Examples' }, { l: 'Steps to follow' }, { l: 'What to avoid' }],
  },
  Automation: {
    n: 'Automation', icon: 'zap', lib: 'ROUTINE', d: 'Things that run on a schedule', noLook: true,
    templates: [
      { n: 'Morning brief', d: 'Your day, ready when you wake', preset: { purpose: 'Keep me informed' } },
      { n: 'Follow-up flow', d: 'Reminds you who to get back to', preset: { purpose: 'Save me time' } },
      { n: 'Weekly review', d: 'What got done, what is next', preset: { purpose: 'Keep me on track' } },
    ],
    purpose: [{ l: 'Keep me informed' }, { l: 'Save me time' }, { l: 'Keep me on track' }],
    length: [{ l: 'Every day' }, { l: 'Every week' }, { l: 'When something happens' }],
    must: [{ l: 'Asks before acting' }, { l: 'Sends me a summary' }, { l: 'Uses my calendar' }, { l: 'Uses my tasks' }],
  },
};

export function kindOf(name: string): Kind | undefined {
  return KINDS[name];
}

export function groupOfKind(kind: string): Group | undefined {
  return GROUPS.find((g) => g.kinds.includes(kind));
}

/** The steps for a kind. Custom starts by describing it. */
export function stepsFor(kind: Kind, custom: boolean): Step[] {
  const s: Step[] = [];
  if (custom) {
    s.push({ id: 'describe', name: 'Describe it', q: `What ${kind.n.toLowerCase()} do you want?`, tip: 'Say it the way you would tell a friend. A sentence is plenty; the next steps fill in the rest.', opts: [] });
  }
  s.push({ id: 'for', name: "Who it's for", q: "Who's it for?", tip: 'Who reads or uses it changes everything: the words, the length, even the colors.', opts: FOR });
  s.push({ id: 'purpose', name: 'Purpose', q: 'What should it do?', tip: 'One clear job beats three. Pick the main one; the rest can be details.', opts: kind.purpose });
  if (!kind.noLook) {
    s.push({ id: 'style', name: 'Style', q: 'Pick a look', tip: 'Tap the one that feels closest. Eumae copies the feel, not the words.', opts: styles(kind.n) });
    s.push({ id: 'colors', name: 'Colors', q: 'Pick colors', tip: 'Two or three colors look best. Have a brand? Pick My brand colors and say them.', opts: COLORS });
  }
  if (kind.length) s.push({ id: 'length', name: 'Length', q: 'How long or how big?', tip: 'Shorter usually wins. People skim first and read only if it earns it.', opts: kind.length });
  s.push({ id: 'tone', name: 'Tone', q: 'How should it sound?', tip: 'Tone is how it feels to read. Match it to the person, not to yourself.', opts: TONE });
  s.push({ id: 'must', name: 'Must include', q: 'What must be in it?', tip: 'Tick what it cannot go without. Add names, numbers or links in Something else.', opts: kind.must, multi: true });
  return s;
}

export type Picks = Partial<Record<StepId, string | string[]>>;

/** The detailed ask Chat receives. */
export function briefOf(kind: Kind, tpl: Template | null, picks: Picks): string {
  const line = (label: string, v: string | string[] | undefined) => {
    const x = Array.isArray(v) ? v.filter(Boolean).join(', ') : (v || '').trim();
    return x ? `${label}: ${x}` : '';
  };
  const style = typeof picks.style === 'string' ? picks.style : '';
  const styleOpt = styles(kind.n).find((o) => o.l === style);
  const k = kind.n.toLowerCase();
  const what = /s$/.test(k) ? k : (/^[aeiou]/.test(k) ? 'an ' : 'a ') + k;
  const head = tpl ? `Make ${what}: ${tpl.n} (${tpl.d.toLowerCase()}).` : `Make ${what}.`;
  return [
    head,
    line('What it is', picks.describe),
    line('For', picks.for),
    line('Purpose', picks.purpose),
    line('Style', styleOpt ? `${style} - ${styleOpt.d?.toLowerCase()}` : style),
    line('Colors', picks.colors),
    line('Length', picks.length),
    line('Tone', picks.tone),
    line('Must include', picks.must),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Everything searchable from the Studio box: kinds and templates. */
export function searchStudio(q: string): { kind: string; tpl?: string }[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const out: { kind: string; tpl?: string }[] = [];
  for (const g of GROUPS) {
    for (const k of g.kinds) {
      const kd = KINDS[k];
      if ((kd.n + ' ' + kd.d + ' ' + g.n).toLowerCase().includes(t)) out.push({ kind: k });
      for (const tp of kd.templates) {
        if ((tp.n + ' ' + tp.d).toLowerCase().includes(t)) out.push({ kind: k, tpl: tp.n });
      }
    }
  }
  return out.slice(0, 8);
}

/** Best kind for free words ("a logo for my bakery" -> Image). Document when nothing matches. */
export function guessKind(text: string): string {
  const words = text.toLowerCase().split(/[^a-zà-ÿ]+/).filter((w) => w.length >= 3);
  for (const w of words) {
    const hit = searchStudio(w.replace(/s$/, ''))[0];
    if (hit) return hit.kind;
  }
  return 'Document';
}
