import { Icon } from '../components/shell/icons';
import { EumaeIcon } from '../components/shell/Header';
import type { TabId } from '../components/shell/TabBar';
import type { PanelView } from '../nav';
import { getTasks } from '../tasks';
import { isOverdue } from '../due';
import { allSbx } from '../sandbox';
import { useSbx } from '../components/SandboxView';
import { useSkin } from '../skin';

/** Where a tile goes: a tab (plus an optional page on it), the office, or Soon. */
export type HomeDest =
  | { tab: TabId; page?: string; arg?: unknown }
  | { office: PanelView }
  | { settings: true }
  /* A page Eumae made, opened from its tile (his ask, Oct 29: a widget you
     asked for is a new app on this screen, not a line in a chat log). */
  | { sbx: string }
  | { soon: string };

export interface Tile {
  n: string;
  icon?: string;
  /** Shows today's date in the tile instead of an icon (Calendar). */
  date?: boolean;
  to: HomeDest;
  badge?: number;
}

export interface Section {
  n: string;
  /** The space whose accent colors the section (existing palette only). */
  sp: 'chat' | 'console' | 'studio' | 'library' | 'classroom' | 'guild' | 'grey';
  tiles: Tile[];
}

export function homeSections(overdue = 0): Section[] {
  return [
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
}

  /* Each tile takes its own space's color where it has one (Library green,
     Classroom teal…), else its section's. */
export function tileSpace(t: Tile, s: Section): string {
    if ('tab' in t.to && t.to.tab !== 'console') return t.to.tab;
    if ('settings' in t.to) return 'grey';
    return s.sp;
}


export function TileIcon({ t }: { t: Tile }) {
  return t.date ? <b className="hmDate">{new Date().getDate()}</b> : t.icon === 'eumae' ? <EumaeIcon /> : <Icon name={t.icon!} />;
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen({ onOpen, onSearch }: { onOpen: (d: HomeDest, name: string) => void; onSearch: () => void }) {
  const skin = useSkin();
  const now = new Date();
  /* Re-render when a page is made in chat, so it is on this screen by the time
     they close the Sandbox. */
  useSbx();
  const overdue = getTasks().filter((t) => !t.d && isOverdue(t, now)).length;

  /* What they made, above everything: the point of this screen is that the
     thing you asked for is an app here, one tap away. Six is what fits a
     phone's grid without turning it into a list. */
  const made = allSbx();
  const madeSection: Section | null = made.length
    ? {
        n: 'Made by you',
        sp: 'studio',
        tiles: made.slice(0, 6).map((x) => ({ n: x.title || 'Untitled', icon: 'zap', to: { sbx: x.id } })),
      }
    : null;

  const sections = madeSection ? [madeSection, ...homeSections(overdue)] : homeSections(overdue);

  return (
    <div className="hm" data-skin={skin ?? undefined}>
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
                <button key={t.n} className={'hmTile' + (soon ? ' soon' : '')} onClick={() => onOpen(t.to, t.n)}>
                  <span className={'hmIc sp-' + tileSpace(t, s)}>
                    <TileIcon t={t} />
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
