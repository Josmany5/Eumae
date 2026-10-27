/* Flows page: Habits · Routines · Flows (his definitions, Oct 21). The person
 * runs all of these; Eumae keeps the list, today's checks and the streak.
 *
 * Flat rows like Tasks and Goals (no boxes, no lines). A habit row has its
 * own check for today; a routine or flow row shows today's steps x/y with a
 * thin meter. Tap a row and it opens in Eumae's office as its own tab, where
 * it's edited inline and started step by step. The round + adds one of the
 * tab's kind. Starters below the list add a ready-made one with one tap.
 */

import { rowTap } from '../rowTap';
import { useEffect, useState } from 'react';
import {
  getFlows,
  getFlow,
  saveFlow,
  createFlow,
  deleteFlow,
  snapshotFlows,
  restoreFlows,
  toggleFlowToday,
  doneToday,
  isDoneToday,
  isScheduledOn,
  scheduleLabel,
  streakLabel,
  addStarter,
  STARTERS,
  type Flow,
  type FlowKind,
} from '../flows';
import { useNav } from '../nav';
import { ItemMenu } from '../components/ItemMenu';
import { QuickAdd } from '../components/QuickAdd';
import { undoable } from '../undo';
import { setFocus, onDataChange, dataChanged, openOfficeEdit, markFresh } from '../focus';
import type { Quick } from '../quickadd';
import type { PageProps } from './index';

const TABS: { id: FlowKind; label: string }[] = [
  { id: 'habit', label: 'Habits' },
  { id: 'routine', label: 'Routines' },
  { id: 'flow', label: 'Flows' },
];

const INTRO: Record<FlowKind, string> = {
  habit: 'One thing you repeat. Check it off on the days you set and keep your streak going.',
  routine: 'Steps you want done in order, on a schedule: a morning, a closing shift. Check them off as you go.',
  flow: 'Ways you work: a brain dump, a weekly review, deep work. Start one when you need it and walk its steps.',
};

const NEW: Record<FlowKind, string> = { habit: 'New habit', routine: 'New routine', flow: 'New flow' };
const HINT: Record<FlowKind, string> = {
  habit: 'Type it how you\'d say it: “Read 10 pages daily 9pm”',
  routine: 'Type it how you\'d say it: “Closing shift weekdays 10pm”',
  flow: 'Name the way you work: “Inbox zero” or “Plan the week fri 4pm”',
};

const TAB_KEY = 'eumae:flowsTab';

function readTab(): FlowKind {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === 'habit' || v === 'routine' || v === 'flow') return v;
  } catch {
    /* storage blocked */
  }
  return 'habit';
}

/** The typed line → schedule. "daily" / "weekdays" / "mon wed" / "9pm". */
function fromQuick(q: Quick, kind: FlowKind): Partial<Flow> {
  const out: Partial<Flow> = {};
  if (q.rep?.f === 'daily') out.days = [0, 1, 2, 3, 4, 5, 6];
  else if (q.rep?.f === 'weekly' && q.rep.days?.length) out.days = [...q.rep.days];
  if (q.time) out.tm = q.time;
  if (!out.days) out.days = kind === 'flow' ? [] : [0, 1, 2, 3, 4, 5, 6];
  return out;
}

