/* Goals full page: flat grouped rows, the Tasks look (10-console-goals).
 *
 * Each row: done circle, the aim with its percent and a thin meter, the
 * count and pace underneath, the project chip, and on the right the date
 * and the next milestone. Tap a goal and it opens read-only in Eumae's office
 * (the Goal tab); Edit there opens the form.
 */

import { rowTap } from '../rowTap';
import { useEffect, useState } from 'react';
import { useNav } from '../nav';
import {
  getGoals,
  createGoal,
  saveGoal,
  deleteGoal,
  snapshotGoals,
  restoreGoals,
  isActiveGoal,
  goalPct,
  goalCount,
  goalPace,
  type Goal,
} from '../goals';
import { ItemMenu } from '../components/ItemMenu';
import { undoable } from '../undo';
import { QuickAdd } from '../components/QuickAdd';
import { GoalForm } from '../components/GoalForm';
import { nextMilestone } from '../milestones';
import { fmtShort } from '../quickadd';
import { projectOf } from '../projects';
import { setFocus, onDataChange, dataChanged, openOfficeEdit } from '../focus';
import { useGoalAdd } from '../components/GoalAdd';
import type { PageProps } from './index';

type Mode = 'active' | 'project' | 'done' | 'letgo';
const MODES: { id: Mode; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'project', label: 'By project' },
  { id: 'done', label: 'Done' },
  { id: 'letgo', label: 'Archived' },
];

export function daysLeft(td: string): number {
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = td.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86400000);
}

