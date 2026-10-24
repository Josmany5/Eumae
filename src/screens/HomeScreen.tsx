import { Icon } from '../components/shell/icons';
import { EumaeIcon } from '../components/shell/Header';
import type { TabId } from '../components/shell/TabBar';
import type { PanelView } from '../nav';
import { getTasks } from '../tasks';
import { isOverdue } from '../due';

/** Where a tile goes: a tab (plus an optional page on it), the office, or Soon. */
export type HomeDest =
  | { tab: TabId; page?: string; arg?: unknown }
  | { office: PanelView }
  | { settings: true }
  | { soon: string };

interface Tile {
  n: string;
  icon?: string;
  /** Shows today's date in the tile instead of an icon (Calendar). */
  date?: boolean;
  to: HomeDest;
  badge?: number;
}

interface Section {
  n: string;
  /** The space whose accent colors the section (existing palette only). */
  sp: 'chat' | 'console' | 'studio' | 'library' | 'classroom' | 'guild' | 'grey';
  tiles: Tile[];
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen({ onOpen, onSearch }: { onOpen: (d: HomeDest) => void; onSearch: () => void }) {
  const now = new Date();
  const overdue = getTasks().filter((t) => !t.d && isOverdue(t, now)).length;

  const sections: Section[] = [
    {
      n: 'Intelligence',
      sp: 'chat',
      tiles: [
        { n: 'Eumae', icon: 'eumae', to: { tab: 'chat' } },
        { n: 'Agents', icon: 'zap', to: { soon: 'Agents' } },
        { n: 'Desk', icon: 'bel', to: { office: 'desk' } },
        { n: 'Logbook', icon: 'menu', to: { office: 'logbook' } },
      ],
    },
    {
      n: 'Productivity',
      sp: 'console',
      tiles: [
        { n: 'Today', icon: 'clk', to: { tab: 'console' } },
        { n: 'Tasks', icon: 'chk', to: { tab: 'console', page: 'tasks' }, badge: overdue },
        { n: 'Calendar', date: true, to: { tab: 'console', page: 'cal' } },
        { n: 'Notes', icon: 'ed', to: { tab: 'console', page: 'notes' } },
        { n: 'Goals', icon: 'ctx', to: { tab: 'console', page: 'goals' } },
        { n: 'Projects', icon: 'fol', to: { tab: 'console', page: 'projects' } },
        { n: 'Flows', icon: 'rgn', to: { tab: 'console', page: 'flows' } },
        { n: 'Habits', icon: 'tick', to: { soon: 'Habits' } },
      ],
    },
    {
      n: 'Create & learn',
      sp: 'studio',
      tiles: [
        { n: 'Studio', icon: 'img', to: { tab: 'studio' } },
        { n: 'Library', icon: 'arch', to: { tab: 'library' } },
        { n: 'Classroom', icon: 'cap', to: { tab: 'classroom' } },
        { n: 'Games', icon: 'vid', to: { soon: 'Games' } },
      ],
    },
    {
      n: 'People & you',
      sp: 'guild',
      tiles: [
        { n: 'Guild', icon: 'acc', to: { tab: 'guild' } },
        { n: 'Settings', icon: 'gear', to: { settings: true } },
      ],
    },
  ];

  /* Each tile takes its own space's color where it has one (Library green,
     Classroom teal…), else its section's. */
  const tileSpace = (t: Tile, s: Section): string => {
    if ('tab' in t.to && t.to.tab !== 'console') return t.to.tab;
    if ('settings' in t.to) return 'grey';
    return s.sp;
  };

  return (
    <div className="hm">
      <div className="hmHead">
        <h1>Eumae</h1>
        <button className="hb" onClick={onSearch} aria-label="Search">
          <Icon name="sea" />
        </button>
      </div>
      <p className="hmHi">
        {greeting(now)}.{overdue ? <> <b>{overdue}</b> overdue {overdue === 1 ? 'task needs' : 'tasks need'} you.</> : ' Nothing overdue.'}
      </p>
      {sections.map((s) => (
        <section key={s.n} className="hmSec">
          <div className="hmSecT">
            <i className={'hmDot sp-' + s.sp} />
            {s.n}
          </div>
          <div className="hmGrid">
            {s.tiles.map((t) => {
              const soon = 'soon' in t.to;
              return (
                <button key={t.n} className={'hmTile' + (soon ? ' soon' : '')} onClick={() => onOpen(t.to)}>
                  <span className={'hmIc sp-' + tileSpace(t, s)}>
                    {t.date ? <b className="hmDate">{now.getDate()}</b> : t.icon === 'eumae' ? <EumaeIcon /> : <Icon name={t.icon!} />}
                    {t.badge ? <em className="hmBadge">{t.badge}</em> : null}
                  </span>
                  <span className="hmN">{t.n}</span>
                  {soon ? <span className="hmSoon">Soon</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
