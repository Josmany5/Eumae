/* The ⋯ menu: one way to act on any item, everywhere.
 *
 * Before this, every list had its own door — swipe here, a button inside the
 * edit form there, hover icons on desktop only, nothing at all on some screens
 * (audit §3). Every row and every detail-page header now carries this one
 * button with the same entries in the same order: Open, Edit, Rename, the
 * screen's own extras, project membership, Delete last and in red.
 *
 * Delete never asks. The caller deletes and shows the toast with Undo (see
 * src/undo.ts). The menu itself owns the two things that are the same for
 * every item — renaming through a small dialog, and project membership — so
 * no screen grows a second copy of either.
 *
 * Rendered through a portal: page bodies animate with transforms, and a
 * transformed ancestor would pin a `position: fixed` popover to the page
 * instead of the screen. */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNav } from '../nav';
import { getProjects, projectOf, linkItem, unlinkItem, type LinkKind } from '../projects';
import { getGoals, goalOf, linkToGoal, unlinkFromGoal, isActiveGoal, type GoalLinkKind } from '../goals';

export interface MenuEntry {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Not built yet: shown with the app's `.soon` tag. */
  soon?: boolean;
}

export interface ItemMenuProps {
  /** The item's name, for the button's label ("More for Call Marcus"). */
  name: string;
  open?: () => void;
  /** Words for the Open entry ("Open in Mae's office"). */
  openLabel?: string;
  edit?: () => void;
  rename?: { value: string; save: (v: string) => void; title?: string };
  /** Project membership: shows Add to project / Move / Unlink. */
  link?: { k: LinkKind; id: string };
  extra?: MenuEntry[];
  onDelete?: () => void;
  /** One word for the delete entry. "Delete" unless the thing is not yours
   *  to delete (Decline, Leave, Forget). */
  deleteLabel?: string;
  /** Called after a rename or a membership change, so the screen redraws. */
  onChange?: () => void;
  className?: string;
  /** Text instead of the ⋯ dots — "+ Add" on a project. */
  buttonLabel?: string;
}

