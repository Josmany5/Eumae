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
  /** Sent at, ms. Absent on messages that predate timestamps. */
  at?: number;
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
 * like the mockup; new ones carry a third element, sent-at in ms. */
export type GuildGroupMsg = [string, string] | [string, string, number];

export interface GuildGroup {
  n: string;
  un: number;
  last: string;
  msgs: GuildGroupMsg[];
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

function isGroupMsg(m: unknown): m is GuildGroupMsg {
  return (
    Array.isArray(m) &&
    (m.length === 2 || m.length === 3) &&
    typeof m[0] === 'string' &&
    typeof m[1] === 'string' &&
    (m.length === 2 || typeof m[2] === 'number')
  );
}

function isGuildGroup(g: unknown): g is GuildGroup {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  return (
    typeof o.n === 'string' &&
    typeof o.un === 'number' &&
    typeof o.last === 'string' &&
    Array.isArray(o.msgs) &&
    o.msgs.every(isGroupMsg)
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

/* Edit or remove work you assigned. Rows have no id, so they go by their
 * index in `assigned` — callers keep that index when they filter. */
export function renameAssigned(index: number, t: string): boolean {
  const g = load();
  const v = t.trim();
  if (!g.assigned[index] || !v) return false;
  save({ ...g, assigned: g.assigned.map((a, i) => (i === index ? { ...a, t: v.slice(0, 48) } : a)) });
  return true;
}

export function reassign(index: number, person: number): boolean {
  const g = load();
  const p = g.people[person];
  if (!g.assigned[index] || !p) return false;
  save({ ...g, assigned: g.assigned.map((a, i) => (i === index ? { ...a, who: p.n } : a)) });
  return true;
}

export function deleteAssigned(index: number): boolean {
  const g = load();
  if (!g.assigned[index]) return false;
  save({ ...g, assigned: g.assigned.filter((_, i) => i !== index) });
  return true;
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
        ? { ...x, un: 0, last: `You: ${v.slice(0, 80)}`, msgs: [...x.msgs, { who: 1 as const, text: v.slice(0, 500), at: Date.now() }] }
        : x,
    ),
  });
  void person;
  return 'Sent.';
}

/* Send a message in a group — appends ['You', text] and stamps last. */
export function sendGroupMessage(name: string, text: string): string {
  const g = load();
  const v = text.trim();
  if (!v || !g.groups.some((x) => x.n === name)) return 'Nothing there.';
  save({
    ...g,
    groups: g.groups.map((x) =>
      x.n === name
        ? { ...x, un: 0, last: `You: ${v.slice(0, 80)}`, msgs: [...x.msgs, ['You', v.slice(0, 500), Date.now()] as GuildGroupMsg] }
        : x,
    ),
  });
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
/* Marks a Marketplace item got. The Library file is added by getFromMarket
   (src/market.ts), which is what screens call. */
export function takeMarketplace(index: number): string {
  const g = load();
  const item = g.market[index];
  if (!item) return 'Nothing there.';
  save({ ...g, market: g.market.map((x, i) => (i === index ? { ...x, got: 1 as const } : x)) });
  return 'Added to your Studio.';
}

/* Delete a 1:1 thread. The person stays in your Guild. */
export function deleteThread(index: number): boolean {
  const g = load();
  if (!g.threads[index]) return false;
  save({ ...g, threads: g.threads.filter((_, i) => i !== index) });
  return true;
}

/* Leave a group — it drops off your list. */
export function leaveGroup(name: string): boolean {
  const g = getGuild();
  if (!g.groups.some((x) => x.n === name)) return false;
  save({ ...g, groups: g.groups.filter((x) => x.n !== name) });
  return true;
}

/* Remove a contact. Everything that points at people by index (threads,
 * requests, shared) drops their rows and shifts the indexes above them
 * down one, so nobody else's thread ends up pointing at the wrong person. */
export function removePerson(index: number): boolean {
  const g = getGuild();
  if (!g.people[index]) return false;
  const shift = <T extends { p: number }>(rows: T[]): T[] =>
    rows.filter((r) => r.p !== index).map((r) => (r.p > index ? { ...r, p: r.p - 1 } : r));
  save({
    ...g,
    people: g.people.filter((_, i) => i !== index),
    threads: shift(g.threads),
    reqIn: shift(g.reqIn),
    reqOut: shift(g.reqOut),
    shared: shift(g.shared),
  });
  return true;
}

/* Start a group. Members are names only for now (groups carry names, not
 * people indexes). Returns a sentence for the toast. */
export function createGroup(name: string, memberNames?: string[]): string {
  const g = getGuild();
  const n = name.trim().slice(0, 48);
  if (!n) return 'Name it first.';
  if (g.groups.some((x) => x.n.toLowerCase() === n.toLowerCase())) return 'That group already exists.';
  const members = (memberNames ?? []).map((m) => m.trim()).filter(Boolean);
  save({
    ...g,
    groups: [{ n, un: 0, last: members.length ? `With ${members.join(', ')}` : '', msgs: [] }, ...g.groups],
  });
  return 'Group created.';
}

/* Undo: the whole Guild before a delete, put back as it was. */
export function snapshotGuild(): Guild {
  return JSON.parse(JSON.stringify(load()));
}

export function restoreGuild(snap: Guild): void {
  save(JSON.parse(JSON.stringify(snap)));
}

/* Invite: a real link on the clipboard. Nothing is sent and nobody joins
   yet — the link opens Eumae with an invite param no one reads so far —
   and the toast says exactly that. Clipboard API first, the old
   select-and-copy for browsers without it, and the link itself in the
   toast when both fail. */
export async function copyInvite(notify: (m: string) => void): Promise<void> {
  const code = Math.random().toString(36).slice(2, 10);
  const link = `${window.location.origin}/?invite=${code}`;
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(link);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch {
      ok = false;
    }
  }
  notify(
    ok
      ? 'Invite link copied. Joining comes soon: for now the link just opens Eumae.'
      : `Copy this invite link: ${link}`,
  );
}
