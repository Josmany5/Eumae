/* Guild: people, threads, requests, shared, marketplace, assigned work,
 * groups. Fields follow the mockup's SEED guild block verbatim (people with
 * initials, threads with message pairs, reqIn/reqOut, act, shared, market)
 * plus the Guild dashboard's GAS9/GGRP9 seeds. Example seeds are the
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
  /** Access level — the mockup's x.perm (view/edit picker). Old rows
   * default to view. */
  perm?: 'view' | 'edit';
  example?: boolean;
}

export interface GuildMarket {
  n: string;
  k: string;
  by: string;
  got: 0 | 1;
  example?: boolean;
}

/* Assigned work — the mockup's GAS9 seed. `mine: 0` is work you assigned
 * (everyone's status); `mine: 1` is work assigned to you (your progress). */
export interface GuildAssignment {
  t: string;
  who: string;
  pct: number;
  mine: 0 | 1;
  example?: boolean;
}

/* Group chats — the mockup's GGRP9 seed. Message pairs are [who, text],
 * like the mockup. */
export interface GuildGroup {
  n: string;
  un: number;
  last: string;
  msgs: [string, string][];
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
  assigned: GuildAssignment[];
  groups: GuildGroup[];
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
    assigned: [
      { t: 'Sales onboarding', who: 'Marcus', pct: 60, mine: 0, example: true },
      { t: 'Safety basics', who: 'Ana', pct: 100, mine: 0, example: true },
      { t: 'Demo rehearsal checklist', who: 'Ana', pct: 35, mine: 0, example: true },
      { t: 'Sales onboarding', who: 'You', pct: 20, mine: 1, example: true },
    ],
    groups: [
      {
        n: 'Terravita crew',
        un: 1,
        last: 'Mockup v2 is live for review',
        example: true,
        msgs: [
          ['Marcus', 'Mockup v2 is live for review'],
          ['Ana', 'Checking on my phone now'],
        ],
      },
      {
        n: 'Family',
        un: 0,
        last: 'Sunday dinner at 5?',
        example: true,
        msgs: [
          ['Mom', 'Sunday dinner at 5?'],
          ['You', 'I will bring the bread'],
        ],
      },
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

function isGuildAssignment(a: unknown): a is GuildAssignment {
  if (!a || typeof a !== 'object') return false;
  const o = a as Record<string, unknown>;
  return (
    typeof o.t === 'string' &&
    typeof o.who === 'string' &&
    typeof o.pct === 'number' &&
    (o.mine === 0 || o.mine === 1)
  );
}

function isGuildShared(s: unknown): s is GuildShared {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.n === 'string' &&
    typeof o.k === 'string' &&
    typeof o.p === 'number' &&
    (o.perm === undefined || o.perm === 'view' || o.perm === 'edit')
  );
}

function normalizeShared(list: unknown): GuildShared[] {
  if (!Array.isArray(list)) return [];
  return list.filter(isGuildShared).map((x) => ({ ...x, perm: x.perm ?? ('view' as const) }));
}

function isGuildGroup(g: unknown): g is GuildGroup {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  return (
    typeof o.n === 'string' &&
    typeof o.un === 'number' &&
    typeof o.last === 'string' &&
    Array.isArray(o.msgs)
  );
}

function isGuild(g: unknown): g is Guild {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  if (
    !Array.isArray(o.people) ||
    !Array.isArray(o.threads) ||
    !Array.isArray(o.reqIn) ||
    !Array.isArray(o.reqOut) ||
    !Array.isArray(o.act) ||
    !Array.isArray(o.shared) ||
    !Array.isArray(o.market)
  ) {
    return false;
  }
  /* Assigned + groups arrived with the Guild dashboard: old saves predate
     them, so absent lists read as empty rather than failing the row. */
  if (o.assigned !== undefined && (!Array.isArray(o.assigned) || !o.assigned.every(isGuildAssignment))) {
    return false;
  }
  if (o.groups !== undefined && (!Array.isArray(o.groups) || !o.groups.every(isGuildGroup))) {
    return false;
  }
  return true;
}

export function getGuild(): Guild {
  const g = load();
  /* Old saves predate assigned + groups + perm — normalize to empty /
     view, never crash. */
  return {
    ...g,
    assigned: Array.isArray(g.assigned) ? g.assigned : [],
    groups: Array.isArray(g.groups) ? g.groups : [],
    shared: normalizeShared(g.shared),
  };
}

export function saveGuild(guild: Guild): void {
  save(guild);
}

/* Set a shared item's access — the mockup's perm select. */
export function setSharedPerm(index: number, perm: 'view' | 'edit'): void {
  const g = load();
  const x = g.shared[index];
  if (!x) return;
  save({ ...g, shared: g.shared.map((s, i) => (i === index ? { ...s, perm } : s)) });
}

/* Unshare — the mockup's Unshare button: removes it. */
export function unshare(index: number): string {
  const g = load();
  const x = g.shared[index];
  if (!x) return 'Nothing there.';
  save({ ...g, shared: g.shared.filter((_, i) => i !== index) });
  return 'Unshared.';
}

/* Request pipeline stages — the mockup's GSTEPS. reqOut.step indexes in. */
export const GSTEPS = ['Received', 'Their AI is preparing', 'Waiting on their approval', 'Done'];

/* Accept an incoming request: the mockup's gReq — 0 decline (removes),
 * 1 accept (→ found), 2 send (→ sent), 3 not-yet (→ new). */
export function answerRequest(index: number, action: 0 | 1 | 2 | 3): string {
  const g = load();
  const r = g.reqIn[index];
  if (!r) return 'Nothing there.';
  if (action === 0) {
    save({ ...g, reqIn: g.reqIn.filter((_, i) => i !== index) });
    return 'Request declined.';
  }
  if (action === 1) {
    save({ ...g, reqIn: g.reqIn.map((x, i) => (i === index ? { ...x, st: 'found' } : x)) });
    return 'Accepted — Eumae is finding it.';
  }
  if (action === 2) {
    save({ ...g, reqIn: g.reqIn.map((x, i) => (i === index ? { ...x, st: 'sent' } : x)) });
    return 'Sent.';
  }
  save({ ...g, reqIn: g.reqIn.map((x, i) => (i === index ? { ...x, st: 'new' } : x)) });
  return 'Kept waiting.';
}

/* Assign work to a Guild member — the mockup's gAssign sheet: their Eumae
 * prepares it, nothing moves without their yes (starts at 0%). */
export function assignWork(title: string, person: number): string {
  const g = load();
  const t = title.trim();
  const p = g.people[person];
  if (!t) return 'Name it first.';
  if (!p) return 'Pick someone.';
  save({
    ...g,
    assigned: [...(g.assigned ?? []), { t: t.slice(0, 48), who: p.n, pct: 0, mine: 0 }],
  });
  return `Assigned to ${p.n}.`;
}

/* Send a message in a thread — marks read, appends, stamps last. The
 * mockup's gSend; the canned reply arrives via Chat, not here. */
export function sendGuildMessage(index: number, text: string): string {
  const g = load();
  const t = g.threads[index];
  const v = text.trim();
  if (!t || !v) return 'Nothing there.';
  const person = g.people[t.p];
  save({
    ...g,
    threads: g.threads.map((x, i) =>
      i === index
        ? { ...x, un: 0, last: `You: ${v.slice(0, 80)}`, msgs: [...x.msgs, { who: 1 as const, text: v.slice(0, 500) }] }
        : x,
    ),
  });
  void person;
  return 'Sent.';
}

/* Open-or-create a thread with someone — the mockup's msgP9. Returns the
 * thread index. Stamp is passed in (Date is stubbed in checks). */
export function threadWith(person: number, stamp?: string): number {
  const g = load();
  const i = g.threads.findIndex((t) => t.p === person);
  if (i >= 0) return i;
  save({
    ...g,
    threads: [{ p: person, last: '', t: stamp ?? 'now', un: 0, msgs: [] }, ...g.threads],
  });
  return 0;
}

/* Take a marketplace item into your Studio: the mockup's gAdd — got flips. */
export function takeMarketplace(index: number): string {
  const g = load();
  const item = g.market[index];
  if (!item) return 'Nothing there.';
  save({ ...g, market: g.market.map((x, i) => (i === index ? { ...x, got: 1 as const } : x)) });
  return 'Added to your Studio.';
}
