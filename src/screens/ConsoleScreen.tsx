import { useRef, useState } from 'react';
import { PagedDash } from '../components/shell/PagedDash';
import { snapshotDash, restoreDash } from '../dash';
import { undoable } from '../undo';
import { useNav } from '../nav';
import { getTasks, type Task } from '../tasks';
import {
  getDashboard,
  removeWidget,
  addWidget,
  moveWidget,
  addPage,
  consolePageNames,
  renameConsolePage,
  removePage,
  WIDGET_IDS,
  WIDGET_TITLES,
  type Dashboard,
  type WidgetId,
} from '../dash';
import { WidgetCard, WIDGET_NAV } from '../components/shell/widgets';

/* The Console — the mockup's widget dashboard (second rCon layer), rebuilt
 * as React on tokens.
 *
 * Pages come from the dash store (mockup's dash8.pages seed); each page is a
 * grid of widget cards. Edit mode (button + 600ms hold, the mockup's ED8):
 * cards shake with × to remove, size toggles flip quick/full, + Add opens
 * the registry, pages gain + New / Remove. Drag reorders within and across
 * pages — the mockup has remove + add only, so this is the new piece on the
 * same store. Tapping a card (not editing) opens its full page.
 */

export default function ConsoleScreen() {
  const { notify, go, goTab } = useNav();
  const [tasks, setTasks] = useState<Task[]>(() => getTasks());
  const [dash, setDash] = useState<Dashboard>(() => getDashboard());
  const [editing, setEditing] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const holdTimer = useRef<number | null>(null);

  const refresh = () => {
    setTasks(getTasks());
    setDash(getDashboard());
  };

  const openCount = tasks.filter((t) => !t.d).length;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  /* 600ms hold enters edit — the mockup's onpointerdown timer. */
  const holdStart = () => {
    if (editing) return;
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setEditing(true), 600);
  };
  const holdEnd = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const navigate = (id: WidgetId) => {
    const nav = WIDGET_NAV[id];
    if (nav.tab === 'library' || nav.tab === 'guild') {
      goTab(nav.tab);
      return;
    }
    if (nav.page) go(nav.page);
  };

  const briefing = (
    <div className="card briefFull" ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}>
          <b>Today&apos;s briefing</b>
          <div className="s" style={{ marginTop: 4 }}>
            Mirror: you finish work best before 9 AM and slip after 4.
          </div>
          <div className="s" style={{ marginTop: 6 }}>
            Nudge: nothing is scheduled after 3 PM — move the demo rehearsal there?
          </div>
          <div className="btns">
            <button className="fb" onClick={() => setBriefOpen(false)}>
              Dismiss
            </button>
          </div>
        </div>
  );

  return (
    <div className={editing ? 'ed8 dashWide' : 'dashWide'} onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd}>
      <div className="row dashHead">
        <div className="g">
          <div className="screenT">Console</div>
          <div className="screenS">{editing ? 'Editing this dashboard.' : `${today} · ${openCount} left today`}</div>
        </div>
        <button className={'dashEdit' + (editing ? ' pri' : '')} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <PagedDash
        pages={dash.pages}
        names={consolePageNames()}
        allIds={WIDGET_IDS}
        titles={WIDGET_TITLES}
        editing={editing}
        notify={notify}
        onChange={refresh}
        ops={{
          move: moveWidget,
          add: (p, id) => addWidget(p, id as WidgetId),
          addPage,
          removePage,
          snapshot: snapshotDash,
          restore: (x) => restoreDash(x as Dashboard),
          rename: renameConsolePage,
        }}
        renderCard={(w, pi, wi, len) => (
          <>
          <WidgetCard
            id={w as WidgetId}
            dash={dash}
            pageLen={len}
            isFirst={pi === 0 && wi === 0}
            editing={editing}
            onNavigate={navigate}
            onBrief={() => setBriefOpen((v) => !v)}
            onRemove={() =>
              undoable(notify, 'Widget removed.', snapshotDash, restoreDash, () => removeWidget(pi, w as WidgetId), refresh)
            }
            onRefresh={refresh}
          />
          {w === 'brief8' && briefOpen && !editing ? briefing : null}
          </>
        )}
      />
    </div>
  );
}
