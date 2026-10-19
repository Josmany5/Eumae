import { fmtListTime } from '../../stamp';
import { TABS, type TabId } from './TabBar';
import { PAGE_MENU } from './pageMenu';
import { Icon } from './icons';
import { downloadThread, type Thread } from '../../threads';
import { ItemMenu } from '../ItemMenu';

interface SidebarProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
  onSettings: () => void;
  onSearch: () => void;
  onPick: (label: string) => void;
  onCollapse: () => void;
  threads: Thread[];
  currentThreadId: string | null;
  onThreadPick: (id: string) => void;
  onNewChat: () => void;
  onThreadDelete: (id: string) => void;
  onThreadRename: (id: string, title: string) => void;
}

/** The desktop rail. The mockup's two levels in one column: Search at the top
 *  (where the mockup's drawer puts it), then the six global tabs, then the
 *  current page's own menu. Collapsing leaves the six and Settings. Recent
 *  chats render as live thread rows (not the menu's empty placeholder): the
 *  rail is the drawer's desktop twin, and history must be visible wherever
 *  the person looks for it. */
export default function Sidebar({
  active,
  onSelect,
  onSettings,
  onSearch,
  onPick,
  onCollapse,
  threads,
  currentThreadId,
  onThreadPick,
  onNewChat,
  onThreadDelete,
  onThreadRename,
}: SidebarProps) {
  return (
    <aside className="sb">
      <div className="sbHead">
        <span className="sbMark">Eumae</span>
        {/* No panel toggle here. It used to sit next to this button — two
            panel-shaped icons at the top-left of the window, one of them opening
            something on the far right. The panel's door is in the top-right
            corner of the screen now (.pHandle). */}
        <button className="sbIcon sbSearchIc" onClick={onSearch} aria-label="Search" title="Search">
          <Icon name="sea" />
        </button>
        <button className="sbIcon" onClick={onCollapse} aria-label="Toggle sidebar" title="Toggle sidebar">
          <Icon name="side" />
        </button>
      </div>

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
            {/* Recent chats is live threads, not menu rows: same data as the
                phone drawer's swipe list. Each row carries the same ⋯ as
                the drawer (Rename, Export, Delete with Undo), shown on hover,
                focus and the open chat. New chat opens a fresh thread; a row
                switches to it. */}
            {s.heading === 'Recent chats' && active === 'chat' ? (
              <>
                <button className="sbItem" onClick={onNewChat} title="New chat">
                  <Icon name="pls" />
                  <span className="g">New chat</span>
                </button>
                {threads.length === 0 ? (
                  <div className="sbEmpty">No chats yet</div>
                ) : (
                  threads.slice(0, 12).map((t: Thread) => (
                    <div key={t.id} className={`imWrap sbThread${t.id === currentThreadId ? ' on' : ''}`}>
                      <button
                        className={`sbItem${t.id === currentThreadId ? ' on' : ''}`}
                        onClick={() => onThreadPick(t.id)}
                        title={t.title}
                      >
                        <Icon name="chat" />
                        <span className="g">{t.title}</span>
                        <span className="thMeta">{t.from ? `${t.messages.length} messages · ` : ''}{fmtListTime(t.updatedAt)}</span>
                      </button>
                      <ItemMenu
                        name={t.title}
                        open={() => onThreadPick(t.id)}
                        rename={{ value: t.title, title: 'Rename chat', save: (v) => onThreadRename(t.id, v) }}
                        extra={[{ label: 'Export', onClick: () => downloadThread(t.id) }]}
                        onDelete={() => onThreadDelete(t.id)}
                      />
                    </div>
                  ))
                )}
              </>
            ) : s.items.length === 0 ? (
              <div className="sbEmpty">{s.empty ?? 'Nothing here yet'}</div>
            ) : (
              s.items.map((it) => (
                <button key={it.label} className="sbItem" onClick={() => onPick(it.label)} title={it.label}>
                  <Icon name={it.icon} />
                  <span className={'g' + (it.soon ? ' soon' : '')}>{it.label}</span>
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
