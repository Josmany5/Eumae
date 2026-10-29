/* The dispatcher: the one door every Eumae action goes through.
 *
 *  The model fills out tool forms. This module:
 *    1. refuses a tool that isn't in the registry,
 *    2. checks the form all the way down (schema.ts) and the rules a form
 *       can't say (the action's own verify: ids exist, events have times),
 *    3. runs READS at once and hands the result back to Eumae,
 *    4. never runs a WRITE when the model asks: it stages it as a step on a
 *       plan, which the person sees as a card and approves or cancels,
 *    5. runs an approved plan as ONE unit: every store is snapshotted first,
 *       steps run in order, and if any step fails everything is put back —
 *       a plan never lands half-done. One Undo reverses the whole plan.
 *
 *  Every outcome is an honest sentence: what ran, what was refused and why.
 *  Nothing here throws to the caller. */

import { check, toGemini } from './schema';
import { resolveWhen } from './when';
import { guessesIn } from './guess';
import { REGISTRY, getAction, type Action, type PlanLine, type Result, type Opened, type ItemKind } from './registry';
import { snapshotTasks, restoreTasks } from '../tasks';
import { snapshotEvents, restoreEvents } from '../events';
import { snapshotGoals, restoreGoals } from '../goals';
import { snapshotProjects, restoreProjects } from '../projects';
import { snapshotNotes, restoreNotes } from '../notes';
import { snapshotLibrary, restoreLibrary } from '../library';

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface PlanStep {
  name: string;
  args: Record<string, unknown>;
  lines: PlanLine[];
  danger: boolean;
  /** Added in the latest turn (the card marks these "new" when older lines sit beside them). */
  fresh?: boolean;
}

export type PlanStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'undone';

export interface Plan {
  id: string;
  steps: PlanStep[];
  status: PlanStatus;
  /** After it ran: one sentence per step, and what can be opened. */
  receipt?: { summary: string; ok: boolean }[];
  touched?: { kind: ItemKind; id: string; title: string }[];
  error?: string;
  ranAt?: number;
}

/** What one call came back as, for Eumae (functionResponse) and the steps row. */
export interface CallOutcome {
  name: string;
  ok: boolean;
  /** For Eumae. */
  response: Record<string, unknown>;
  /** For the person, one short line. */
  label: string;
  open?: Opened;
}

/* ───────────── declarations sent to the model ───────────── */

/** Not in the registry: it edits the open card itself, so it lives here. */
export const DROP_LINES = 'drop_plan_lines';
const DROP_DECL = {
  name: DROP_LINES,
  description:
    'Take lines off the plan card that is still waiting for approval, by their numbers in the card list. Use it when the person says to remove something, or to change a line: drop it, then stage the corrected version.',
  parameters: { type: 'OBJECT', properties: { lines: { type: 'ARRAY', description: 'Card line numbers, starting at 1.', items: { type: 'INTEGER' } } }, required: ['lines'] },
};

export function declarations(actions: readonly Action[] = REGISTRY): Record<string, unknown>[] {
  return [
    ...actions.map((a) => ({
      name: a.name,
      description: a.risk === 'read' ? a.description : `${a.description} (Goes on the plan card; runs only after the person approves.)`,
      parameters: toGemini(a.params),
    })),
    ...(actions === REGISTRY ? [DROP_DECL] : []),
  ];
}

/** The card list as numbered lines, with where each sits in its step. */
function cardLines(plan: Plan): { step: number; line: number; text: string }[] {
  const out: { step: number; line: number; text: string }[] = [];
  plan.steps.forEach((st, si) => st.lines.forEach((l, li) => out.push({ step: si, line: li, text: `${l.verb} ${l.kind.toLowerCase()}: ${l.text}${l.detail ? ` (${l.detail})` : ''}` })));
  return out;
}

/** Drop card lines. A step that makes several items from one list (three tasks
 *  in one create_tasks) loses just that item; a one-line step goes whole. */
