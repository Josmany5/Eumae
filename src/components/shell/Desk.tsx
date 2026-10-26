import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { homeSections, tileSpace, TileIcon, type Tile } from '../../screens/HomeScreen';
import { getTasks } from '../../tasks';
import { isOverdue } from '../../due';

/* Desktop Home (his mockup, Oct 26): a top bar, apps on the desktop, the open
   app in a window, Eumae's window beside it, and a dock. Everything here only
   draws; App decides what a tap opens. */

type Placed = { t: Tile; sp: string };

function allTiles(): Placed[] {
  const now = new Date();
  const overdue = getTasks().filter((t) => !t.d && isOverdue(t, now)).length;
  return homeSections(overdue).flatMap((s) => s.tiles.filter((t) => !('soon' in t.to)).map((t) => ({ t, sp: tileSpace(t, s) })));
}

/** The dock's own apps, in the mockup's order; open ones not here join after. */
const DOCK = ['Today', 'Tasks', 'Calendar', 'Goals', 'Studio', 'Library', 'Classroom', 'Guild', 'Eumae'];

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function DeskBar({ app, onSearch }: { app: string; onSearch: () => void }) {
  const now = useClock();
  const day = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="dkBar">
      <b>Eumae</b>
      <span className="m">{app}</span>
      <span className="sp" />
      <button className="dkSea" onClick={onSearch} aria-label="Search">
        <Icon name="sea" />
      </button>
      <span>{day}</span>
      <span>{time}</span>
    </div>
  );
}

export function DeskIcons({ onOpen }: { onOpen: (t: Tile) => void }) {
  return (
    <div className="dkIcons">
      {allTiles().map(({ t, sp }) => (
        <button key={t.n} className="hmTile" onClick={() => onOpen(t)}>
          <span className={'hmIc sp-' + sp}>
            <TileIcon t={t} />
            {t.badge ? <em className="hmBadge">{t.badge}</em> : null}
          </span>
          <span className="hmN">{t.n}</span>
        </button>
      ))}
    </div>
  );
}

export function Dock({ open, current, onOpen }: { open: string[]; current: string | null; onOpen: (t: Tile) => void }) {
  const tiles = allTiles();
  const list = [
    ...DOCK.map((n) => tiles.find((x) => x.t.n === n)).filter((x): x is Placed => !!x),
    ...tiles.filter((x) => !DOCK.includes(x.t.n) && open.includes(x.t.n)),
  ];
  return (
    <nav className="dock" aria-label="Dock">
      {list.map(({ t, sp }) => (
        <button key={t.n} onClick={() => onOpen(t)} aria-label={t.n} title={t.n} className={current === t.n ? 'on' : ''}>
          <span className={'hmIc sp-' + sp}>
            <TileIcon t={t} />
          </span>
          {open.includes(t.n) ? <i className="dot" /> : null}
        </button>
      ))}
    </nav>
  );
}

export function WinBar({ title, onClose, onMin, onZoom }: { title: string; onClose: () => void; onMin: () => void; onZoom: () => void }) {
  return (
    <div className="dkWin">
      <span className="dkLights">
        <button className="r" onClick={onClose} aria-label="Close" title="Close" />
        <button className="y" onClick={onMin} aria-label="Minimize" title="Minimize" />
        <button className="g" onClick={onZoom} aria-label="Full width" title="Full width" />
      </span>
      <b>{title}</b>
    </div>
  );
}