export function ItemMenu(props: ItemMenuProps) {
  const { notify } = useNav();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<'rename' | 'project' | 'goal' | null>(null);

  const linked = props.link ? projectOf(props.link.k, props.link.id) : undefined;
  const entries: MenuEntry[] = [];
  if (props.open) entries.push({ label: props.openLabel ?? 'Open', onClick: props.open });
  if (props.edit) entries.push({ label: 'Edit', onClick: props.edit });
  if (props.rename) entries.push({ label: 'Rename', onClick: () => setDialog('rename') });
  /* Extras sit after Rename; a red extra ("Delete this one") sits with Delete
     at the bottom, never above the harmless entries. */
  if (props.extra) entries.push(...props.extra.filter((e) => !e.danger));
  if (props.link) {
    entries.push({ label: linked ? 'Move to project' : 'Add to project', onClick: () => setDialog('project') });
    if (linked) {
      const { k, id } = props.link;
      const from = linked;
      entries.push({
        label: `Unlink from ${from.n}`,
        onClick: () => {
          unlinkItem(k, id);
          props.onChange?.();
          notify(`Unlinked from ${from.n}.`, {
            undo: () => {
              linkItem(from.id, k, id);
              props.onChange?.();
            },
          });
        },
      });
    }
  }
  /* Goal membership (his call, Oct 19): tasks, events and notes can serve a
     goal, separate from their project. */
  const gk = props.link && (props.link.k === 'task' || props.link.k === 'event' || props.link.k === 'note') ? (props.link.k as GoalLinkKind) : null;
  const inGoal = gk && props.link ? goalOf(gk, props.link.id) : undefined;
  if (gk && props.link) {
    entries.push({ label: inGoal ? 'Move to goal' : 'Add to goal', onClick: () => setDialog('goal') });
    if (inGoal) {
      const id = props.link.id;
      const from = inGoal;
      entries.push({
        label: `Remove from ${from.t}`,
        onClick: () => {
          unlinkFromGoal(gk, id);
          props.onChange?.();
          notify(`Removed from ${from.t}.`, {
            undo: () => {
              linkToGoal(from.id, gk, id);
              props.onChange?.();
            },
          });
        },
      });
    }
  }
  if (props.extra) entries.push(...props.extra.filter((e) => e.danger));
  if (props.onDelete) entries.push({ label: props.deleteLabel ?? 'Delete', onClick: props.onDelete, danger: true });

  return (
    <>
      <button
        ref={btn}
        className={'imBtn' + (props.className ? ' ' + props.className : '')}
        aria-label={props.buttonLabel ? undefined : `More for ${props.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {props.buttonLabel ?? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        )}
      </button>
      {open ? <MenuPop anchor={btn.current} entries={entries} onClose={() => setOpen(false)} /> : null}
      {dialog === 'rename' && props.rename ? (
        <PromptDialog
          title={props.rename.title ?? 'Rename'}
          value={props.rename.value}
          ok="Save"
          onCancel={() => setDialog(null)}
          onOk={(v) => {
            setDialog(null);
            if (!v.trim() || v.trim() === props.rename!.value) return;
            props.rename!.save(v.trim());
            props.onChange?.();
            notify('Renamed.');
          }}
        />
      ) : null}
      {dialog === 'project' && props.link ? (
        <PickDialog
          title={linked ? 'Move to project' : 'Add to project'}
          empty="No projects yet. Make one in Projects."
          rows={getProjects().map((p) => ({ id: p.id, label: p.n, sub: p.id === linked?.id ? 'In this one now' : p.d }))}
          onCancel={() => setDialog(null)}
          onPick={(pid) => {
            setDialog(null);
            const { k, id } = props.link!;
            const before = linked?.id;
            if (pid === before) return;
            linkItem(pid, k, id);
            props.onChange?.();
            const to = getProjects().find((p) => p.id === pid);
            notify(`${before ? 'Moved' : 'Added'} to ${to?.n ?? 'project'}.`, {
              undo: () => {
                if (before) linkItem(before, k, id);
                else unlinkItem(k, id);
                props.onChange?.();
              },
            });
          }}
        />
      ) : null}
      {dialog === 'goal' && gk && props.link ? (
        <PickDialog
          title={inGoal ? 'Move to goal' : 'Add to goal'}
          empty="No goals yet. Make one in Goals."
          rows={getGoals()
            .filter((g) => isActiveGoal(g) || g.id === inGoal?.id)
            .map((g) => ({ id: g.id, label: g.t, sub: g.id === inGoal?.id ? 'In this one now' : g.d }))}
          onCancel={() => setDialog(null)}
          onPick={(gid) => {
            setDialog(null);
            const id = props.link!.id;
            const before = inGoal?.id;
            if (gid === before) return;
            linkToGoal(gid, gk, id);
            props.onChange?.();
            const to = getGoals().find((g) => g.id === gid);
            notify(`${before ? 'Moved' : 'Added'} to ${to?.t ?? 'goal'}.`, {
              undo: () => {
                if (before) linkToGoal(before, gk, id);
                else unlinkFromGoal(gk, id);
                props.onChange?.();
              },
            });
          }}
        />
      ) : null}
    </>
  );
}

/* The popover. Placed under the button's right edge, flipped above when it
   would run off the bottom, clamped inside the screen on both sides. */
function MenuPop({ anchor, entries, onClose }: { anchor: HTMLElement | null; entries: MenuEntry[]; onClose: () => void }) {
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor || !pop.current) return;
    const r = anchor.getBoundingClientRect();
    const w = pop.current.offsetWidth;
    const h = pop.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + 6;
    if (top + h > vh - 8) top = Math.max(8, r.top - h - 6);
    const left = Math.min(Math.max(8, r.right - w), vw - w - 8);
    setPos({ top, left });
  }, [anchor]);
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);
  return createPortal(
    <>
      <div
        className="imScrim"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        ref={pop}
        className="imPop"
        role="menu"
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {entries.length === 0 ? <div className="imEmpty">Nothing to do here yet.</div> : null}
        {entries.map((en, i) => (
          <button
            key={en.label + i}
            role="menuitem"
            className={'imItem' + (en.danger ? ' danger' : '') + (en.soon ? ' soon' : '')}
            onClick={() => {
              onClose();
              en.onClick();
            }}
          >
            {en.label}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}

/* Dialogs in the app's own `.dlg` look — never window.confirm/prompt. */
function Dlg({ children, onCancel, wide }: { children: ReactNode; onCancel: () => void; wide?: boolean }) {
  return createPortal(
    <>
      <div className="dlgScrim" onClick={onCancel} />
      <div className={'dlg' + (wide ? ' dlgWide' : '')} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </>,
    document.body,
  );
}

export function PromptDialog({
  title,
  value,
  ok,
  placeholder,
  multiline,
  footer,
  onOk,
  onCancel,
}: {
  title: string;
  value: string;
  ok: string;
  placeholder?: string;
  multiline?: boolean;
  /** Something under the field, above the buttons. */
  footer?: ReactNode;
  onOk: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(value);
  return (
    <Dlg onCancel={onCancel}>
      <div className="dlgTitle">{title}</div>
      {multiline ? (
        <textarea className="sinput dlgField" rows={4} autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} aria-label={title} />
      ) : (
        <input
          className="sinput dlgField"
          autoFocus
          value={v}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOk(v);
            if (e.key === 'Escape') onCancel();
          }}
          aria-label={title}
        />
      )}
      {footer}
      <div className="dlgBtns">
        <button className="dlgCancel" onClick={onCancel}>
          Cancel
        </button>
        <button className="dlgOk" onClick={() => onOk(v)}>
          {ok}
        </button>
      </div>
    </Dlg>
  );
}

export function ConfirmDialog({
  title,
  body,
  ok,
  onOk,
  onCancel,
}: {
  title: string;
  body: string;
  ok: string;
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <Dlg onCancel={onCancel}>
      <div className="dlgTitle">{title}</div>
      <div className="dlgBody">{body}</div>
      <div className="dlgBtns">
        <button className="dlgCancel" onClick={onCancel}>
          Cancel
        </button>
        <button className="dlgDanger" onClick={onOk}>
          {ok}
        </button>
      </div>
    </Dlg>
  );
}

export interface PickRow {
  id: string;
  label: string;
  sub?: string;
}

/* A searchable list in a dialog: pick a project, pick an item to link. */
export function PickDialog({
  title,
  rows,
  empty,
  onPick,
  onCancel,
}: {
  title: string;
  rows: PickRow[];
  empty: string;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState('');
  const hits = rows.filter((r) => !q.trim() || (r.label + ' ' + (r.sub ?? '')).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dlg onCancel={onCancel} wide>
      <div className="dlgTitle">{title}</div>
      {rows.length > 6 ? (
        <input
          className="sinput dlgField"
          autoFocus
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          aria-label="Search"
        />
      ) : null}
      <div className="pickList">
        {hits.map((r) => (
          <button key={r.id} className="pickRow" onClick={() => onPick(r.id)}>
            <span className="pickLabel">{r.label}</span>
            {r.sub ? <span className="pickSub">{r.sub}</span> : null}
          </button>
        ))}
        {rows.length === 0 ? <div className="pickEmpty">{empty}</div> : hits.length === 0 ? <div className="pickEmpty">Nothing matches.</div> : null}
      </div>
      <div className="dlgBtns">
        <button className="dlgCancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Dlg>
  );
}

/* The line on a linked item that leads back to its project. */
export function ProjectChip({ k, id }: { k: LinkKind; id: string }) {
  const { go } = useNav();
  const p = projectOf(k, id);
  if (!p) return null;
  return (
    <button
      className="pjChip"
      onClick={(e) => {
        e.stopPropagation();
        go('project', p.id);
      }}
    >
      <span className="m">Project</span> {p.n}
    </button>
  );
}
