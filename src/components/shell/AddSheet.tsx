import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { useMedia } from '../../useMedia';
import { useNav, type Model, type Mode, type Thinking } from '../../nav';
import { logEv } from '../../log';

/** The composer's `+` window — the mockup's `plusSh()`, "Add to this chat"
 *  (line 1280).
 *
 *  Worth being exact about what this is, because it is not the attach list: five
 *  sections decide *how* Eumae answers — Mode, Role, Skill, Thinking, Model — and
 *  nothing else. Setting the chat up is the whole job of `+`; bringing a file in
 *  is the paperclip's (§4.3, §4.13). Its Context section was retired in Phase 5
 *  and its "Scope to a project" row went back to the rail, where a scope has a
 *  door again — so the two controls no longer meet in the same room.
 *
 *  Phase 5 also made it the window Settings already is, rather than the bottom
 *  sheet of five stacked sections it used to be: a phone gets a full sheet it
 *  swipes away, a desktop gets a scrim and a modal whose left rail *is* the list,
 *  each row carrying that setting's live value — the same read-out Settings' rows
 *  give with "Free" / "Dark" / "$0.00". That is what keeps the window one screen
 *  tall: you can read the whole turn off the rail before opening anything, and
 *  the chip row above the input reads it back from the other end. `useMedia`
 *  picks the shape, and the rail only exists at desktop width, exactly as
 *  Settings' does.
 *
 *  Every choice closes the window, exactly as the mockup's `cSh()` does on pick. */

const MODES: { id: Mode; desc: string }[] = [
  { id: 'Ask', desc: 'Just talk, plan, decide' },
  { id: 'Build', desc: 'Make something — drafts land in Studio' },
  { id: 'Learn', desc: 'Lessons and explanations' },
];

/** The mockup's ROLEDEF (line 1269). The mockup then appends your own roles
 *  from `S.roles9`; ours arrive with the Studio work, so "Create your own…" is
 *  the last row here and there is nothing yet to list after it. */
const ROLES = ['Default', 'Coach', 'Teacher', 'Sparring partner'];

const THINKING: Thinking[] = ['Quick', 'Balanced', 'Deep'];

const MODELS: { id: Model; desc: string }[] = [
  { id: 'Auto', desc: 'The router picks' },
  { id: 'Fast', desc: 'Cheapest quick answer' },
  { id: 'Best', desc: 'Strongest model, costs more' },
];

/** The whole window, in one sentence — the mockup's own tip (line 1290), which
 *  is still true now that the window is a window. Rendered twice because the two
 *  shapes need it in two places (the rail's foot at desktop width, the end of the
 *  list on a phone), but written once so the two can't say different things. */
const TIP = (
  <p className="shTip">
    Tip: type / in the composer to open this. Mode switches on its own when you ask — the chips
    above the input always show what&rsquo;s live.
  </p>
);
/** The five sections, in the order the rail and the phone list show them. Each
 *  one's live value is read off `turn` at render, which is what makes the rail a
 *  read-out and not a second menu. */
type Section = 'mode' | 'role' | 'skill' | 'thinking' | 'model';

const LABELS: Record<Section, string> = {
  mode: 'Mode',
  role: 'Role',
  skill: 'Skill',
  thinking: 'Thinking',
  model: 'Model',
};

interface AddSheetProps {
  open: boolean;
  onClose: () => void;
  /** The Role section's "+ Create your own…" row. Attaching is not a row in here
   *  any more (I2), so the paperclip is where a file comes in and this window has
   *  no file handler to be handed. */
  onCreateRole: () => void;
}

/** One choice — the mockup's `rd` (line 1281): the label on the left, a check
 *  on the right when it's the live one. */