function dropLines(plan: Plan, nums: number[]): string | null {
  const all = cardLines(plan);
  const want = [...new Set(nums)].filter((n) => Number.isInteger(n));
  if (!want.length) return 'Give the card line numbers to drop.';
  const bad = want.filter((n) => n < 1 || n > all.length);
  if (bad.length) return `The card has ${all.length} lines; there is no line ${bad.join(', ')}.`;
  const hit = want.map((n) => all[n - 1]);
  const bySteps = new Map<number, number[]>();
  for (const h of hit) bySteps.set(h.step, [...(bySteps.get(h.step) ?? []), h.line]);
  const next: PlanStep[] = [];
  for (let si = 0; si < plan.steps.length; si++) {
    const st = plan.steps[si];
    const gone = bySteps.get(si);
    if (!gone) {
      next.push(st);
      continue;
    }
    if (gone.length >= st.lines.length) continue;
    const arrKey = Object.keys(st.args).find((k) => Array.isArray(st.args[k]) && (st.args[k] as unknown[]).length === st.lines.length);
    if (!arrKey) return `Line ${want.find((n) => all[n - 1].step === si)} is part of a change that can only be dropped whole. Drop all its lines, then stage what should stay.`;
    const keep = (_: unknown, i: number) => !gone.includes(i);
    next.push({ ...st, args: { ...st.args, [arrKey]: (st.args[arrKey] as unknown[]).filter(keep) }, lines: st.lines.filter(keep) });
  }
  plan.steps = next;
  return null;
}

/** Carry a card that is still waiting into the next turn: same id, older lines
 *  no longer "new". */
export function continuePlan(open: Plan): Plan {
  const copy: Plan = JSON.parse(JSON.stringify(open));
  copy.steps = copy.steps.map((st) => ({ ...st, fresh: false }));
  return copy;
}

/** The person decided the old card while Eumae was answering: keep only what
 *  this turn added, as a card of its own. */
export function detachFresh(plan: Plan): Plan | null {
  const steps = plan.steps.filter((st) => st.fresh);
  return steps.length ? { ...newPlan(), steps } : null;
}

/* ───────────── one model turn's calls ───────────── */

/** Sort one turn's calls: reads run now, writes join the plan being built.
 *  `plan` is mutated (steps appended) so a turn that loops several times
 *  builds one plan, not several. */
