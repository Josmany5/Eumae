/* Guild: people, threads, requests, shared, marketplace. Fields follow the
 * mockup's SEED guild block verbatim (people with initials, threads with
 * message pairs, reqIn/reqOut, act, shared, market). Example seeds are the
 * mockup's own rows, labeled until live data replaces them.
 */

export interface GuildPerson {
  n: string;
  ini: string;
}

export interface GuildMessage {
  /** 0 = them, 1 = you. A number like the mockup. */
  who: 0 | 1;
  text: string;
}

export interface GuildThread {
  /** Index into people. */
  p: number;
  last: string;
  t: string;
  /** Unread: 0/1. */
  un: 0 | 1;
  msgs: GuildMessage[];
  /** True for a labeled example seed. */
  example?: boolean;
}

export interface GuildRequestIn {
  p: number;
  what: string;
  t: string;
  st: string;
  example?: boolean;
}

export interface GuildRequestOut {
  p: number;
  what: string;
  step: number;
  example?: boolean;
}

export interface GuildAct {
  a: string;
  t: string;
  w: string;
  s: string;
  example?: boolean;
}

export interface GuildShared {
  n: string;
  k: string;
  p: number;
  example?: boolean;
}

export interface GuildMarket {
  n: string;
  k: string;
  by: string;
  got: 0 | 1;
  example?: boolean;
}

export interface Guild {
  people: GuildPerson[];
  threads: GuildThread[];
  reqIn: GuildRequestIn[];
  reqOut: GuildRequestOut[];
  act: GuildAct[];
  shared: GuildShared[];
  market: GuildMarket[];
}

const KEY = 'eumae:guild';

let cache: Guild | null = null;

function load(): Guild {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seed();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = isGuild(parsed) ? parsed : seed();
    return cache;
  } catch {
    cache = seed();
    return cache;
  }
}

/* The mockup's own guild, verbatim. */
function seed(): Guild {
  return {
    people: [
      { n: 'Marcus', ini: 'M' },
      { n: 'Ana', ini: 'A' },
      { n: 'Sam', ini: 'S' },
      { n: 'Priya', ini: 'P' },
    ],
    threads: [
      {
        p: 0,
        last: 'Got it — sending the signed copy tonight',
        t: '9:41 AM',
        un: 1,
        example: true,
        msgs: [
          { who: 0, text: 'Can you sign the contract today?' },
          { who: 1, text: 'On it. Sending the signed copy tonight' },
        ],
      },
      {
        p: 1,
        last: 'The YC draft is in our shared project',
        t: '8:20 AM',
        un: 0,
        example: true,
        msgs: [
          { who: 0, text: 'The YC draft is in our shared project' },
          { who: 1, text: 'Saw it — tightening the demo section now' },
        ],
      },
      {
        p: 2,
        last: 'That widget is exactly what I needed',
        t: 'Yesterday',
        un: 0,
        example: true,
        msgs: [
          { who: 0, text: 'That widget is exactly what I needed' },
          { who: 1, text: 'Glad it landed. More coming' },
        ],
      },
    ],
    reqIn: [
      { p: 0, what: 'the proposal from last week', t: '8:15 AM', st: 'new', example: true },
      { p: 1, what: 'your press one-pager', t: '7:52 AM', st: 'found', example: true },
      { p: 3, what: 'the budget spreadsheet', t: 'Yesterday', st: 'new', example: true },
    ],
    reqOut: [
      { p: 0, what: 'Send the signed contract', step: 2, example: true },
      { p: 1, what: 'Feedback on the demo script', step: 1, example: true },
      { p: 2, what: 'Intro to the Terravita owner', step: 3, example: true },
    ],
    act: [
      { a: 'Marcus sent the pitch deck', t: '9:12 AM', w: 'Guild', s: 'ok', example: true },
      { a: 'Ana edited the YC application', t: '8:40 AM', w: 'Studio', s: 'ok', example: true },
      { a: 'New lead from your website form', t: '8:02 AM', w: 'Gmail', s: 'in', example: true },
      { a: 'Sam added you to Content calendar', t: 'Yesterday', w: 'Guild', s: 'ok', example: true },
    ],
    shared: [
      { n: 'YC application', k: 'Project', p: 1, example: true },
      { n: 'Terravita pitch deck', k: 'Doc', p: 0, example: true },
      { n: 'Content calendar', k: 'Database', p: 2, example: true },
      { n: 'Founding principles', k: 'Doc', p: 3, example: true },
    ],
    market: [
      { n: 'Invoice tracker', k: 'Widget', by: 'sam.builds', got: 0, example: true },
      { n: 'Pitch deck template', k: 'Template', by: 'ana.creates', got: 0, example: true },
      { n: 'Follow-up flow', k: 'Flow', by: 'leo.ops', got: 0, example: true },
    ],
  };
}

function save(guild: Guild): void {
  cache = guild;
  try {
    localStorage.setItem(KEY, JSON.stringify(guild));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isGuild(g: unknown): g is Guild {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  return (
    Array.isArray(o.people) &&
    Array.isArray(o.threads) &&
    Array.isArray(o.reqIn) &&
    Array.isArray(o.reqOut) &&
    Array.isArray(o.act) &&
    Array.isArray(o.shared) &&
    Array.isArray(o.market)
  );
}

export function getGuild(): Guild {
  return load();
}

export function saveGuild(guild: Guild): void {
  save(guild);
}
