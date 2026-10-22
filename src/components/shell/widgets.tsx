/* The widget set — the mockup's WREG8/WG8/FB10/WNAV8, rebuilt as React.
 *
 * Seven widgets, each with a quick view (glance; tap opens the full page)
 * and a full view (the whole thing inline, where the mockup built one).
 * Sizes live in dash.ts (`wsz10`); navigation targets are the mockup's
 * WNAV8. Quick views strip their tap-hints when rendered full
 * (`scrub10`).
 */

import { getTasks, toggleTask } from '../../tasks';
import { dayEvents } from '../../events';
import { getGoals, goalPct, goalCount, isActiveGoal } from '../../goals';
import { getPinnedProject, linkedIds, projectPercent, projectCountLabel, type Project } from '../../projects';
import { listUploads } from '../../uploads';
import { getGuild } from '../../guild';
import { useLog } from '../../log';
import { WIDGET_TITLES, WIDGET_ICONS, type Dashboard, type WidgetId } from '../../dash';
import { Icon } from './icons';
import { Timeline, WeekStrip } from './Timeline';

/** Where a quick-view tap lands — the mockup's WNAV8. */
export const WIDGET_NAV: Record<WidgetId, { tab?: string; page?: string }> = {
  tl8: {},
  today8: { page: 'tasks' },
  week8: { page: 'cal' },
  goals8: { page: 'goals' },
  brief8: { page: 'brief' },
  pj8: { page: 'projects' },
  art8: { tab: 'lib' },
  nts8: { tab: 'guild' },
};

/* Quick views: one glance each. Tapping navigates (handled by the card);
   inner buttons stop propagation, like the mockup's event.stopPropagation
   on tgW8. */