/** `heard` is everything the person typed in this thread, for the guess detector. */
export function dispatch(calls: readonly ToolCall[], plan: Plan, heard = ''): CallOutcome[] {
  const out: CallOutcome[] = [];
  for (const call of calls) {
    const name = typeof call?.name === 'string' ? call.name : String(call?.name);
    let args = call?.args && typeof call.args === 'object' && !Array.isArray(call.args) ? call.args : {};
    if (name === DROP_LINES) {
      if (plan.status !== 'pending' || !plan.steps.length) {
        out.push(refuse(name, 'There is no card waiting for approval to change.'));
        continue;
      }
      const nums = Array.isArray(args.lines) ? (args.lines as unknown[]).map(Number) : [];
      const err = dropLines(plan, nums);
      if (err) {
        out.push(refuse(name, err));
        continue;
      }
      out.push({
        name,
        ok: true,
        response: { ok: true, card_now: cardLines(plan).map((l, i) => `${i + 1}. ${l.text}`), note: plan.steps.length ? 'Dropped. The card shows what is left.' : 'The card is empty now.' },
        label: `Took ${plural(nums.length, 'line')} off the plan`,
      });
      continue;
    }
    const action = getAction(name);
    if (!action) {
      out.push(refuse(name, `There is no tool called "${name}". Use only the tools you were given.`));
      continue;
    }
    /* Dates and times in the person's words become real values here, by
       code (when.ts); Eumae never does calendar maths. */
    const when = resolveWhen(action.params, args);
    if (when.error) {
      out.push(refuse(name, `Nothing was done. ${when.error} Then call again with what they say.`));
      continue;
    }
    const raw = args;
    args = when.value as typeof args;
    const formErr = check(action.params, args);
    if (formErr) {
      out.push(refuse(name, `The ${name} call was malformed: ${formErr} Nothing was done; fix it and call again.`));
      continue;
    }
    const refs = new Set(plan.steps.flatMap((st) => getAction(st.name)?.declares?.(st.args) ?? []));
    let ruleErr: string | null = null;
    try {
      ruleErr = action.verify?.(args, { refs }) ?? null;
    } catch (e) {
      ruleErr = `Could not check the ${name} call (${(e as Error)?.message ?? 'unknown error'}).`;
    }
    if (ruleErr) {
      out.push(refuse(name, `${ruleErr} Nothing was done.`));
      continue;
    }

    if (action.risk === 'read') {
      let r: Result;
      try {
        r = action.run(args, { refs: new Map() });
      } catch (e) {
        r = { ok: false, summary: `${name} failed`, error: (e as Error)?.message ?? 'unknown error' };
      }
      out.push({
        name,
        ok: r.ok,
        response: r.ok ? { ok: true, summary: r.summary, ...(r.data !== undefined ? { data: r.data } : {}) } : { ok: false, error: r.error ?? r.summary },
        label: r.summary,
        ...(r.open ? { open: r.open } : {}),
      });
      continue;
    }

    /* A write: staged, never run here. */
    if (plan.status !== 'pending') {
      out.push(refuse(name, 'The plan is already decided. Propose a new one in a new message.'));
      continue;
    }
    let lines: PlanLine[] = [];
    try {
      lines = action.preview?.(args) ?? [];
    } catch {
      lines = [];
    }
    plan.steps.push({ name, args, lines, danger: action.risk === 'danger', fresh: true });
    const added = guessesIn(name, args, raw, heard);
    out.push({
      name,
      ok: true,
      response: {
        ok: true,
        staged: true,
        step: plan.steps.length,
        will_do: lines.map((l) => `${l.verb} ${l.kind.toLowerCase()}: ${l.text}${l.detail ? ` (${l.detail})` : ''}`),
        card_now: cardLines(plan).map((l, i) => `${i + 1}. ${l.text}`),
        ...(added.length
          ? {
              you_added: added,
              must_say: 'The person did not say the details in you_added; you filled them in. In your reply, name each one and why in a few plain words ("I guessed about an hour, since a first draft usually takes that"), so they can change it before approving. Do not skip this.',
            }
          : {}),
        note: 'Not done yet. It is on the plan card with everything else listed in card_now. Tell the person briefly what you added and ask them to approve when ready. Do not say it is done. Any day or time in will_do was worked out by the app from their words: repeat it as written there.',
      },
      label: `Planned: ${lines.length === 1 ? `${lines[0].verb.toLowerCase()} ${lines[0].kind.toLowerCase()}` : `${lines.length} changes`}`,
    });
  }
  return out;
}

function refuse(name: string, error: string): CallOutcome {
  return { name, ok: false, response: { ok: false, error }, label: `Couldn't use ${name.replace(/_/g, ' ')}` };
}

/* ───────────── running an approved plan ───────────── */

interface AllSnap {
  t: ReturnType<typeof snapshotTasks>;
  e: ReturnType<typeof snapshotEvents>;
  g: ReturnType<typeof snapshotGoals>;
  p: ReturnType<typeof snapshotProjects>;
  n: ReturnType<typeof snapshotNotes>;
  l: ReturnType<typeof snapshotLibrary>;
}

function snapshotAll(): AllSnap {
  return { t: snapshotTasks(), e: snapshotEvents(), g: snapshotGoals(), p: snapshotProjects(), n: snapshotNotes(), l: snapshotLibrary() };
}

