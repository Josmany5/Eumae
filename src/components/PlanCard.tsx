/* Mae's plan card: what she'll make or change, waiting for the person's tap.
 *
 *  Pending: one flat row per change (kind · what · details), Approve and
 *  Cancel. Nothing has happened yet, and the card says so.
 *  Done: the receipt — what was made, each tappable to open — and Undo,
 *  which puts every store back to before the plan ran.
 *  Failed: why, and that nothing changed (a plan never lands half-done). */

import { executePlan, undoPlan, type Plan } from '../mae/dispatcher';
import type { MaeStep } from '../mae/loop';
import { dataChanged, setFocus } from '../focus';
import { logEv } from '../log';
import { useNav, type NotifyOpts } from '../nav';
import type { ItemKind } from '../mae/registry';

type Notify = (message: string, opts?: NotifyOpts) => void;

const NOUN: Record<string, [string, string]> = {
  task: ['task', 'tasks'],
  event: ['event', 'events'],
  goal: ['goal', 'goals'],
  project: ['project', 'projects'],
  note: ['note', 'notes'],
  list: ['list', 'lists'],
};
const KIND_ORDER = ['task', 'event', 'goal', 'project', 'note', 'list'];

/** "3 tasks, 2 events" from a kind → count map, in a steady order. */
export function countLine(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort((a, b) => KIND_ORDER.indexOf(a[0]) - KIND_ORDER.indexOf(b[0]))
    .map(([k, n]) => `${n} ${(NOUN[k] ?? [k, k + 's'])[n === 1 ? 0 : 1]}`)
    .join(', ');
}

/** "Created: 3 tasks, 2 events" for a plan that ran, else its receipt lines. */
export function madeLine(plan: Plan): string {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const t of plan.touched ?? []) {
    if (!KIND_ORDER.includes(t.kind) || seen.has(t.kind + t.id)) continue;
    seen.add(t.kind + t.id);
    counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
  }
  const created = (plan.receipt ?? []).every((r) => /^Created/.test(r.summary));
  return counts.size ? `${created ? 'Created' : 'Done'}: ${countLine(counts)}` : (plan.receipt ?? []).map((r) => r.summary).join(' · ') || 'Done';
}

/** What Mae did this turn, folded into one quiet line (his call, Oct 19):
 *  reads once each, then one "Planned 3 tasks, 2 events" instead of a row per
 *  call. A step that failed still gets its own row, because that one matters. */