function QuickToday({ refresh }: { refresh: () => void }) {
  const open = getTasks().filter((t) => !t.d);
  const done = getTasks().length - open.length;
  return (
    <>
      {open.slice(0, 3).map((t) => (
        <div key={t.id} className="task">
          <button
            className="ck"
            aria-label={`Done: ${t.t}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleTask(t.id);
              refresh();
            }}
          />
          <div className="g s">{t.t}</div>
        </div>
      ))}
      {open.length === 0 ? <div className="s m">All clear.</div> : null}
      <div className="xs m" style={{ marginTop: 6 }}>
        {done} done · tap for the full Tasks page
      </div>
    </>
  );
}

function QuickWeek() {
  const evs = dayEvents(new Date().toISOString().slice(0, 10));
  return (
    <>
      {evs.slice(0, 4).map((e, i) => (
        <div key={`${e.tm}${e.t}${i}`} className="ev">
          <div className="tm">{e.tm}</div>
          <div className="g s">{e.t}</div>
        </div>
      ))}
      {evs.length === 0 ? <div className="s m">Nothing scheduled.</div> : null}
    </>
  );
}

function QuickGoals() {
  const goals = getGoals();
  return (
    <>
      {goals.slice(0, 3).map((g) => (
        <div key={g.id} className="kv">
          <span className="s">{g.t}</span>
          <span className="tag">{g.st}</span>
        </div>
      ))}
      {goals.length === 0 ? <div className="s m">No goals yet.</div> : null}
    </>
  );
}

function QuickBrief({ onBrief }: { onBrief: () => void }) {
  return (
    <>
      <div className="s">
        <b>Mirror:</b> you finish work best before 9 AM and slip after 4.
      </div>
      <div className="s" style={{ marginTop: 6 }}>
        <b>Nudge:</b> nothing is scheduled after 3 PM — move the demo rehearsal there?
      </div>
      <div className="xs m" style={{ marginTop: 6 }}>
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onBrief();
          }}
        >
          Full briefing
        </button>
      </div>
    </>
  );
}

/* The pinned project's own tasks: only the ones linked to it, and the
   done count from those, never the stored sample numbers. */
function pinnedTasks(p: Project) {
  const ids = new Set(linkedIds(p.id, 'task'));
  const mine = getTasks().filter((t) => ids.has(t.id));
  const done = mine.filter((t) => t.d).length;
  const pc = projectPercent(p);
  return { mine, done, pc };
}

function QuickPinned() {
  const p = getPinnedProject();
  if (!p) return <div className="s m">Pin one from Projects.</div>;
  const { pc } = pinnedTasks(p);
  return (
    <>
      <div className="s">
        <b>{p.n}</b> — {p.d}
      </div>
      <div className="bar">
        <i style={{ width: `${pc}%` }} />
      </div>
      <div className="xs m">
        {projectCountLabel(p)}
      </div>
    </>
  );
}

function QuickArtifact() {
  const uploads = listUploads();
  const f = uploads[0];
  if (!f) return <div className="s m">Nothing made yet.</div>;
  return (
    <>
      <div className="s">
        <b>{f.name}</b>
      </div>
      <div className="xs m" style={{ marginTop: 4 }}>
        {f.kind} · tap to open
      </div>
    </>
  );
}

function QuickNotes({ onOpen }: { onOpen: () => void }) {
  const guild = getGuild();
  const n = guild.reqIn.filter((r) => r.st === 'new').length;
  return (
    <>
      {guild.act.slice(0, 3).map((a, i) => (
        <div key={`${a.a}${i}`} className="hi">
          <span className={`dt ${a.s}`} />
          <div className="s">
            {a.a}
            <div className="xs m">
              {a.t} · {a.w}
            </div>
          </div>
        </div>
      ))}
      <div className="xs m" style={{ marginTop: 4 }}>
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {n} requests waiting in Guild
        </button>
      </div>
    </>
  );
}


/* Full views: the whole thing inline. Only where the mockup built one
   (FB10); every full view ends in an "open the full page" door. */
function FullToday({ refresh }: { refresh: () => void }) {
  const tasks = getTasks();
  const open = tasks.filter((t) => !t.d);
  const done = tasks.filter((t) => t.d);
  return (
    <>
      {open.map((t) => (
        <div key={t.id} className="task">
          <button
            className="ck"
            aria-label={`Done: ${t.t}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleTask(t.id);
              refresh();
            }}
          />
          <div className="g s">{t.t}</div>
        </div>
      ))}
      {done.length > 0 ? (
        <>
          <div className="xs m" style={{ margin: '6px 0 2px' }}>
            Done
          </div>
          {done.map((t) => (
            <div key={t.id} className="task">
              <button
                className="ck d"
                aria-label={`Reopen ${t.t}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTask(t.id);
                  refresh();
                }}
              />
              <div className="g s">
                <s className="m">{t.t}</s>
              </div>
            </div>
          ))}
        </>
      ) : null}
      {tasks.length === 0 ? <div className="s m">No tasks yet.</div> : null}
    </>
  );
}

function FullGoals({ onOpen }: { onOpen: () => void }) {
  const goals = getGoals().filter(isActiveGoal);
  return (
    <>
      {goals.map((g) => {
        const pct = goalPct(g);
        return (
          <div key={g.id} className="wGoal">
            <div className="r">
              <span className="ft">{g.t}</span>
              <span className="fmeta">
                {pct}%{goalCount(g) ? ` · ${goalCount(g)}` : ''}
              </span>
            </div>
            <span className="bar">
              <i style={{ width: `${pct}%` }} />
            </span>
          </div>
        );
      })}
      {goals.length === 0 ? <div className="s m">No goals yet.</div> : null}
      <div className="btns">
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Open Goals
        </button>
      </div>
    </>
  );
}

function FullBrief({ onBrief }: { onBrief: () => void }) {
  const log = useLog('Console');
  return (
    <>
      <div className="card" style={{ marginBottom: 8 }}>
        <b>Mirror</b>
        <div className="s" style={{ marginTop: 4 }}>
          You finish work best before 9 AM and slip after 4. Your last three demo tasks all landed on
          mornings you protected.
        </div>
      </div>
      <div className="card">
        <b>Nudge</b>
        <div className="s" style={{ marginTop: 4 }}>
          Nothing is scheduled after 3 PM, and the demo rehearsal still has no slot. Move it there?
        </div>
      </div>
      <div className="btns">
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onBrief();
          }}
        >
          Full briefing
        </button>
      </div>
      {log.length > 0 ? (
        <div className="xs m" style={{ marginTop: 6 }}>
          Overnight: {log[0].text}
        </div>
      ) : null}
    </>
  );
}

function FullPinned({ refresh }: { refresh: () => void }) {
  const p = getPinnedProject();
  if (!p) return <div className="s m">Pin one from Projects.</div>;
  const { mine, pc } = pinnedTasks(p);
  return (
    <>
      <div className="s">
        <b>{p.n}</b> — {p.d}
      </div>
      <div className="bar">
        <i style={{ width: `${pc}%` }} />
      </div>
      <div className="xs m">
        {projectCountLabel(p)}
      </div>
      {mine.some((t) => !t.d) ? (
        <div className="s m" style={{ marginTop: 8 }}>
          Tasks
        </div>
      ) : null}
      {mine.filter((t) => !t.d).slice(0, 5).map((t) => (
        <div key={t.id} className="task">
          <button
            className={`ck${t.d ? ' d' : ''}`}
            aria-label={t.d ? `Reopen ${t.t}` : `Done: ${t.t}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleTask(t.id);
              refresh();
            }}
          />
          <div className="g s">{t.t}</div>
        </div>
      ))}
    </>
  );
}