function restoreAll(s: AllSnap): void {
  restoreTasks(s.t);
  restoreEvents(s.e);
  restoreGoals(s.g);
  restoreProjects(s.p);
  restoreNotes(s.n);
  restoreLibrary(s.l);
}

/** Undo snapshots live here, by plan id, for this session. A plan's Undo
 *  after a reload is not offered (the card says Done, without Undo). */
const undoSnaps = new Map<string, AllSnap>();

export function canUndo(planId: string): boolean {
  return undoSnaps.has(planId);
}

/** Run every step, in order, as one unit. Each step is checked again right
 *  before it runs (the data may have changed since the card was drawn). On
 *  the first failure, every store goes back to how it was and the plan is
 *  marked failed with the reason. */
export function executePlan(plan: Plan): Plan {
  if (plan.status !== 'pending') return plan;
  if (!plan.steps.length) return { ...plan, status: 'done', receipt: [], touched: [], ranAt: Date.now() };
  const snap = snapshotAll();
  const refs = new Map<string, string>();
  const receipt: { summary: string; ok: boolean }[] = [];
  const touched: NonNullable<Plan['touched']> = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const st = plan.steps[i];
    const action = getAction(st.name);
    let fail: string | null = null;
    if (!action) fail = `Unknown step "${st.name}".`;
    else {
      fail = check(action.params, st.args);
      if (!fail) {
        try {
          /* Refs made so far count as known; the declared ones already exist. */
          fail = action.verify?.(st.args, { refs: new Set(refs.keys()) }) ?? null;
        } catch (e) {
          fail = (e as Error)?.message ?? 'check failed';
        }
      }
      if (!fail) {
        try {
          const r = action.run(st.args, { refs });
          if (!r.ok) fail = r.error ?? r.summary;
          else {
            receipt.push({ summary: r.summary, ok: true });
            if (r.touched) touched.push(...r.touched);
          }
        } catch (e) {
          fail = (e as Error)?.message ?? 'unknown error';
        }
      }
    }
    if (fail) {
      restoreAll(snap);
      return { ...plan, status: 'failed', error: `Step ${i + 1} failed: ${fail} Nothing was changed.`, receipt: [], touched: [], ranAt: Date.now() };
    }
  }
  undoSnaps.set(plan.id, snap);
  return { ...plan, status: 'done', receipt, touched, ranAt: Date.now() };
}

/** Put everything back to before the plan ran. */
export function undoPlan(plan: Plan): Plan {
  const snap = undoSnaps.get(plan.id);
  if (!snap || plan.status !== 'done') return plan;
  restoreAll(snap);
  undoSnaps.delete(plan.id);
  return { ...plan, status: 'undone' };
}

export function newPlan(): Plan {
  return { id: `plan${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, steps: [], status: 'pending' };
}

/** How a finished plan is told back to Eumae on the next turn, so she knows
 *  what exists now without guessing. */
export function planNote(plan: Plan): string {
  if (plan.status === 'done') return `[Plan approved and done: ${(plan.receipt ?? []).map((r) => r.summary).join('; ')}. Ids: ${(plan.touched ?? []).map((t) => `${t.kind} ${t.id} "${t.title}"`).join(', ')}]`;
  if (plan.status === 'failed') return `[Plan failed, nothing changed: ${plan.error}]`;
  if (plan.status === 'cancelled') return '[The person cancelled that plan. Nothing was changed.]';
  if (plan.status === 'undone') return '[The person approved that plan, then undid it. Nothing from it remains.]';
  const ls = cardLines(plan);
  return `[Plan card STILL WAITING for approval, nothing made yet. It holds: ${ls.map((l, i) => `${i + 1}. ${l.text}`).join('; ')}. Anything new you stage is ADDED to this same card; never stage these lines again. To change or remove a line, use drop_plan_lines (then stage the corrected one).]`;
}

function plural(n: number, w: string): string {
  return `${n} ${w}${n === 1 ? '' : 's'}`;
}
