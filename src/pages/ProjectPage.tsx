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
  linkMilestone,
  setLinkMilestone,
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
import { sortMilestones, nextMilestone, newMilestone } from '../milestones';
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

/* The whole project in the flat look of Tasks and Goals. HIS CALL (Oct 21,
 * 11:51 PM, mockup 11-project-milestones.png): a milestone is a target date
 * for a group of things. So the page is: deadline and next milestone on top,
 * the progress meter, a trail of milestones, then one section per milestone
 * holding its tasks, events, goals, notes and files, with a "+ Add to …"
 * under each. Anything under no milestone sits at the bottom. Edit opens the
 * project's own tab in Mae's office. Pin makes this whole view a Console
 * page; the same component renders there. */
export function ProjectView({ id, onDeleted, embedded }: { id: string; onDeleted?: () => void; embedded?: boolean }) {
  const { notify, go, openPanel } = useNav();
  const [tick, setTick] = useState(0);
  /* What "+ Add" is adding, and under which milestone ('' = none). */
  const [adding, setAdding] = useState<{ k: LinkKind; m: string } | null>(null);
  const [linking, setLinking] = useState<{ k: LinkKind; m: string } | null>(null);
  const [moving, setMoving] = useState<{ k: LinkKind; id: string } | null>(null);
  const [newMs, setNewMs] = useState(false);
  /* Closed phases (his ask, Oct 22): each phase opens and closes, plus one
     control for all of them. Remembered per project on this device. */
  const shutKey = 'eumae:pjShut:' + id;
  const [shut, setShutState] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(shutKey) ?? '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const setShut = (v: string[]) => {
    setShutState(v);
    try {
      localStorage.setItem(shutKey, JSON.stringify(v));
    } catch {
      /* Non-fatal. */
    }
  };
  const refresh = () => setTick((t) => t + 1);
  void tick;
  useEffect(() => onDataChange(refresh), []);

  const p = getProject(id);
  if (!p) return <div className="empty">This project isn't here any more.</div>;
  const pc = projectPercent(p);
  const hasSteps = projectProgress(p).total > 0;
  const left = p.due ? daysLeft(p.due) : null;
  const ms = sortMilestones(p.ms ?? []);
  const next = nextMilestone(ms);
  const nextLeft = next?.d ? daysLeft(next.d) : null;
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

  /* Every linked item that still exists, with its kind and milestone. */
  const items: GroupRow[] = ORDER.flatMap((k) => {
    const ids = linkedIds(p.id, k);
    return rowsOf(k)
      .filter((r) => ids.includes(r.id))
      .map((r) => ({ ...r, k, m: linkMilestone(p, k, r.id) ?? '' }));
  });
  const inMs = (mid: string) => items.filter((r) => r.m === mid);
  const loose = inMs('');
  /* Open milestones by date first, reached ones after. */
  const groups = [...ms.filter((m) => !m.done), ...ms.filter((m) => m.done)];

  /* Make one, already in this project (and under a milestone when given). */
  const create = (k: LinkKind, text: string, mid: string) => {
    const name = text.trim();
    if (!name) return;
    let nid: string | null = null;
    if (k === 'file') nid = addFile(name.slice(0, 80), 'DOC').id;
    else if (k === 'goal') {
      const q = parseQuick(name);
      const g = createGoal(q.title || name);
      if (q.date) saveGoal({ ...g, td: q.date });
      nid = g.id;
    } else nid = createOfKind(k, name);
    if (!nid) return;
    linkItem(p.id, k, nid, mid || undefined);
    refresh();
    dataChanged();
    const where = ms.find((m) => m.id === mid);
    notify(`${KIND_LABEL[k]} added to ${where ? where.t : p.n}.`);
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

  const saveWithUndo = (next: typeof p, msg: string) => {
    const before = p;
    saveProject(next);
    refresh();
    dataChanged();
    notify(msg, { undo: () => { saveProject(before); refresh(); dataChanged(); } });
  };

  /* "Mockup approved Oct 30": the name, and the date read out of the line. */
  const addMs = (text: string) => {
    const q = parseQuick(text.trim());
    const t = (q.title || text).trim().slice(0, 60);
    if (!t) return;
    saveWithUndo({ ...p, ms: [...(p.ms ?? []), newMilestone(t, q.date ?? '')] }, `Phase added: ${t}.`);
  };


  const headMenu: MenuEntry[] = [
    { label: 'Add a phase', onClick: () => setNewMs(true) },
    { label: 'Chat about this project', onClick: chat },
    { label: pinnedAt >= 0 ? 'Remove from Console' : 'Pin to Console', onClick: pin },
  ];

  /* One list per kind, each under its own heading (his call, Oct 22): never
     one mixed list with a label or pill on each row. */
  const byKind = (rows: GroupRow[]) =>
    ORDER.map((k) => {
      const rs = rows.filter((x) => x.k === k);
      return rs.length ? (
        <div key={k} className="pjKindList">
          <div className="pjKindH">
            {SECTION[k]} <span>{rs.length}</span>
          </div>
          {rs.map(row)}
        </div>
      ) : null;
    });

  const row = (r: GroupRow) => (
    <div key={r.k + r.id} className="frow top tkRow tapRow" onClick={rowTap(() => open(r.k, r.id))}>
      {r.k === 'task' ? (
        <button
          className={'fchk' + (r.done ? ' on' : '')}
          aria-label={r.done ? `Reopen ${r.label}` : `Done: ${r.label}`}
          onClick={() => {
            toggleTask(r.id);
            refresh();
            dataChanged();
          }}
        />
      ) : (
        <span className="pjLead" aria-hidden />
      )}
      <div className="ft">
        <button className="tlT" onClick={() => open(r.k, r.id)}>
          <span className={r.done ? 'tlDone' : ''}>{r.label}</span>
        </button>
      </div>
      {r.sub ? <span className="fmeta">{r.sub}</span> : null}
      <ItemMenu
        name={r.label}
        open={() => open(r.k, r.id)}
        extra={[
          ...(ms.length ? [{ label: 'Move to phase', onClick: () => setMoving({ k: r.k, id: r.id }) }] : []),
          {
            label: 'Unlink from this project',
            onClick: () => {
              const was = r.m;
              unlinkItem(r.k, r.id);
              refresh();
              notify(`Unlinked from ${p.n}.`, {
                undo: () => {
                  linkItem(p.id, r.k, r.id, was || undefined);
                  refresh();
                },
              });
            },
          },
        ]}
        onDelete={() => remove(r.k, r.id)}
      />
    </div>
  );

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
        <ItemMenu
          name={p.n}
          edit={editInOffice}
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

      <div className="pjFacts">
        <div className="pjTile">
          <span className="k">Deadline</span>
          {p.due ? (
            <span className={'v' + (left?.red ? ' over' : '')}>
              {md(p.due)} <small>· {left?.text.replace(' left', '')}</small>
            </span>
          ) : (
            <span className="v none">None</span>
          )}
        </div>
        <div className="pjTile">
          <span className="k">Next phase</span>
          {next ? (
            <span className={'v' + (nextLeft?.red ? ' over' : '')}>
              {md(next.d)} <small>· {nextLeft?.text.replace(' left', '')}</small>
            </span>
          ) : (
            <span className="v none">None</span>
          )}
        </div>
      </div>
      <span className="gBar pjMeter">
        <i style={{ width: `${pc}%` }} />
      </span>
      <div className="pjCount">
        <span>{projectCountLabel(p).replace('steps', 'done').replace('step', 'done')}</span>
        {hasSteps ? <span>{pc}%</span> : null}
      </div>

      {ms.length ? null : (
        <div className="pjMsEmpty">
          <div className="t">Phases</div>
          <p>Stages of the work with a target date, like "Mockup approved by Oct 30". Each one collects its own tasks, events, notes and files.</p>
          <button className="lb" onClick={() => setNewMs(true)}>
            + Add a phase
          </button>
        </div>
      )}

      {ms.length ? (
        <div className="pjPhBar">
          <span>
            {ms.length} phase{ms.length === 1 ? '' : 's'}
          </span>
          <button className="lb" onClick={() => setShut(shut.length >= ms.length ? [] : ms.map((m) => m.id))}>
            {shut.length >= ms.length ? 'Open all' : 'Close all'}
          </button>
        </div>
      ) : null}
      <div className="tkList pjGroups">
        {groups.map((m) => {
          const rows = inMs(m.id);
          const done = rows.filter((r) => r.done).length;
          const closed = shut.includes(m.id);
          const dated = m.d ? (m.done ? 'Done ' : '') + fmtShort(m.d) : m.done ? 'Done' : 'No date';
          return (
            <section key={m.id} className={'tkGroup pjGroup' + (m.done ? ' done' : '')}>
              <button
                className="pjGH"
                aria-expanded={!closed}
                onClick={() => setShut(closed ? shut.filter((x) => x !== m.id) : [...shut, m.id])}
              >
                <span className={'pjChev' + (closed ? '' : ' open')} aria-hidden>
                  ›
                </span>
                <span className="t">
                  Phase {ms.indexOf(m) + 1}: {m.t}
                </span>
                <span className={'m' + (next?.id === m.id ? ' cur' : '')}>
                  {dated}
                  {rows.length ? ` · ${done} of ${rows.length}` : ''}
                </span>
              </button>
              {closed ? null : byKind(rows)}
              {closed || m.done ? null : <AddMenu label={`+ Add to ${m.t}`} onPick={(k) => setAdding({ k, m: m.id })} />}
            </section>
          );
        })}

        <section className="tkGroup pjGroup">
          <div className="pjGH plain">
            <span className="t">{ms.length ? 'Not in a phase' : 'In this project'}</span>
            <span className="m">{loose.length || ''}</span>
          </div>
          {items.length === 0 && !ms.length ? (
            <p className="oIntro">Nothing in here yet. Add a task, event, goal, note or file, or link one you already have.</p>
          ) : null}
          {byKind(loose)}
          <AddMenu label="+ Add" onPick={(k) => setAdding({ k, m: '' })} />
        </section>
      </div>

      {newMs ? (
        <PromptDialog
          title={`New phase in ${p.n}`}
          value=""
          ok="Add"
          placeholder="Mockup approved Oct 30"
          onCancel={() => setNewMs(false)}
          onOk={(v) => {
            setNewMs(false);
            addMs(v);
          }}
        />
      ) : null}
      {adding ? (
        <AddDialog
          kind={adding.k}
          projectName={ms.find((m) => m.id === adding.m)?.t ?? p.n}
          onCancel={() => setAdding(null)}
          onCreate={(text) => {
            const a = adding;
            setAdding(null);
            create(a.k, text, a.m);
          }}
          onLink={() => {
            setLinking(adding);
            setAdding(null);
          }}
        />
      ) : null}
      {linking ? (
        <PickDialog
          title={`Link a ${KIND_LABEL[linking.k].toLowerCase()}`}
          empty={`No ${SECTION[linking.k].toLowerCase()} to link yet.`}
          rows={rowsOf(linking.k)
            .filter((r) => projectOf(linking.k, r.id)?.id !== p.id)
            .map((r) => {
              const other = projectOf(linking.k, r.id);
              return { id: r.id, label: r.label, sub: [r.sub, other ? 'Now in ' + other.n : ''].filter(Boolean).join(' · ') };
            })}
          onCancel={() => setLinking(null)}
          onPick={(rid) => {
            const { k, m } = linking;
            setLinking(null);
            linkItem(p.id, k, rid, m || undefined);
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
      {moving ? (
        <PickDialog
          title="Move to phase"
          empty="No phases yet."
          rows={[...ms.map((m) => ({ id: m.id, label: m.t, sub: m.d ? fmtShort(m.d) : undefined })), { id: '', label: 'No phase' }]}
          onCancel={() => setMoving(null)}
          onPick={(mid) => {
            const { k, id: rid } = moving;
            const was = linkMilestone(p, k, rid) ?? null;
            setMoving(null);
            setLinkMilestone(p.id, k, rid, mid || null);
            refresh();
            dataChanged();
            notify(mid ? `Moved to ${ms.find((m) => m.id === mid)?.t}.` : 'Moved out of its phase.', {
              undo: () => {
                setLinkMilestone(p.id, k, rid, was);
                refresh();
                dataChanged();
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}

/** "Nov 20": short enough for a tile or the trail. */
function md(day: string): string {
  return new Date(day + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface GroupRow extends Row {
  k: LinkKind;
  m: string;
}

/* "+ Add …": pick a type first. Same popover as the ⋯ menu, opened from a
   labeled button. */
function AddMenu({ onPick, label }: { onPick: (k: LinkKind) => void; label: string }) {
  return (
    <div className="pjAddRow">
      <ItemMenu
        name="this project"
        className="pjAddBtn"
        extra={ORDER.map((k) => ({ label: KIND_LABEL[k], onClick: () => onPick(k) }))}
        buttonLabel={label}
      />
    </div>
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