export function MaeSteps({ steps, plan }: { steps?: MaeStep[]; plan?: Plan }) {
  if (!steps || !steps.length) return null;
  const reads = [...new Set(steps.filter((s) => s.ok && !s.label.startsWith('Planned') && !s.label.startsWith('Took ')).map((s) => s.label))];
  const bad = steps.filter((s) => !s.ok);
  const parts = [...reads];
  if (plan && plan.status === 'pending' && plan.steps.length) {
    const c = new Map<string, number>();
    for (const st of plan.steps) for (const l of st.lines) {
      const k = l.kind.toLowerCase();
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    parts.push('Planned ' + countLine(c));
  }
  if (!parts.length && !bad.length) return null;
  return (
    <div className="maeSteps">
      {parts.length ? <div className="maeStep">{parts.join(' · ')}</div> : null}
      {bad.map((s, i) => (
        <div key={i} className="maeStep bad">
          {s.label}
        </div>
      ))}
    </div>
  );
}

export function PlanCard({ plan, onChange, notify, area = 'Chat' }: { plan: Plan; onChange: (p: Plan) => void; notify: Notify; area?: 'Chat' | 'Console' | 'Studio' | 'Library' | 'Classroom' | 'Guild' }) {
  const { go, goTab } = useNav();
  const lines = plan.steps.flatMap((s) => s.lines.map((l) => ({ ...l, danger: s.danger, fresh: !!s.fresh })));
  /* Mark what the latest message added, once older lines sit beside it. */
  const mixed = lines.some((l) => l.fresh) && lines.some((l) => !l.fresh);
  const count = lines.length;

  const undo = (p: Plan) => {
    const back = undoPlan(p);
    if (back === p) return;
    onChange(back);
    dataChanged();
    logEv({ area, text: 'Undid Mae\'s plan' });
  };

  const approve = () => {
    const ran = executePlan(plan);
    onChange(ran);
    dataChanged();
    if (ran.status === 'done') {
      const msg = madeLine(ran);
      logEv({ area, text: `Mae: ${msg}` });
      notify(`${msg}.`, { undo: () => undo(ran) });
    } else {
      logEv({ area, text: `Mae's plan failed: ${ran.error}`, status: 'bad' });
      notify('That plan didn\'t go through. Nothing changed.');
    }
  };

  if (plan.status === 'pending') {
    return (
      <div className="needs maePlan">
        <div className="flbl">Plan · {count} {count === 1 ? 'change' : 'changes'}</div>
        {lines.map((l, i) => (
          <div key={i} className="maeLine">
            <span className={`maeKind${l.verb === 'Delete' || l.verb === 'Skip' ? ' danger' : ''}`}>
              {l.verb} {l.kind.toLowerCase()}
            </span>
            <span className="maeTxt">
              {l.text}
              {l.detail ? <span className="fp">{l.detail}</span> : null}
              {l.guess ? <span className="fp maeGuess">Mae's guess: {l.guess}</span> : null}
              {mixed && l.fresh ? <span className="fp maeNew">New</span> : null}
            </span>
          </div>
        ))}
        <div className="btns">
          <button className="pri" onClick={approve}>
            Approve
          </button>
          <button
            onClick={() => {
              onChange({ ...plan, status: 'cancelled' });
              logEv({ area, text: 'Cancelled Mae\'s plan' });
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (plan.status === 'done') {
    /* What she made, as one line and a way to go see it (his call, Oct 19).
       Undo lives in the pop-up only, so the chat doesn't keep a stale button. */
    const made = (plan.touched ?? []).filter((t) => KIND_ORDER.includes(t.kind));
    const byKind = new Map<ItemKind, typeof made>();
    for (const t of made) byKind.set(t.kind, [...(byKind.get(t.kind) ?? []).filter((x) => x.id !== t.id), t]);
    const line = madeLine(plan);
    const page: Record<string, string> = { task: 'tasks', event: 'cal', goal: 'goals', project: 'projects', note: 'notes' };
    /* View takes you to the real page in Console (his call, Oct 19), not a
       copy inside Chat. One item: its own page for a project or note; for a
       task, event or goal, its Console page, and on desktop its office tab
       opens beside it. */
    const view = (k: ItemKind, items: typeof made) => {
      goTab('console');
      const one = items.length === 1 ? items[0] : undefined;
      if (one && k === 'project') return go('project', one.id);
      if (one && k === 'note') return go('note', one.id);
      go(page[k]);
      const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 900px)').matches;
      if (one && wide) setFocus({ k: k as 'task' | 'event' | 'goal', id: one.id });
    };
    const groups = [...byKind.entries()].filter(([k]) => page[k]).sort((a, b) => KIND_ORDER.indexOf(a[0]) - KIND_ORDER.indexOf(b[0]));
    return (
      <div className="rcpt maePlan">
        <div className="maeDone">{line}</div>
        {groups.length ? (
          <div className="maeOpen">
            {groups.map(([k, items]) => (
              <button key={k} className="chip" onClick={() => view(k, items)}>
                {groups.length === 1 && items.length === 1 ? `View ${items[0].title}` : groups.length === 1 ? `View ${NOUN[k][1]}` : `View ${countLine(new Map([[k as string, items.length]]))}`}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  /* Cancelled or undone: nothing to show in the chat; the Logbook keeps the trace. */
  if (plan.status === 'cancelled' || plan.status === 'undone') return null;

  return (
    <div className="rcpt maePlan">
      <div className={plan.status === 'failed' ? 'danger' : 'fsub'}>
        {plan.status === 'failed' ? plan.error : 'Working…'}
      </div>
    </div>
  );
}
