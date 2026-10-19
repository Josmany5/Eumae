/* Project detail — the mockup's pgProject, now a real owner.
 *
 * The page used to show the first three tasks and files in the whole app
 * (audit: ProjectPage.tsx:35-36), whatever project you opened. Membership now
 * lives on the project (projects.ts `links`), so each section lists only what
 * was put in this project. One "+ Add" asks for a type, then either makes a
 * new one already in the project or links one you have. Rename, description,
 * pin and delete sit in the header's ⋯ like every other item.
 */

import { useState } from 'react';
import { useNav } from '../nav';
import {
  getProject,
  saveProject,
  deleteProject,
  getPinnedProjectId,
  setPinnedProjectId,
  projectPercent,
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
import { queueBrief } from '../studio';
import { MilestonesEditor } from '../components/Milestones';
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
  const { notify, go, goTab, back } = useNav();
  const [tick, setTick] = useState(0);
  const [dialog, setDialog] = useState<'desc' | null>(null);
  const [adding, setAdding] = useState<LinkKind | null>(null);
  const [linking, setLinking] = useState<LinkKind | null>(null);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const id = typeof arg === 'string' ? arg : '';
  const p = getProject(id);
  if (!p) return <div className="empty">This project isn't here any more.</div>;
  const pc = projectPercent(p);
  const pin = getPinnedProjectId() ?? 'w1';

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
    notify(`${KIND_LABEL[k]} added to ${p.n}.`);
  };

  const open = (k: LinkKind, rid: string) => {
    if (k === 'task') go('tasks', rid);
    else if (k === 'file') go('view', rid);
    else if (k === 'note') go('note', rid);
    else if (k === 'event') go('events', rid);
    else go('goals', rid);
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

  const headMenu: MenuEntry[] = [
    { label: p.d ? 'Edit description' : 'Add a description', onClick: () => setDialog('desc') },
    {
      label: pin === p.id ? 'Pinned to Console' : 'Pin to Console',
      onClick: () => {
        setPinnedProjectId(p.id);
        refresh();
        notify('Pinned to Console.');
      },
    },
    {
      label: 'Chat in this project',
      onClick: () => {
        queueBrief(`Working in project ${p.n}: `);
        goTab('chat');
      },
    },
  ];

  return (
    <div>
      <div className="itemHead">
        <div className="g">
          <div className="screenT">{p.n}</div>
          {p.d ? (
            <button className="pjDescBtn" onClick={() => setDialog('desc')} title="Edit description">
              {p.d}
            </button>
          ) : (
            <button className="lb" onClick={() => setDialog('desc')}>
              + Add a description
            </button>
          )}
        </div>
        <ItemMenu
          name={p.n}
          rename={{ value: p.n, title: 'Rename project', save: (v) => saveProject({ ...p, n: v.slice(0, 48) }) }}
          extra={headMenu}
          onChange={refresh}
          onDelete={() => {
            back();
            undoable(notify, `Deleted ${p.n}.`, snapshotProjects, restoreProjects, () => deleteProject(p.id));
          }}
        />
      </div>
      {dialog === 'desc' ? (
        <PromptDialog
          title="Description"
          value={p.d}
          ok="Save"
          multiline
          placeholder="What this project is for"
          onCancel={() => setDialog(null)}
          onOk={(v) => {
            setDialog(null);
            saveProject({ ...p, d: v.trim().slice(0, 280) });
            refresh();
            notify('Description saved.');
          }}
        />
      ) : null}
      <div className="card">
        <div className="row">
          <div className="g">
            <b>Progress</b>
          </div>
          <div className="s m">{pc}%</div>
        </div>
        <div className="bar">
          <i style={{ width: `${pc}%` }} />
        </div>
        <div className="btns">
          <button
            className="pri"
            onClick={() => {
              setPinnedProjectId(p.id);
              refresh();
              notify('Pinned to Console.');
            }}
          >
            {pin === p.id ? 'Pinned to Console' : 'Pin to Console'}
          </button>
          <button
            className="gho"
            onClick={() => {
              queueBrief(`Working in project ${p.n}: `);
              goTab('chat');
            }}
          >
            Chat in this project
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 22 }}>
        <h3 className="sec g" style={{ margin: 0 }}>
          In this project
        </h3>
        <AddMenu onPick={(k) => setAdding(k)} />
      </div>
      {total === 0 ? (
        <div className="card s m">
          Nothing in here yet. Use + Add to make a task, file, note, event or goal for this project, or link one you already have.
        </div>
      ) : null}
      {sections
        .filter((s) => s.rows.length)
        .map((s) => (
          <div key={s.k}>
            <h3 className="sec">{SECTION[s.k]}</h3>
            <div className="card cardPad">
              {s.rows.map((r) => (
                <div key={r.id} className="task">
                  {s.k === 'task' ? (
                    <button
                      className={'ck' + (r.done ? ' d' : '')}
                      aria-label={r.done ? `Reopen ${r.label}` : `Done: ${r.label}`}
                      onClick={() => {
                        toggleTask(r.id);
                        refresh();
                      }}
                    />
                  ) : null}
                  <button className="g tkTitle pjItem" onClick={() => open(s.k, r.id)}>
                    {r.done ? <s className="m">{r.label}</s> : r.label}
                    {r.sub ? <span className="pjItemSub">{r.sub}</span> : null}
                  </button>
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
            </div>
          </div>
        ))}

      <h3 className="sec">Deadline and milestones</h3>
      <div className="card evForm">
        <div className="evRow">
          <label>
            <span className="s m">Deadline</span>
            <input
              className="sinput"
              type="date"
              value={p.due ?? ''}
              onChange={(e) => {
                saveProject({ ...p, due: e.target.value });
                refresh();
              }}
            />
          </label>
        </div>
        <span className="s m">Milestones</span>
        <MilestonesEditor
          value={p.ms ?? []}
          onChange={(ms) => {
            saveProject({ ...(getProject(p.id) ?? p), ms });
            refresh();
          }}
        />
        <span className="s m">The deadline and every dated milestone show on your calendar.</span>
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
