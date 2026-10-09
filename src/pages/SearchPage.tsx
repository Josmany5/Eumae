import { useState } from 'react';
import { useNav } from '../nav';
import { Icon } from '../components/shell/icons';
import type { TabId } from '../components/shell/TabBar';

/**
 * The first real sub-page, and the proof that the back button works.
 *
 * It searches the app's genuine destinations — not mock rows. It grows for
 * free: add a tab in SCREENS/LABELS or a page in PAGES and it shows up here.
 */
interface Dest {
  id: string;
  label: string;
  kind: 'Tab' | 'Settings';
  icon: string;
}

const DESTS: Dest[] = [
  { id: 'chat', label: 'Chat', kind: 'Tab', icon: 'chat' },
  { id: 'console', label: 'Console', kind: 'Tab', icon: 'clk' },
  { id: 'studio', label: 'Studio', kind: 'Tab', icon: 'zap' },
  { id: 'library', label: 'Library', kind: 'Tab', icon: 'fol' },
  { id: 'classroom', label: 'Classroom', kind: 'Tab', icon: 'cap' },
  { id: 'guild', label: 'Guild', kind: 'Tab', icon: 'bel' },
  { id: 'settings', label: 'Settings', kind: 'Settings', icon: 'gear' },
];

export default function SearchPage() {
  const nav = useNav();
  const [q, setQ] = useState('');

  const term = q.trim().toLowerCase();
  const hits = term ? DESTS.filter((d) => d.label.toLowerCase().includes(term)) : DESTS;

  const open = (d: Dest) => {
    if (d.kind === 'Settings') {
      nav.openSettings();
    } else {
      nav.goTab(d.id as TabId);
    }
  };

  return (
    <div className="page">
      <input
        id="search-input"
        autoFocus
        className="sinput"
        placeholder="Search Eumae"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {hits.length === 0 ? (
        <div className="empty">Nothing matches &ldquo;{q.trim()}&rdquo;.</div>
      ) : (
        <div className="sg">
          {hits.map((d) => (
            <button key={d.id} className="sr" onClick={() => open(d)}>
              <Icon name={d.icon} />
              <span className="g">{d.label}</span>
              <span className="v">{d.kind}</span>
            </button>
          ))}
        </div>
      )}

      <p className="note">Results grow as pages land — these are the app&rsquo;s real destinations.</p>
    </div>
  );
}