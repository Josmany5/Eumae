/* Project detail — the mockup's pgProject, now a real owner.
 *
 * The page used to show the first three tasks and files in the whole app
 * (audit: ProjectPage.tsx:35-36), whatever project you opened. Membership now
 * lives on the project (projects.ts `links`), so each section lists only what
 * was put in this project. One "+ Add" asks for a type, then either makes a
 * new one already in the project or links one you have. Rename, description,
 * pin and delete sit in the header's ⋯ like every other item.
 */

import { useEffect, useState } from 'react';
import { useNav } from '../nav';
import {
  getProject,
  saveProject,
  deleteProject,
  projectPercent,
  projectProgress,
  projectCountLabel,
  linkedIds,
  linkItem,
  unlinkItem,
  projectOf,
  snapshotProjects,
  restoreProjects,
  type LinkKind,
} from '../projects';
import { getTasks, toggleTask, createTask, saveTask, deleteTask, snapshotTasks, restoreTasks } from '../tasks';
import { getFiles, addFile, trashFile, snapshotLibrary, restoreLibrary } from '../library';
import { getNotes, createNote, saveNote, titleOf, deleteNote, snapshotNotes, restoreNotes } from '../notes';
import { getEvents, saveEvent, ymd } from '../events';
import { getGoals, createGoal, saveGoal, deleteGoal, snapshotGoals, restoreGoals } from '../goals';
import { parseQuick, fmtShort, fmtTime } from '../quickadd';
import { openOfficeEdit, setFocus, onDataChange, dataChanged } from '../focus';
import { sortMilestones } from '../milestones';
import { daysLeft } from '../due';
import { rowTap } from '../rowTap';
import { snapshotDash, restoreDash, removePage, addProjectPage, projectPageIndex } from '../dash';
import { ItemMenu, PromptDialog, PickDialog, type MenuEntry } from '../components/ItemMenu';
import { quickToEvent, removeEvent } from '../components/QuickAdd';
import { undoable } from '../undo';
import type { PageProps } from './index';

export const KIND_LABEL: Record<LinkKind, string> = { task: 'Task', file: 'File', note: 'Note', event: 'Event', goal: 'Goal' };
const SECTION: Record<LinkKind, string> = { task: 'Tasks', file: 'Files', note: 'Notes', event: 'Events', goal: 'Goals' };
const ORDER: LinkKind[] = ['task', 'event', 'goal', 'note', 'file'];

interface Row {
  id: string;
  label: string;
  sub?: string;
  done?: boolean;
}

/* Everything of one kind that exists right now, as rows. Linked ids that no
   longer resolve (deleted, or in Library's trash) are simply not shown. */
export function rowsOf(k: LinkKind): Row[] {
  switch (k) {
    case 'task':
      return getTasks().map((t) => ({
        id: t.id,
        label: t.t,
        done: !!t.d,
        sub: t.due ? fmtShort(t.due) + (t.tm ? ' ' + fmtTime(t.tm) : '') : undefined,
      }));
    case 'file':
      return getFiles().map((f) => ({ id: f.id, label: f.t, sub: f.k }));
    case 'note':
      return getNotes().map((n) => ({ id: n.id, label: titleOf(n) || 'Untitled' }));
    case 'event':
      return getEvents()
        .filter((e) => e.id)
        .map((e) => ({
          id: e.id!,
          label: e.t,
          sub: fmtShort(e.d) + (e.allDay || !e.tm ? '' : ' ' + fmtTime(e.tm)) + (e.rep ? ' · repeats' : ''),
        }));
    case 'goal':
      return getGoals().map((g) => ({ id: g.id, label: g.t, done: g.st === 'completed', sub: g.td ? 'By ' + fmtShort(g.td) : undefined }));
  }
}

/** Make one task, event or note from a typed line ("Call Marcus tomorrow 4pm")
 *  and return its id. Shared by projects and goals. */
export function createOfKind(k: 'task' | 'event' | 'note', text: string): string | null {
  const name = text.trim();
  if (!name) return null;
  if (k === 'task') {
    const q = parseQuick(name);
    const t = createTask(q.title || name);
    saveTask({ ...t, due: q.date, tm: q.time, est: q.mins });
    return t.id;
  }
  if (k === 'note') {
    const n = createNote(name.slice(0, 80));
    const safe = name.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    saveNote({ ...n, body: `<div>${safe}</div>` });
    return n.id;
  }
  const e = saveEvent(quickToEvent(parseQuick(name), ymd(new Date())));
  return e.id ?? null;
}

