import type { ReactNode } from 'react';
import { getProjects, type LinkKind } from '../../projects';
import { getGoals, isActiveGoal } from '../../goals';
import type { Links } from './ItemEdit';

/* Eumae's office edits INLINE (his correction, Oct 21, 4:22 PM): the tab
 * always lists every field as a clean row, empty ones too. Edit turns each
 * row's value into an input in the same spot, with no form swap and no new window.
 * Done saves (Undo pill), Cancel puts it back. */

/** One label · value row. Pass `edit` and the value becomes that input. */
export function KV({ k, v, cls, edit }: { k: string; v?: ReactNode; cls?: string; edit?: ReactNode }) {
  const empty = v === undefined || v === null || v === '';
  return (
    <div className={'frow itKV' + (edit ? ' itKVe' : '')}>
      <span className="fmeta">{k}</span>
      {edit ? (
        <span className="itVal">{edit}</span>
      ) : (
        <span className={'ft' + (empty ? ' itNone' : cls ? ' ' + cls : '')}>{empty ? 'None' : v}</span>
      )}
    </div>
  );
}

export function TextIn({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  return <input className="itIn" aria-label={label} placeholder={placeholder ?? 'None'} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function DateIn({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input className="itIn" type="date" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function TimeIn({ value, onChange, label, disabled }: { value: string; onChange: (v: string) => void; label: string; disabled?: boolean }) {
  return <input className="itIn" type="time" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
}

export function NumIn({ value, onChange, label, placeholder }: { value: number | undefined; onChange: (v: number | undefined) => void; label: string; placeholder?: string }) {
  return (
    <input
      className="itIn itNum2"
      type="number"
      min={0}
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder ?? '0'}
      value={value ?? ''}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        onChange(Number.isFinite(n) && n > 0 ? n : undefined);
      }}
    />
  );
}

export function Pick<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <select className="itIn" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Project and Goal rows: plain read values, or selects while editing. */
export function LinkRows({
  editing,
  links,
  onLinks,
  project,
  goal,
  withGoal,
}: {
  editing: boolean;
  links: Links;
  onLinks: (l: Links) => void;
  project?: string;
  goal?: string;
  withGoal: boolean;
  kind?: LinkKind;
}) {
  const projects = getProjects();
  const goals = getGoals().filter((g) => isActiveGoal(g) || g.id === links.goal);
  return (
    <>
      <KV
        k="Project"
        v={project}
        edit={
          editing ? (
            <Pick label="Project" value={links.project} options={[['', 'None'], ...projects.map((p) => [p.id, p.n] as [string, string])]} onChange={(project) => onLinks({ ...links, project })} />
          ) : undefined
        }
      />
      {withGoal ? (
        <KV
          k="Goal"
          v={goal}
          edit={
            editing ? (
              <Pick label="Goal" value={links.goal} options={[['', 'None'], ...goals.map((g) => [g.id, g.t] as [string, string])]} onChange={(goal) => onLinks({ ...links, goal })} />
            ) : undefined
          }
        />
      ) : null}
    </>
  );
}

/** S M T W T F S toggles for a weekly repeat. */
export function WeekDays({ days, onChange }: { days: number[]; onChange: (d: number[] | undefined) => void }) {
  return (
    <span className="evDays itDays" aria-label="Repeat on">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => {
        const on = days.includes(i);
        return (
          <button
            key={i}
            className={on ? 'on' : ''}
            aria-pressed={on}
            onClick={() => {
              const next = on ? days.filter((d) => d !== i) : [...days, i].sort();
              onChange(next.length ? next : undefined);
            }}
          >
            {l}
          </button>
        );
      })}
    </span>
  );
}

/** Done + Cancel while editing. */
export function EditActs({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  return (
    <div className="itActs">
      <button className="pri" onClick={onDone}>Done</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