/* One widget card: title row (icon + name + chevron / size toggle + remove
   × in edit), hero number on the first card, quick or full body. Tap
   navigates unless editing. The mockup's wsec8. */
export function WidgetCard({
  id,
  dash,
  pageLen,
  isFirst,
  editing,
  onNavigate,
  onBrief,
  onRemove,
  onRefresh,
}: {
  id: WidgetId;
  dash: Dashboard;
  /** Widgets on this page — the half rule needs the count. */
  pageLen: number;
  isFirst: boolean;
  editing: boolean;
  onNavigate: (id: WidgetId) => void;
  onBrief: () => void;
  onRemove: () => void;
  onRefresh: () => void;
}) {
  /* One size: every widget shows its full view, full width (Oct 2026 -
     the quick/full toggle barely changed anything). */
  const full = true;
  void dash;
  void pageLen;
  const openCount = id === 'today8' ? getTasks().filter((t) => !t.d).length : 0;
  const go = () => {
    if (id !== 'tl8') onNavigate(id);
  };
  return (
    <div
      className={'wc w-' + id}
      onClick={() => {
        if (!editing) go();
      }}
      role={editing ? undefined : 'button'}
      tabIndex={editing ? undefined : 0}
      onKeyDown={(e) => {
        if (!editing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          go();
        }
      }}
    >
      {editing ? (
        <button
          className="rm"
          aria-label={`Remove ${WIDGET_TITLES[id]}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      ) : null}
      <div className="wt">
        <Icon name={WIDGET_ICONS[id]} />
        <span>{WIDGET_TITLES[id]}</span>
        {!full ? <i>›</i> : null}
      </div>
      {isFirst && id === 'today8' ? (
        <div className="big">
          {openCount}
          <small>left today</small>
        </div>
      ) : null}
      {full ? (
        <WidgetFull id={id} editing={editing} onBrief={onBrief} onRefresh={onRefresh} onNavigate={go} />
      ) : (
        <WidgetQuick id={id} onBrief={onBrief} onRefresh={onRefresh} onNavigate={go} />
      )}
    </div>
  );
}

function WidgetQuick({
  id,
  onBrief,
  onRefresh,
  onNavigate,
}: {
  id: WidgetId;
  onBrief: () => void;
  onRefresh: () => void;
  onNavigate: () => void;
}) {
  switch (id) {
    case 'tl8':
      return <Timeline editing={false} onChange={onRefresh} />;
    case 'today8':
      return <QuickToday refresh={onRefresh} />;
    case 'week8':
      return <QuickWeek />;
    case 'goals8':
      return <QuickGoals />;
    case 'brief8':
      return <QuickBrief onBrief={onBrief} />;
    case 'pj8':
      return <QuickPinned />;
    case 'art8':
      return <QuickArtifact />;
    case 'nts8':
      return <QuickNotes onOpen={onNavigate} />;
  }
}

function WidgetFull({
  id,
  editing,
  onBrief,
  onRefresh,
  onNavigate,
}: {
  id: WidgetId;
  editing: boolean;
  onBrief: () => void;
  onRefresh: () => void;
  onNavigate: () => void;
}) {
  switch (id) {
    case 'tl8':
      return <Timeline editing={editing} onChange={onRefresh} />;
    case 'week8':
      return <WeekStrip />;
    case 'today8':
      return <FullToday refresh={onRefresh} />;
    case 'goals8':
      return <FullGoals onOpen={onNavigate} />;
    case 'brief8':
      return <FullBrief onBrief={onBrief} />;
    case 'pj8':
      return <FullPinned refresh={onRefresh} />;
    case 'art8':
      return <QuickArtifact />;
    case 'nts8':
      return <QuickNotes onOpen={onNavigate} />;
  }
}

