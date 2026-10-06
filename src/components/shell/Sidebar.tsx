import { TABS, type TabId } from './TabBar';
import { PAGE_MENU } from './pageMenu';
import { Icon } from './icons';

interface SidebarProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
  onSettings: () => void;
  onSearch: () => void;
  onPick: (label: string) => void;
  onCollapse: () => void;
}

/** The desktop rail. The mockup's two levels in one column: Search at the top
 *  (where the mockup's drawer puts it), then the six global tabs, then the
 *  current page's own menu. Collapsing leaves the six and Settings. */
export default function Sidebar({
  active,
  onSelect,
  onSettings,
  onSearch,
  onPick,
  onCollapse,
}: SidebarProps) {
  return (
    <aside className="sb">
      <div className="sbHead">
        <span className="sbMark">Eumae</span>
        {/* No panel toggle here. It used to sit next to this button — two
            panel-shaped icons at the top-left of the window, one of them opening
            something on the far right. The panel's door is in the top-right
            corner of the screen now (.pHandle). */}
        <button className="sbIcon" onClick={onCollapse} aria-label="Toggle sidebar" title="Toggle sidebar">
          <Icon name="side" />
        </button>
      </div>

      <div className="sbSearch">
        <button className="sbItem" onClick={onSearch} title="Search">
          <Icon name="sea" />
          <span className="g">Search</span>
        </button>
      </div>

      <div className="sbSep" />

      <nav className="sbNav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`sbItem${active === t.id ? ' on' : ''}`}
            onClick={() => onSelect(t.id)}
            title={t.label}
          >
            <Icon name={`tab-${t.id}`} />
            <span className="g">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="sbSep" />

      <div className="sbPanel">
        {PAGE_MENU[active].map((s, i) => (
          <div key={s.heading ?? i}>
            {s.heading ? <div className="sbSect">{s.heading}</div> : null}
            {s.items.length === 0 ? (
              <div className="sbEmpty">{s.empty ?? 'Nothing here yet'}</div>
            ) : (
              s.items.map((it) => (
                <button key={it.label} className="sbItem" onClick={() => onPick(it.label)} title={it.label}>
                  <Icon name={it.icon} />
                  <span className="g">{it.label}</span>
                </button>
              ))
            )}
          </div>
        ))}
      </div>

      <div className="sbFoot">
        <button className="sbItem" onClick={onSettings} title="Settings">
          <Icon name="gear" />
          <span className="g">Settings</span>
        </button>
      </div>
    </aside>
  );
}
