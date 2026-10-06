import Sheet from './Sheet';
import { Icon } from './icons';
import { useNav, type Model, type Mode, type Thinking } from '../../nav';
import { logEv } from '../../log';

/** The composer's `+` menu — the mockup's `plusSh()`, titled "Add to this chat"
 *  (line 1280).
 *
 *  Worth being exact about what this is, because it is not the attach list:
 *  five sections decide *how* Eumae answers (Mode, Role, Skill, Thinking,
 *  Model) and one decides what it answers with (Context, and under it the two
 *  rows that reach a file and a project). Setting the chat up is the whole job
 *  of `+`; bringing a file in is the paperclip's, which is why the file row
 *  here opens the same input rather than a second one.
 *
 *  Every choice closes the sheet, exactly as the mockup's `cSh()` does on pick,
 *  and the chip above the input is where the result shows up. */

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

interface AddSheetProps {
  open: boolean;
  onClose: () => void;
  onPage: (page: 'role' | 'projects') => void;
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

export default function AddSheet({ open, onClose, onPage }: AddSheetProps) {
  const { turn, setTurn, pickFile } = useNav();

  /** Pick one, and the sheet is done — the chip above the input is the receipt,
   *  the log is the record. Each row says what it set, so the Logs pane reads as
   *  a sentence and not as a code. */
  const pick = (patch: Partial<typeof turn>, text: string) => () => {
    setTurn(patch);
    logEv({ area: 'Chat', text });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add to this chat">
      <h3 className="sec">Mode</h3>
      <div className="shGroup">
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

      <h3 className="sec">Role</h3>
      <div className="shGroup">
        {ROLES.map((r) => (
          <Row
            key={r}
            label={r}
            /* The mockup stores "Default" as '' and tests `ROLE9 || "Default"`,
               so the two spellings have to meet somewhere — this is it. */
            on={(turn.role || 'Default') === r}
            onClick={pick({ role: r === 'Default' ? '' : r }, `Set role to ${r}`)}
          />
        ))}
        <button
          className="sr"
          onClick={() => {
            onClose();
            onPage('role');
          }}
        >
          <span className="g">+ Create your own…</span>
        </button>
      </div>

      <h3 className="sec">Skill</h3>
      <div className="shGroup">
        {/* The mockup renders your turned-on skills here and falls back to this
            line when there are none (line 1285). There are none yet — the
            Skills screen is where they'll be turned on — so this is the whole
            section for now, and it is the mockup's own sentence, not mine. */}
        <p className="shEmpty">No skills turned on. Manage them in Settings → Skills.</p>
      </div>

      <h3 className="sec">Thinking</h3>
      <div className="shGroup">
        {THINKING.map((t) => (
          <Row key={t} label={t} on={turn.thinking === t} onClick={pick({ thinking: t }, `Set thinking to ${t}`)} />
        ))}
      </div>

      <h3 className="sec">Model</h3>
      <div className="shGroup">
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

      <h3 className="sec">Context</h3>
      <div className="shGroup">
        <button
          className="sr"
          onClick={() => {
            onClose();
            pickFile();
          }}
        >
          <span className="g">Attach a file…</span>
        </button>
        <button
          className="sr"
          onClick={() => {
            onClose();
            onPage('projects');
          }}
        >
          <span className="g">Scope to a project…</span>
        </button>
      </div>

      <p className="shTip">
        Tip: type / in the composer to open this. Mode switches on its own when you ask — the chip
        above the input always shows what&rsquo;s live.
      </p>
    </Sheet>
  );
}
