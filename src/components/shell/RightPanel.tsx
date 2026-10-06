import { Icon } from './icons';
import type { PanelView } from '../../nav';

/** A reference attached to the conversation — the mockup's `S.refs` entry. */
export interface Ref {
  label: string;
  icon: string;
  /** A data URL, when the reference is something you can look at — the photo the
   *  paperclip read. The mockup shows the same thumbnail in its attach chip
   *  (line 1664), so a photo reads as a photo and not as a filename. */
  url?: string;
}

const TABS: { id: PanelView; label: string; icon: string }[] = [
  { id: 'context', label: 'Context', icon: 'ctx' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'preview', label: 'Preview', icon: 'eye' },
];

interface RightPanelProps {
  open: boolean;
  view: PanelView;
  onView: (view: PanelView) => void;
  onClose: () => void;
  /** Opens it again from the corner handle. */
  onToggle: () => void;
  refs: Ref[];
  onDetach: (label: string) => void;
}

/** The right panel — a new surface, not in the mockup.
 *
 *  The mockup answers "what is Eumae reading?" with the `#refs` strip pinned
 *  above the composer, which is fine for one line of pills and has nowhere to
 *  put anything else. Promoting that strip to a panel keeps the same answer and
 *  buys room for the other half of the question — what came *out* of it.
 *
 *  Context is the only reading with real data today. Code and Preview are
 *  honest empties: Studio owns artifacts, so they stay empty until an artifact
 *  exists to show, rather than inventing a sandbox nothing feeds. */
export default function RightPanel({ open, view, onView, onClose, onToggle, refs, onDetach }: RightPanelProps) {
  return (
    <>
      <div className={`pscrim${open ? ' open' : ''}`} onClick={onClose} />

      {/* The panel's door, on the panel's side. Desktop has no top bar to hang a
          control from and the rail is at the far end of the screen — so it sits
          in the top-right corner, on every tab, and steps aside once you're in.
          The ✕ in the panel's own head is the way back out. */}
      {!open ? (
        <button
          className="pHandle"
          onClick={onToggle}
          aria-label="Open panel"
          title="Context, code, and preview"
        >
          <Icon name="panel" />
        </button>
      ) : null}

      <aside className={`panel${open ? ' open' : ''}`} aria-label="Panel" aria-hidden={!open}>
        <div className="pHead">
          <div className="ptabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={view === t.id}
                className={`ptab${view === t.id ? ' on' : ''}`}
                onClick={() => onView(t.id)}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <button className="pX" onClick={onClose} aria-label="Close panel">
            <Icon name="x" />
          </button>
        </div>

        {view === 'context' ? (
          <div className="pBody">
            <div className="pSec">
              <div className="pGrp">In this conversation</div>
              {refs.length ? (
                <div className="pList">
                  {refs.map((r) => (
                    <div key={r.label} className="pItem">
                      {r.url ? (
                        <img className="pThumb" src={r.url} alt="" />
                      ) : (
                        <Icon name={r.icon} />
                      )}
                      <span className="g">{r.label}</span>
                      <button
                        className="pRm"
                        onClick={() => onDetach(r.label)}
                        aria-label={`Detach ${r.label}`}
                        title="Detach"
                      >
                        <Icon name="x" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pEmptyN">
                  Nothing attached. Use the <b>+</b> on the composer to bring in a file or an item.
                </p>
              )}
            </div>

            <div className="pSec">
              <div className="pGrp">Always in context</div>
              <div className="pList">
                <div className="pItem">
                  <Icon name="fol" />
                  <span className="g">Your projects</span>
                </div>
                <div className="pItem">
                  <Icon name="clk" />
                  <span className="g">Today &amp; this week</span>
                </div>
                <div className="pItem">
                  <Icon name="chat" />
                  <span className="g">Recent conversations</span>
                </div>
              </div>
              <p className="pNote">Eumae reads these every turn, so you never have to attach them.</p>
            </div>
          </div>
        ) : (
          <div className="pBody">
            <div className="pEmpty">
              <Icon name={view === 'code' ? 'code' : 'eye'} />
              <p className="pEmptyT">{view === 'code' ? 'No code yet' : 'Nothing to preview'}</p>
              <p className="pEmptyN">
                {view === 'code'
                  ? 'Code appears here when a Studio artifact produces one. This panel reads what exists — it does not invent it.'
                  : 'Preview appears here when there is something to render: an artifact, a page, a document.'}
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