export default function ProjectPage({ arg }: PageProps) {
  const { back } = useNav();
  const id = typeof arg === 'string' ? arg : '';
  return <ProjectView id={id} onDeleted={back} />;
}

/* The whole project in the flat look of Tasks and Goals (his call, Oct 21,
 * 11:43 PM): deadline, progress and milestones at the top; everything in
 * it below as flat rows, one section per kind. Edit opens the project's own
 * tab in Mae's office. Pin makes this whole view a Console page; the same
 * component renders there. */
export function ProjectView({ id, onDeleted, embedded }: { id: string; onDeleted?: () => void; embedded?: boolean }) {
  const { notify, go, openPanel } = useNav();
  const [tick, setTick] = useState(0);
  const [adding, setAdding] = useState<LinkKind | null>(null);
  const [linking, setLinking] = useState<LinkKind | null>(null);
  const refresh = () => setTick((t) => t + 1);
  void tick;
  useEffect(() => onDataChange(refresh), []);

  const p = getProject(id);
  if (!p) return <div className="empty">This project isn't here any more.</div>;
  const pc = projectPercent(p);
  const hasSteps = projectProgress(p).total > 0;
  const left = p.due ? daysLeft(p.due) : null;
  const ms = sortMilestones(p.ms ?? []);
  const pinnedAt = projectPageIndex(p.id);

  const editInOffice = () => {
    openOfficeEdit('project', p.id);
    openPanel('item');
  };
  /* Chat about it: Mae's office opens on this project, so she already has it. */
  const chat = () => {
    setFocus({ k: 'project', id: p.id });
    openPanel('mae');
  };
  const pin = () => {
    if (pinnedAt >= 0) {
      undoable(notify, 'Removed from Console.', snapshotDash, (x) => restoreDash(x), () => removePage(pinnedAt), refresh);
      return;
    }
    const snap = snapshotDash();
    addProjectPage(p.id, p.n);
    refresh();
    notify('Added to Console as its own page.', { undo: () => { restoreDash(snap); refresh(); } });
  };

  const sections = ORDER.map((k) => {
    const ids = linkedIds(p.id, k);
    return { k, rows: rowsOf(k).filter((r) => ids.includes(r.id)) };
  });
  const total = sections.reduce((n, s) => n + s.rows.length, 0);

  /* Make one, already in this project. */
  const create = (k: LinkKind, text: string) => {
    const name = text.trim();
    if (!name) return;
    if (k === 'task') {
      const q = parseQuick(name);
      const t = createTask(q.title || name);
      saveTask({ ...t, due: q.date, tm: q.time, est: q.mins });
      linkItem(p.id, 'task', t.id);
    } else if (k === 'file') {
      const f = addFile(name.slice(0, 80), 'DOC');
      linkItem(p.id, 'file', f.id);
    } else if (k === 'note') {
      const n = createNote(name.slice(0, 80));
      const safe = name.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
      saveNote({ ...n, body: `<div>${safe}</div>` });
      linkItem(p.id, 'note', n.id);
    } else if (k === 'event') {
      const e = saveEvent(quickToEvent(parseQuick(name), ymd(new Date())));
      linkItem(p.id, 'event', e.id!);
    } else {
      const q = parseQuick(name);
      const g = createGoal(q.title || name);
      if (q.date) saveGoal({ ...g, td: q.date });
      linkItem(p.id, 'goal', g.id);
    }
    refresh();
    dataChanged();
    notify(`${KIND_LABEL[k]} added to ${p.n}.`);
  };

  /* Tasks, events and goals open in Mae's office like everywhere else;
     notes and files open their own pages. */
  const open = (k: LinkKind, rid: string) => {
    if (k === 'note') return go('note', rid);
    if (k === 'file') return go('view', rid);
    const ev = k === 'event' ? getEvents().find((e) => e.id === rid) : undefined;
    setFocus({ k, id: rid, ...(ev ? { day: ev.d } : {}) });
    openPanel('item');
  };

  const remove = (k: LinkKind, rid: string) => {
    if (k === 'task') undoable(notify, 'Task deleted.', snapshotTasks, restoreTasks, () => deleteTask(rid), refresh);
    else if (k === 'file') undoable(notify, 'Moved to Trash.', snapshotLibrary, restoreLibrary, () => trashFile(rid), refresh);
    else if (k === 'note') undoable(notify, 'Note deleted.', snapshotNotes, restoreNotes, () => deleteNote(rid), refresh);
    else if (k === 'goal') undoable(notify, 'Goal deleted.', snapshotGoals, restoreGoals, () => deleteGoal(rid), refresh);
    else {
      const ev = getEvents().find((e) => e.id === rid);
      if (ev) removeEvent(notify, ev, undefined, 'all', refresh);
    }
  };

  const tickMs = (mid: string) => {
    const before = p;
    const m = (p.ms ?? []).find((x) => x.id === mid);
    saveProject({ ...p, ms: (p.ms ?? []).map((x) => (x.id === mid ? { ...x, done: !x.done } : x)) });
    refresh();
    dataChanged();
    notify(m?.done ? 'Milestone reopened.' : 'Milestone done.', { undo: () => { saveProject(before); refresh(); dataChanged(); } });
  };

  const headMenu: MenuEntry[] = [
    { label: 'Edit', onClick: editInOffice },
    { label: 'Chat about this project', onClick: chat },
    { label: pinnedAt >= 0 ? 'Remove from Console' : 'Pin to Console', onClick: pin },
  ];

  return (
    <div className={embedded ? 'pjView pjEmb' : 'pjView'}>
      <div className="itemHead">
        <div className="g">
          {embedded ? (
            <button className="screenT tlT" onClick={() => go('project', p.id)}>
              {p.n}
            </button>
          ) : (
            <div className="screenT">{p.n}</div>
          )}
          {p.d ? <div className="fsub">{p.d}</div> : null}
        </div>
        <button className="lb" onClick={editInOffice}>
          Edit
        </button>
        <ItemMenu
          name={p.n}
          rename={{ value: p.n, title: 'Rename project', save: (v) => saveProject({ ...p, n: v.slice(0, 48) }) }}
          extra={headMenu}
          onChange={refresh}
          onDelete={() => {
            /* A pinned project's Console page goes with it; Undo brings both back. */
            const snapP = snapshotProjects();
            const snapD = snapshotDash();
            deleteProject(p.id);
            if (pinnedAt >= 0) removePage(pinnedAt);
            onDeleted?.();
            dataChanged();
            notify(`Deleted ${p.n}.`, { undo: () => { restoreProjects(snapP); restoreDash(snapD); dataChanged(); } });
          }}
        />
      </div>

      <div className="pjTopInfo">
        <div className="frow pjFact">
          <span className="fmeta">Deadline</span>
          {p.due ? (
            <span className={'ft' + (left?.red ? ' over' : '')}>
              {fmtShort(p.due)} · {left?.text}
            </span>
          ) : (
            <button className="lb" onClick={editInOffice}>
              + Add a deadline
            </button>
          )}
        </div>
        <span className="gBar pjMeter">
          <i style={{ width: `${pc}%` }} />
        </span>
        <div className="fsub">
          {projectCountLabel(p)}
          {hasSteps ? ` · ${pc}%` : ''}
        </div>
        <div className="pjMsRow">
          {ms.length ? (
            ms.map((m) => (
              <button key={m.id} className={'tkPill pjMs' + (m.done ? ' done' : '')} onClick={() => tickMs(m.id)} title={m.done ? 'Reopen' : 'Mark reached'}>
                <span className={'msDot' + (m.done ? ' on' : '')} aria-hidden />
                <span className={m.done ? 'tlDone' : ''}>{m.t}</span>
                {m.d ? <span className="fmeta">{fmtShort(m.d)}</span> : null}
              </button>
            ))
          ) : (
            <button className="lb" onClick={editInOffice}>
              + Add milestones
            </button>
          )}
        </div>
      </div>

      <div className="tkList">
        <div className="sdiv tkH">
          <span>In this project</span>
          <AddMenu onPick={(k) => setAdding(k)} />
        </div>
        {total === 0 ? <p className="oIntro">Nothing in here yet. Add a task, event, goal, note or file, or link one you already have.</p> : null}
        {sections
          .filter((s) => s.rows.length)
          .map((s) => (
            <section key={s.k} className="tkGroup">
              <div className="sdiv tkH">
                <span>{SECTION[s.k]}</span>
                <span className="fmeta">{s.rows.length}</span>
              </div>
              {s.rows.map((r) => (
                <div key={r.id} className="frow top tkRow tapRow" onClick={rowTap(() => open(s.k, r.id))}>
                  {s.k === 'task' ? (
                    <button
                      className={'fchk' + (r.done ? ' on' : '')}
                      aria-label={r.done ? `Reopen ${r.label}` : `Done: ${r.label}`}
                      onClick={() => {
                        toggleTask(r.id);
                        refresh();
                        dataChanged();
                      }}
                    />
                  ) : null}
                  <div className="ft">
                    <button className="tlT" onClick={() => open(s.k, r.id)}>
                      <span className={r.done ? 'tlDone' : ''}>{r.label}</span>
                    </button>
                  </div>
                  {r.sub ? <span className="fmeta">{r.sub}</span> : null}
                  <ItemMenu
                    name={r.label}
                    open={() => open(s.k, r.id)}
                    extra={[
                      {
                        label: 'Unlink from this project',
                        onClick: () => {
                          unlinkItem(s.k, r.id);
                          refresh();
                          notify(`Unlinked from ${p.n}.`, {
                            undo: () => {
                              linkItem(p.id, s.k, r.id);
                              refresh();
                            },
                          });
                        },
                      },
                    ]}
                    onDelete={() => remove(s.k, r.id)}
                  />
                </div>
              ))}
            </section>
          ))}
      </div>

      {adding ? (
        <AddDialog
          kind={adding}
          projectName={p.n}
          onCancel={() => setAdding(null)}
          onCreate={(text) => {
            setAdding(null);
            create(adding, text);
          }}
          onLink={() => {
            setLinking(adding);
            setAdding(null);
          }}
        />
      ) : null}
      {linking ? (
        <PickDialog
          title={`Link a ${KIND_LABEL[linking].toLowerCase()}`}
          empty={`No ${SECTION[linking].toLowerCase()} to link yet.`}
          rows={rowsOf(linking)
            .filter((r) => projectOf(linking, r.id)?.id !== p.id)
            .map((r) => {
              const other = projectOf(linking, r.id);
              return { id: r.id, label: r.label, sub: [r.sub, other ? 'Now in ' + other.n : ''].filter(Boolean).join(' · ') };
            })}
          onCancel={() => setLinking(null)}
          onPick={(rid) => {
            const k = linking;
            setLinking(null);
            linkItem(p.id, k, rid);
            refresh();
            notify(`Linked to ${p.n}.`, {
              undo: () => {
                unlinkItem(k, rid);
                refresh();
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}

/* "+ Add": pick a type first. Same popover as the ⋯ menu, opened from a
   labeled button. */
function AddMenu({ onPick }: { onPick: (k: LinkKind) => void }) {
  return (
    <ItemMenu
      name="this project"
      className="pjAddBtn"
      extra={ORDER.map((k) => ({ label: KIND_LABEL[k], onClick: () => onPick(k) }))}
      buttonLabel="+ Add"
    />
  );
}

/* Then: name a new one, or go pick one you have. */
export function AddDialog({
  kind,
  projectName,
  onCreate,
  onLink,
  onCancel,
}: {
  kind: LinkKind;
  projectName: string;
  onCreate: (text: string) => void;
  onLink: () => void;
  onCancel: () => void;
}) {
  const hint: Record<LinkKind, string> = {
    task: 'Call Marcus tomorrow 4pm',
    file: 'Pitch outline',
    note: 'Ideas for the homepage',
    event: 'Client review Fri 2pm',
    goal: 'Sign the client by Dec 1',
  };
  return (
    <PromptDialog
      title={`New ${KIND_LABEL[kind].toLowerCase()} in ${projectName}`}
      value=""
      ok="Create"
      placeholder={hint[kind]}
      onCancel={onCancel}
      onOk={onCreate}
      footer={
        <button className="lb dlgLink" onClick={onLink}>
          Or link a {KIND_LABEL[kind].toLowerCase()} you already have
        </button>
      }
    />
  );
}
