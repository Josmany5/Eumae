import { Icon } from './icons';
import { useLog } from '../../log';
import { useNav, type PanelView } from '../../nav';

const TABS: { id: PanelView; label: string; icon: string }[] = [
  { id: 'context', label: 'Context', icon: 'ctx' },
  /* The clock, because this reading is the log — the same thing the header's
     clock button opens. */
  { id: 'activity', label: 'Activity', icon: 'clk' },
  /* Studio's reading wears Studio's own glyph from the rail: it is that room's
     output, so it must not read as a second, unrelated one. */
  { id: 'studio', label: 'Studio', icon: 'tab-studio' },
];

interface RightPanelProps {
  open: boolean;
  view: PanelView;
  onView: (view: PanelView) => void;
  onClose: () => void;
  /** Opens it again from the corner handle. */
  onToggle: () => void;
}

/** The right panel — a new surface, not in the mockup.
 *
 *  The mockup answers "what is Eumae reading?" with the `#refs` strip pinned
 *  above the composer, which is fine for one line of pills and has nowhere to
 *  put anything else. Promoting that strip to a panel keeps the same answer and
 *  buys room for the two other questions a chat raises: what actually happened,
 *  and what came *out* of it.
 *
 *  Context and Activity are the two readings with real data today: what is in
 *  play, and what actually happened. Studio is an honest empty — Studio owns
 *  artifacts, so its sandbox stays empty until an artifact exists to show,
 *  rather than inventing a preview nothing feeds.
 *
 *  Refs and detach come from `useNav()` rather than props: this panel is one of
 *  two readers of that list, and the other one is the request built when a
 *  message is sent (src/request.ts), which no prop can reach. */
export default function RightPanel({ open, view, onView, onClose, onToggle }: RightPanelProps) {
  const { refs, detach } = useNav();
  /* The log's second reader, after Settings → Logs. Read on every render rather
     than only on the Activity reading, so the list is already correct the
     moment you switch to it and the log never has to be copied into state. */
  const logRows = useLog();

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
          title="Context, activity, and what you've built"
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
                        onClick={() => detach(r.label)}
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
        ) : view === 'activity' ? (
          <div className="pBody">
            <div className="pSec">
              <div className="pGrp">What happened</div>
              {/* The same log Settings → Logs reads, same rows, same dots — one
                  list with two doors, never two lists. */}
              {logRows.length ? (
                logRows.map((l) => (
                  <div className="hi" key={l.id}>
                    <span className={`dt ${l.status}`} />
                    <div className="s">
                      {l.text}
                      <div className="xs m">{l.area} · {l.ts}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="pEmptyN">
                  Nothing yet. Sending a message, attaching a file, or picking from the <b>+</b> menu
                  lands here.
                </p>
              )}
            </div>
            <p className="pNote">
              The whole app's one log, newest first, in this session only. Filter it by area in
              Settings → Logs.
            </p>
          </div>
        ) : (
          <div className="pBody">
            <div className="pEmpty">
              <Icon name="tab-studio" />
              <p className="pEmptyT">Nothing built yet</p>
              <p className="pEmptyN">
                Studio's sandbox appears here when an artifact produces something to look at — a page, a
                document, a chart. This panel reads what exists; it does not invent it.
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