function Row({
  label,
  desc,
  on,
  onClick,
}: {
  label: string;
  desc?: string;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="sr" onClick={onClick} aria-pressed={!!on}>
      <span className="g">
        <b>{label}</b>
        {desc ? <span className="d">{desc}</span> : null}
      </span>
      {on ? (
        <span className="ch">
          <Icon name="chk" />
        </span>
      ) : null}
    </button>
  );
}
export default function AddSheet({ open, onClose, onCreateRole }: AddSheetProps) {
  const { turn, setTurn } = useNav();

  /** Phone: it opens on the list of five. Desktop: the rail *is* that list, so it
   *  opens on the first section. The same rule, and the same breakpoint, as
   *  Settings — but the state starts *from* the width rather than from `'main'`,
   *  so the pane is never empty for the frame before the effect below runs (a
   *  frame the SSR check can see, and a flash the eye cannot). The effect is still
   *  what resets it: on every reopen, and on a resize while the window is open. */
  const isDesktop = useMedia('(min-width:900px)');
  const [view, setView] = useState<Section | 'main'>(() => (isDesktop ? 'mode' : 'main'));
  useEffect(() => {
    if (open) setView(isDesktop ? 'mode' : 'main');
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /** Pick one, and the window is done — the chip above the input is the receipt,
   *  the log is the record. Each row says what it set, so the Logs pane reads as
   *  a sentence and not as a code. */
  const pick = (patch: Partial<typeof turn>, text: string) => () => {
    setTurn(patch);
    logEv({ area: 'Chat', text });
    onClose();
  };

  /** The rail's rows and the phone list's rows — one list, two shapes: the five
   *  settings with what each is set to right now. Skill shows no value at all
   *  while nothing is picked, because there are no skills to pick yet, so a bare
   *  row is the honest one rather than a word ("None") this window cannot offer a
   *  way back from. Role does carry a value at its default, because Default is a
   *  choice the mockup lets you set it back to (line 1284). */
  const rail: { id: Section; label: string; value: string }[] = [
    { id: 'mode', label: LABELS.mode, value: turn.mode },
    { id: 'role', label: LABELS.role, value: turn.role || 'Default' },
    { id: 'skill', label: LABELS.skill, value: turn.skill },
    { id: 'thinking', label: LABELS.thinking, value: turn.thinking },
    { id: 'model', label: LABELS.model, value: turn.model },
  ];

  /* One back rule for both shapes: on a phone a section goes back to the list and
     the list closes the window; at desktop width the ✕ is a plain close, because
     the rail never leaves the screen. Settings' own rule. */
  const back = () => (isDesktop || view === 'main' ? onClose() : setView('main'));
  const onBackdrop = (e: React.MouseEvent) => {
    if (isDesktop && e.target === e.currentTarget) onClose();
  };

  /** One section's list — the five that used to be stacked in a single scroll of a
   *  bottom sheet, now one at a time behind the rail. */
  const body = (id: Section) => {
    if (id === 'mode') {
      return (
        <div className="sg">
          {MODES.map((m) => (
            <Row
              key={m.id}
              label={m.id}
              desc={m.desc}
              on={turn.mode === m.id}
              onClick={pick({ mode: m.id }, `Set mode to ${m.id}`)}
            />
          ))}
        </div>
      );
    }

    if (id === 'role') {
      return (
        <div className="sg">
          {ROLES.map((r) => (
            <Row
              key={r}
              label={r}
              /* '' is this app's spelling of the mockup's "Default": its picker
                 opens on '' (1218), its checkmark tests `ROLE9 || "Default"`
                 (1284), and picking the Default row writes the literal word.
                 Keeping one spelling means the chip hides Default the same way
                 the mockup's does (1270) and a request sends no Role line at all
                 rather than "Role: Default." (request.ts). */
              on={(turn.role || 'Default') === r}
              onClick={pick({ role: r === 'Default' ? '' : r }, `Set role to ${r}`)}
            />
          ))}
          <button
            className="sr"
            onClick={() => {
              onClose();
              onCreateRole();
            }}
          >
            <span className="g">+ Create your own…</span>
          </button>
        </div>
      );
    }

    if (id === 'skill') {
      /* The mockup renders your turned-on skills here and falls back to this line
         when there are none (line 1285). There are none yet — the Skills screen is
         where they'll be turned on — so this is the whole section for now, and it
         is the mockup's own sentence, not mine. */
      return (
        <div className="sg">
          <p className="shEmpty">No skills turned on. Manage them in Settings → Skills.</p>
        </div>
      );
    }

    if (id === 'thinking') {
      return (
        <div className="sg">
          {THINKING.map((t) => (
            <Row
              key={t}
              label={t}
              on={turn.thinking === t}
              onClick={pick({ thinking: t }, `Set thinking to ${t}`)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="sg">
        {MODELS.map((m) => (
          <Row
            key={m.id}
            label={m.id}
            desc={m.desc}
            on={turn.model === m.id}
            onClick={pick({ model: m.id }, `Set model to ${m.id}`)}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className={`addWin${open ? ' open' : ''}`}
      onClick={onBackdrop}
      role="dialog"
      aria-label="Add to this chat"
    >
      {/* The `.smodal`/`.spanel`/`.stabs`/`.shead`/`.sbody` skeleton is Settings'
          own, on purpose: twenty-odd rules that describe one overlay shape, and a
          second copy of them here would be a second thing to keep in step. Only
          the container is `.addWin`, for its name and its z-index (below
          Settings' 50, so the two overlays can never fight over the same slot). */}
      <div className="smodal">
        {/* The rail — desktop only, and the reason the window is one screen tall:
            it is the list, with each setting's live value on it. */}
        {isDesktop && (
          <aside className="stabs">
            <div className="stScroll">
              <div className="stGroup">How Eumae answers</div>
              {rail.map((s) => (
                <button
                  key={s.id}
                  className={`stab${view === s.id ? ' on' : ''}`}
                  onClick={() => setView(s.id)}
                >
                  <span className="g">{s.label}</span>
                  {s.value ? <span className="v">{s.value}</span> : null}
                </button>
              ))}
            </div>
            <div className="stFoot">{TIP}</div>
          </aside>
        )}

        <div className="spanel">
          <div className="shead">
            <button className="hb" onClick={back} aria-label={isDesktop ? 'Close' : 'Back'}>
              <Icon name={isDesktop ? 'x' : 'bk'} />
            </button>
            <div className="tt">{view === 'main' ? 'Add to this chat' : LABELS[view]}</div>
            <div className="sp" />
          </div>

          <div className="sbody">
            {/* Phone only: the list of five, which is the whole window on the way
                in — a row opens its own section. The rail does this job at desktop
                width, so this list exists in exactly one of the two shapes. */}
            {view === 'main' && !isDesktop && (
              <>
                <h3 className="sec">How Eumae answers</h3>
                <div className="sg">
                  {rail.map((s) => (
                    <button key={s.id} className="sr" onClick={() => setView(s.id)}>
                      <span className="g">{s.label}</span>
                      {s.value ? <span className="v m">{s.value}</span> : null}
                    </button>
                  ))}
                </div>
                {TIP}
              </>
            )}

            {view !== 'main' && body(view)}
          </div>
        </div>
      </div>
    </div>
  );
}