/** "Nov 2 · 14 days", "Oct 12 · 3d late", "Today". */
export function dueLabel(g: Goal): { text: string; red: boolean } {
  if (!g.td) return { text: g.pace ? `${g.pace.n} a ${g.pace.per}` : 'No date', red: false };
  const short = new Date(g.td + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (!isActiveGoal(g)) return { text: short, red: false };
  const left = daysLeft(g.td);
  if (left < 0) return { text: `${short} · ${-left}d late`, red: true };
  if (left === 0) return { text: 'Today', red: true };
  return { text: `${short} · ${left} day${left === 1 ? '' : 's'}`, red: false };
}

interface Group {
  label: string;
  goals: Goal[];
  red?: boolean;
}

function groupGoals(all: Goal[], mode: Mode): Group[] {
  if (mode === 'done' || mode === 'letgo') {
    const st = mode === 'done' ? 'completed' : 'let-go';
    const gs = all.filter((g) => g.st === st).sort((a, b) => (b.upd ?? b.createdAt) - (a.upd ?? a.createdAt));
    return gs.length ? [{ label: mode === 'done' ? 'Done' : 'Archived', goals: gs }] : [];
  }
  const act = all.filter(isActiveGoal).sort((a, b) => (a.td || '9999').localeCompare(b.td || '9999'));
  const out: Group[] = [];
  if (mode === 'project') {
    const by = new Map<string, Goal[]>();
    const none: Goal[] = [];
    for (const g of act) {
      const p = projectOf('goal', g.id);
      if (!p) none.push(g);
      else by.set(p.n, [...(by.get(p.n) ?? []), g]);
    }
    by.forEach((goals, label) => out.push({ label, goals }));
    if (none.length) out.push({ label: 'No project', goals: none });
    return out;
  }
  const buckets: [string, (g: Goal) => boolean, boolean?][] = [
    ['Overdue', (g) => !!g.td && daysLeft(g.td) < 0, true],
    ['This month', (g) => !!g.td && daysLeft(g.td) >= 0 && daysLeft(g.td) <= 31],
    ['This quarter', (g) => !!g.td && daysLeft(g.td) > 31 && daysLeft(g.td) <= 92],
    ['Later', (g) => !!g.td && daysLeft(g.td) > 92],
    ['No date', (g) => !g.td],
  ];
  for (const [label, test, red] of buckets) {
    const goals = act.filter(test);
    if (goals.length) out.push({ label, goals, red });
  }
  return out;
}

export default function GoalsPage({ arg }: PageProps) {
  const { notify, openPanel } = useNav();
  const [mode, setMode] = useState<Mode>('active');
  const [tick, setTick] = useState(0);
  const [edit, setEdit] = useState<Goal | null>(() => (typeof arg === 'string' ? getGoals().find((g) => g.id === arg) ?? null : null));
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => onDataChange(refresh), []);
  void tick;

  const all = getGoals();
  const groups = groupGoals(all, mode);
  const active = all.filter(isActiveGoal).length;
  const done = all.filter((g) => g.st === 'completed').length;
  const remove = (id: string) =>
    undoable(notify, 'Goal deleted.', snapshotGoals, restoreGoals, () => deleteGoal(id), () => {
      refresh();
      dataChanged();
    });
  const open = (g: Goal) => {
    setFocus({ k: 'goal', id: g.id });
    openPanel('item');
  };

  return (
    <div className="qaPage">
      <QuickAdd
        kind="goal"
        placeholder="New goal"
        hint="Type it how you'd say it: “Run a half marathon by Mar 1”"
        onAdd={(q) => {
          const g = createGoal(q.title);
          saveGoal({ ...g, td: q.date ?? '' });
          refresh();
          notify(`Goal set${q.date ? ' · by ' + fmtShort(q.date) : ''}.`, {
            undo: () => {
              deleteGoal(g.id);
              refresh();
            },
          });
        }}
        /* More: make it, then edit it inline in Eumae's office (his ok, Oct 24). */
        onMore={(q) => {
          const g = createGoal(q.title.trim() || 'New goal');
          saveGoal({ ...g, td: q.date ?? '' });
          refresh();
          notify('Goal set.', { undo: () => { deleteGoal(g.id); refresh(); } });
          openOfficeEdit('goal', g.id);
          openPanel('item');
        }}
      />
      {edit ? (
        <GoalForm
          goal={edit}
          isNew={!all.some((g) => g.id === edit.id)}
          onCancel={() => setEdit(null)}
          onSave={(g) => {
            const before = all.find((x) => x.id === g.id);
            saveGoal(g);
            setEdit(null);
            refresh();
            dataChanged();
            notify(before ? 'Goal saved.' : 'Goal set.', {
              undo: () => {
                if (before) saveGoal(before);
                else deleteGoal(g.id);
                refresh();
                dataChanged();
              },
            });
          }}
          onDelete={
            all.some((g) => g.id === edit.id)
              ? () => {
                  setEdit(null);
                  remove(edit.id);
                }
              : undefined
          }
        />
      ) : null}
      <div className="tkBar">
        <div className="calSeg" role="tablist" aria-label="View">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="xs m" style={{ alignSelf: 'center' }}>
          {active} active · {done} done
        </span>
      </div>
      <div className="tkList">
        {groups.map((gr) => (
          <section key={gr.label} className="tkGroup">
            <div className={'sdiv tkH' + (gr.red ? ' att' : '')}>
              <span>{gr.label}</span>
              <span className="fmeta">{gr.goals.length}</span>
            </div>
            {gr.goals.map((g) => (
              <GoalRow key={g.id} g={g} onOpen={() => open(g)} onEdit={() => { openOfficeEdit('goal', g.id); openPanel('item'); }} onDelete={() => remove(g.id)} refresh={refresh} />
            ))}
          </section>
        ))}
        {groups.length === 0 ? (
          <p className="oIntro">
            {mode === 'done'
              ? 'No finished goals yet.'
              : mode === 'letgo'
                ? 'Nothing archived. When a goal stops fitting your life, archive it and it waits here.'
                : 'No goals yet. A goal is the long game: say it in your words, add why, and how you\'ll know you got there.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function GoalRow({ g, onOpen, onEdit, onDelete, refresh }: { g: Goal; onOpen: () => void; onEdit: () => void; onDelete: () => void; refresh: () => void }) {
  const { notify } = useNav();
  const pct = goalPct(g);
  const count = goalCount(g);
  const pace = goalPace(g);
  const next = nextMilestone(g.ms);
  const project = projectOf('goal', g.id);
  const due = dueLabel(g);
  const closed = !isActiveGoal(g);
  const setSt = (st: Goal['st'], msg: string) => {
    const before = g;
    saveGoal({ ...g, st });
    refresh();
    dataChanged();
    notify(msg, {
      undo: () => {
        saveGoal(before);
        refresh();
        dataChanged();
      },
    });
  };
  const goalAdd = useGoalAdd(g, refresh);
  const sub = [count, pace === 'behind' ? 'Behind pace' : pace === 'on' ? 'On track' : ''].filter(Boolean);
  return (
    <div className={'frow top tkRow gRow tapRow' + (closed ? ' past' : '')} onClick={rowTap(onOpen)}>
      <button
        className={'fchk' + (g.st === 'completed' ? ' on' : '')}
        aria-label={g.st === 'completed' ? `Reopen ${g.t}` : `Done: ${g.t}`}
        onClick={() => (g.st === 'completed' ? setSt('in-progress', 'Goal reopened.') : setSt('completed', 'Goal done. Nice work.'))}
      />
      <div className="ft">
        <button className="tlT" onClick={onOpen}>
          <span className={closed ? 'tlDone' : ''}>{g.t}</span>
          <span className="gPct">{pct}%</span>
        </button>
        {sub.length ? (
          <div className="fsub">
            {sub.map((s, i) => (
              <span key={s} className={s === 'Behind pace' ? 'over' : ''}>
                {i ? ' · ' : ''}
                {s}
              </span>
            ))}
          </div>
        ) : null}
        <span className="gBar">
          <i style={{ width: `${Math.min(100, pct)}%` }} />
        </span>
      </div>
      {project ? <span className="tkPill">{project.n}</span> : null}
      <span className="fmeta gSide">
        <span className={due.red ? 'over' : ''}>{due.text}</span>
        {next && !closed ? <span className="gNext">Next: {next.t}</span> : null}
      </span>
      <ItemMenu
        name={g.t}
        open={onOpen}
        edit={onEdit}
        rename={{ value: g.t, save: (v) => saveGoal({ ...g, t: v.slice(0, 120) }) }}
        extra={
          g.st === 'let-go'
            ? [{ label: 'Unarchive', onClick: () => setSt('in-progress', 'Goal unarchived.') }]
            : closed
              ? undefined
              : [...goalAdd.entries, { label: 'Archive', onClick: () => setSt('let-go', 'Goal archived.') }]
        }
        link={{ k: 'goal', id: g.id }}
        onChange={refresh}
        onDelete={onDelete}
      />
      {goalAdd.dialogs}
    </div>
  );
}
