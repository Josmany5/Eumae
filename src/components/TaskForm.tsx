import { useState, type ReactNode } from 'react';
import type { Task, TaskPriority } from '../tasks';

/* The full task form: used in place on the Tasks page and in the edit
   pop-up any page can open from Mae's office. */
export function TaskForm({ task, lists, onSave, onCancel, onDelete, saveLabel, extra, bare }: {
  task: Task; lists: { id: string; n: string }[]; onSave: (t: Task) => void; onCancel: () => void; onDelete?: () => void;
  /** Mae's office edits in place: its button reads Done. */
  saveLabel?: string;
  /** More fields before the buttons (the office adds Project and Goal). */
  extra?: ReactNode;
  /** No card box or heading (inside the office). */
  bare?: boolean;
}) {
  const [t, setT] = useState<Task>(task);
  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }));
  const days = t.repDays && t.repDays.length ? t.repDays : t.due ? [new Date(t.due + 'T12:00').getDay()] : [];
  return (
    <div className={bare ? 'evForm itForm' : 'card evForm'}>
      {bare ? null : <b>{task.t === 'New task' && !task.due ? 'New task' : 'Task'}</b>}
      <input className="sinput" value={t.t} onChange={(e) => set({ t: e.target.value })} aria-label="Task" autoFocus />
      <div className="evRow">
        <label>
          <span className="xs m">Due</span>
          <input className="sinput" type="date" value={t.due ?? ''} onChange={(e) => set({ due: e.target.value || undefined })} />
        </label>
        <label>
          <span className="xs m">Time</span>
          <input className="sinput" type="time" value={t.tm ?? ''} onChange={(e) => set({ tm: e.target.value || undefined })} />
        </label>
        <label>
          <span className="xs m">Estimate (min)</span>
          <input className="sinput" type="number" min={5} step={5} value={t.est ?? ''} onChange={(e) => set({ est: e.target.value ? +e.target.value : undefined })} />
        </label>
      </div>
      <div className="evRow">
        <label>
          <span className="xs m">Priority</span>
          <select className="sinput" value={t.pr ?? 'none'} onChange={(e) => set({ pr: e.target.value as TaskPriority })}>
            <option value="none">None</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical (urgent + important)</option>
          </select>
        </label>
        <label>
          <span className="xs m">List</span>
          <select className="sinput" value={t.list ?? 'inbox'} onChange={(e) => set({ list: e.target.value })}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.n}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="xs m">Repeat</span>
          <select className="sinput" value={t.rep ?? 'none'} onChange={(e) => set({ rep: e.target.value as Task['rep'] })}>
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>
      {t.rep === 'weekly' ? (
        <div className="evDays" aria-label="Repeat on">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => {
            const on = days.includes(i);
            return (
              <button key={i} className={on ? 'on' : ''} aria-pressed={on}
                onClick={() => {
                  const next = on ? days.filter((d) => d !== i) : [...days, i].sort();
                  set({ repDays: next.length ? next : undefined });
                }}>
                {l}
              </button>
            );
          })}
        </div>
      ) : null}
      {t.rep && t.rep !== 'none' ? (
        <div className="evRow">
          <label>
            <span className="xs m">Repeat until</span>
            <input className="sinput" type="date" value={t.repUntil ?? ''} onChange={(e) => set({ repUntil: e.target.value || undefined })} />
          </label>
        </div>
      ) : null}
      {extra}
      <div className="btns">
        <button className="pri" onClick={() => t.t.trim() && onSave({ ...t, t: t.t.trim() })}>{saveLabel ?? 'Save task'}</button>
        <button className="gho" onClick={onCancel}>Cancel</button>
        {onDelete ? <button className="gho danger" onClick={onDelete}>Delete</button> : null}
      </div>
    </div>
  );
}

