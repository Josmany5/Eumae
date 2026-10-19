/* The dispatcher: the one door every Mae action goes through.
 *
 *  The model fills out tool forms. This module:
 *    1. refuses a tool that isn't in the registry,
 *    2. checks the form all the way down (schema.ts) and the rules a form
 *       can't say (the action's own verify: ids exist, events have times),
 *    3. runs READS at once and hands the result back to Mae,
 *    4. never runs a WRITE when the model asks: it stages it as a step on a
 *       plan, which the person sees as a card and approves or cancels,
 *    5. runs an approved plan as ONE unit: every store is snapshotted first,
 *       steps run in order, and if any step fails everything is put back —
 *       a plan never lands half-done. One Undo reverses the whole plan.
 *
 *  Every outcome is an honest sentence: what ran, what was refused and why.
 *  Nothing here throws to the caller. */

import { check, toGemini } from './schema';
import { REGISTRY, getAction, type Action, type PlanLine, type Result, type Opened, type ItemKind } from './registry';
import { snapshotTasks, restoreTasks } from '../tasks';
import { snapshotEvents, restoreEvents } from '../events';
import { snapshotGoals, restoreGoals } from '../goals';
import { snapshotProjects, restoreProjects } from '../projects';
import { snapshotNotes, restoreNotes } from '../notes';

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface PlanStep {
  name: string;
  args: Record<string, unknown>;
  lines: PlanLine[];
  danger: boolean;
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

/** What one call came back as, for Mae (functionResponse) and the steps row. */
export interface CallOutcome {
  name: string;
  ok: boolean;
  /** For Mae. */
  response: Record<string, unknown>;
  /** For the person, one short line. */
  label: string;
  open?: Opened;
}

/* ───────────── declarations sent to the model ───────────── */

export function declarations(actions: readonly Action[] = REGISTRY): Record<string, unknown>[] {
  return actions.map((a) => ({
    name: a.name,
    description: a.risk === 'read' ? a.description : `${a.description} (Goes on the plan card; runs only after the person approves.)`,
    parameters: toGemini(a.params),
  }));
}

/* ───────────── one model turn's calls ───────────── */

/** Sort one turn's calls: reads run now, writes join the plan being built.
 *  `plan` is mutated (steps appended) so a turn that loops several times
 *  builds one plan, not several. */
export function dispatch(calls: readonly ToolCall[], plan: Plan): CallOutcome[] {
  const out: CallOutcome[] = [];
  for (const call of calls) {
    const name = typeof call?.name === 'string' ? call.name : String(call?.name);
    const args = call?.args && typeof call.args === 'object' && !Array.isArray(call.args) ? call.args : {};
    const action = getAction(name);
    if (!action) {
      out.push(refuse(name, `There is no tool called "${name}". Use only the tools you were given.`));
      continue;
    }
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
    plan.steps.push({ name, args, lines, danger: action.risk === 'danger' });
    out.push({
      name,
      ok: true,
      response: {
        ok: true,
        staged: true,
        step: plan.steps.length,
        will_do: lines.map((l) => `${l.verb} ${l.kind.toLowerCase()}: ${l.text}${l.detail ? ` (${l.detail})` : ''}`),
        note: 'Not done yet. It is on the plan card. Tell the person the plan in a short list and ask them to approve. Do not say it is done.',
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
}

function snapshotAll(): AllSnap {
  return { t: snapshotTasks(), e: snapshotEvents(), g: snapshotGoals(), p: snapshotProjects(), n: snapshotNotes() };
}

function restoreAll(s: AllSnap): void {
  restoreTasks(s.t);
  restoreEvents(s.e);
  restoreGoals(s.g);
  restoreProjects(s.p);
  restoreNotes(s.n);
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

/** How a finished plan is told back to Mae on the next turn, so she knows
 *  what exists now without guessing. */
export function planNote(plan: Plan): string {
  if (plan.status === 'done') return `[Plan approved and done: ${(plan.receipt ?? []).map((r) => r.summary).join('; ')}. Ids: ${(plan.touched ?? []).map((t) => `${t.kind} ${t.id} "${t.title}"`).join(', ')}]`;
  if (plan.status === 'failed') return `[Plan failed, nothing changed: ${plan.error}]`;
  if (plan.status === 'cancelled') return '[The person cancelled that plan. Nothing was changed.]';
  if (plan.status === 'undone') return '[The person approved that plan, then undid it. Nothing from it remains.]';
  return '[Plan waiting for approval.]';
}