export default function FlowsPage({ arg }: PageProps) {
  const { notify, openPanel } = useNav();
  const [tab, setTabState] = useState<FlowKind>(() => {
    /* Old links (flow / flowedit with an id) land on that one's tab. */
    const f = typeof arg === 'string' && arg ? getFlow(arg) : undefined;
    return f ? f.kind : readTab();
  });
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => onDataChange(refresh), []);
  const setTab = (k: FlowKind) => {
    setTabState(k);
    try {
      localStorage.setItem(TAB_KEY, k);
    } catch {
      /* storage blocked */
    }
  };

  const open = (f: Flow) => {
    setFocus({ k: 'flow', id: f.id });
    openPanel('item');
  };
  const edit = (f: Flow) => {
    openOfficeEdit('flow', f.id);
    openPanel('item');
  };

  /* An old 'flow' / 'flowedit' link: open that one in the office. */
  useEffect(() => {
    const f = typeof arg === 'string' && arg ? getFlow(arg) : undefined;
    if (f) open(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arg]);

  const all = getFlows();
  const rows = all.filter((f) => f.kind === tab);
  const now = new Date();
  const today = rows.filter((f) => isScheduledOn(f, now) && (f.kind !== 'flow' || f.days.length));
  const other = rows.filter((f) => !today.includes(f));
  const have = new Set(all.map((f) => f.n.trim().toLowerCase()));
  const starters = STARTERS.filter((s) => s.kind === tab && !have.has(s.n.toLowerCase()));

  const remove = (f: Flow) =>
    undoable(notify, `Deleted ${f.n}.`, snapshotFlows, restoreFlows, () => deleteFlow(f.id), () => {
      refresh();
      dataChanged();
    });

  const groups: { label: string; flows: Flow[] }[] =
    tab === 'flow'
      ? [
          { label: 'Today', flows: today },
          { label: 'Other days', flows: other.filter((f) => f.days.length) },
          { label: 'On demand', flows: other.filter((f) => !f.days.length) },
        ]
      : [
          { label: 'Today', flows: today },
          { label: 'Other days', flows: other },
        ];

  return (
    <div className="qaPage">
      <QuickAdd
        key={tab}
        kind="flow"
        placeholder={NEW[tab]}
        hint={HINT[tab]}
        onAdd={(q) => {
          const f = createFlow(q.title.trim().slice(0, 60), tab, fromQuick(q, tab));
          refresh();
          dataChanged();
          notify(`Added ${f.n} · ${scheduleLabel(f)}.`, {
            undo: () => {
              deleteFlow(f.id);
              refresh();
              dataChanged();
            },
          });
        }}
        /* More: make it, then edit it inline in Eumae's office. Only Done keeps it. */
        onMore={(q) => {
          const f = createFlow(q.title.trim().slice(0, 60) || NEW[tab], tab, fromQuick(q, tab));
          refresh();
          markFresh('flow', f.id, () => {
            deleteFlow(f.id);
            refresh();
          });
          edit(f);
        }}
      />
      <div className="tkBar">
        <div className="calSeg" role="tablist" aria-label="Kind">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="oIntro">{INTRO[tab]}</p>
      <div className="tkList">
        {groups
          .filter((g) => g.flows.length)
          .map((g) => (
            <section key={g.label} className="tkGroup">
              <div className="sdiv tkH">
                <span>{g.label}</span>
                <span className="fmeta">{g.flows.length}</span>
              </div>
              {g.flows.map((f) => (
                <FlowRow
                  key={f.id}
                  f={f}
                  onOpen={() => open(f)}
                  onEdit={() => edit(f)}
                  onDelete={() => remove(f)}
                  refresh={refresh}
                />
              ))}
            </section>
          ))}
        {rows.length === 0 ? (
          <p className="oIntro">
            {tab === 'habit'
              ? 'No habits yet. Tap + to add one, or start from one below.'
              : tab === 'routine'
                ? 'No routines yet. Tap + to add one, or start from one below.'
                : 'No flows yet. Tap + to add the way you work, or start from one below.'}
          </p>
        ) : null}
        {starters.length ? (
          <section className="tkGroup">
            <div className="sdiv tkH">
              <span>Starters</span>
            </div>
            {starters.map((s) => (
              <div key={s.key} className="frow tkRow flStarter">
                <div className="ft">
                  <span className="tlT">{s.n}</span>
                  <div className="fsub">
                    {s.steps.length ? `${s.steps.length} steps · ` : ''}
                    {scheduleLabel(s)}
                  </div>
                  {s.u ? <div className="fsub flWhy">{s.u}</div> : null}
                </div>
                <button
                  className="fb"
                  aria-label={`Add ${s.n}`}
                  onClick={() => {
                    const f = addStarter(s);
                    refresh();
                    dataChanged();
                    notify(`Added ${f.n}. It's yours to change.`, {
                      undo: () => {
                        deleteFlow(f.id);
                        refresh();
                        dataChanged();
                      },
                    });
                  }}
                >
                  Add
                </button>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function FlowRow({ f, onOpen, onEdit, onDelete, refresh }: { f: Flow; onOpen: () => void; onEdit: () => void; onDelete: () => void; refresh: () => void }) {
  const { notify } = useNav();
  const habit = f.kind === 'habit';
  const checked = isDoneToday(f);
  const done = doneToday(f).length;
  const total = f.steps.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const streak = streakLabel(f);
  const sub = [scheduleLabel(f), habit ? (checked ? 'Done today' : '') : total ? `${done}/${total} steps today` : 'No steps yet'].filter(Boolean);
  const check = () => {
    const before = getFlow(f.id);
    toggleFlowToday(f.id);
    refresh();
    dataChanged();
    if (!checked)
      notify(`${f.n}: done for today.`, {
        undo: () => {
          if (before) saveFlow(before);
          refresh();
          dataChanged();
        },
      });
  };
  return (
    <div className="frow top tkRow gRow tapRow" onClick={rowTap(onOpen)}>
      {habit ? <button className={'fchk' + (checked ? ' on' : '')} aria-label={checked ? `Not done yet: ${f.n}` : `Done today: ${f.n}`} onClick={check} /> : null}
      <div className="ft">
        <button className="tlT" onClick={onOpen}>
          <span>{f.n}</span>
        </button>
        <div className="fsub">{sub.join(' · ')}</div>
        {!habit && total ? (
          <span className="gBar">
            <i style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </div>
      {streak ? <span className="fmeta">{streak}</span> : null}
      <ItemMenu
        name={f.n}
        open={onOpen}
        edit={onEdit}
        rename={{
          value: f.n,
          save: (v) => {
            const x = getFlow(f.id);
            if (x) saveFlow({ ...x, n: v.slice(0, 60), example: false });
          },
        }}
        extra={habit ? [{ label: checked ? 'Not done today' : 'Done today', onClick: check }] : undefined}
        onChange={refresh}
        onDelete={onDelete}
      />
    </div>
  );
}
