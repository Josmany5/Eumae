import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from './icons';
import type { TabId } from './TabBar';
import { logEv, useLog, type LogFiled } from '../../log';
import { useNav, type Mode, type Model, type PanelView, type Thinking } from '../../nav';
import { getRoles } from '../../roles';
import { getTasks } from '../../tasks';
import { eventsBetween, ymd } from '../../events';
import { streamChat } from '../../chat';
import { buildRequest, toApiBody } from '../../request';
import { createThread, getThread, saveThread, threadsChanged, type Msg, type Thread } from '../../threads';
import { msgId } from '../../boot';
import { timeLabels } from '../../stamp';
import { getTask } from '../../tasks';
import { getEvent } from '../../events';
import { useFocus, setFocus, getFocus, FOCUS_LABEL } from '../../focus';
import { ItemTab } from './ItemTab';
import { MaeIcon } from './Header';

/** Mae's office: the right panel on desktop, a peek bar and a sheet on a phone.
 *
 *  Every page's office is the same shape: Mae, the page's own tab, the Desk and
 *  the Logbook (eumae-right-panel.md, locked Oct 18). Chat has no Mae tab
 *  because the chat *is* Mae; Guild's Mae lives inside each huddle.
 *
 *  Nothing here pretends. The Desk stays empty until Mae can really notice and
 *  propose; the Logbook reads the app's one log, the memories you saved, and
 *  the permission rules from Settings. */

type OTab = { id: PanelView; label: string };

const OFFICE: Record<TabId, OTab[]> = {
  chat: [
    { id: 'context', label: 'Context' },
    { id: 'sandbox', label: 'Sandbox' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
  console: [
    { id: 'mae', label: 'Mae' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
  studio: [
    { id: 'mae', label: 'Mae' },
    { id: 'build', label: 'Build' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
  library: [
    { id: 'mae', label: 'Mae' },
    { id: 'details', label: 'Details' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
  classroom: [
    { id: 'mae', label: 'Mae' },
    { id: 'notes', label: 'My notes' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
  guild: [
    { id: 'huddles', label: 'Huddles' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
};

/** The reading this page can show: the one you were on if this page has it,
 *  otherwise the page's first tab. */
export function fitView(tab: TabId, view: PanelView, hasItem = false): PanelView {
  if (view === 'item' && hasItem) return 'item';
  const tabs = OFFICE[tab];
  return tabs.some((t) => t.id === view) ? view : tabs[0].id;
}

const AREA: Record<TabId, LogFiled> = {
  chat: 'Chat', console: 'Console', studio: 'Studio', library: 'Library', classroom: 'Classroom', guild: 'Guild',
};

/** Who Mae is on each page. Sent with every question asked from the office. */
const ROLE: Partial<Record<TabId, { name: string; intro: string; prompt: string; hint: string }>> = {
  console: {
    name: 'Planner',
    intro: 'I can see your open tasks and this week. Ask me what to do first, or to plan your day.',
    prompt: 'You are Mae acting as a planner on the Console page. Help the person decide what to do and when. Be brief and concrete.',
    hint: 'What should I do first?',
  },
  studio: {
    name: 'Coach',
    intro: 'Tell me what you want to make. I\'ll ask what I need and give you tips as you go.',
    prompt: 'You are Mae acting as a creative coach in Studio. Ask short questions that fill in a brief, give practical tips, and explain why choices work.',
    hint: 'Help me make a one-pager',
  },
  library: {
    name: 'Ask this file',
    intro: 'Ask me about your files. Open one and I\'ll focus on it.',
    prompt: 'You are Mae helping with the person\'s Library of files. Answer plainly. If they need a specific file, ask them to open it.',
    hint: 'Ask about your files',
  },
  classroom: {
    name: 'Tutor',
    intro: 'Ask me to explain anything from your lessons, or to quiz you.',
    prompt: 'You are Mae acting as a patient tutor in Classroom. Explain simply, check understanding with a short question, and never lecture at length.',
    hint: 'Explain this simply',
  },
};

/* Mae's office threads: one per page, saved as real chat threads (marked
   "<Page> office") so they show in the Chat list. The office keeps going on
   the same thread until it has been quiet for an hour; then it opens fresh
   and the old one stays in Chat. */
const FRESH_AFTER = 60 * 60 * 1000;
const officeKey = (tab: TabId) => 'eumae:office:' + tab;
const officeName = (tab: TabId) => tab[0].toUpperCase() + tab.slice(1);
function currentOfficeThread(tab: TabId): Thread | undefined {
  let id: string | null = null;
  try {
    id = localStorage.getItem(officeKey(tab));
  } catch {
    /* storage blocked */
  }
  const t = id ? getThread(id) : undefined;
  if (!t || Date.now() - t.updatedAt > FRESH_AFTER) return undefined;
  return t;
}
const tListeners = new Set<() => void>();
let tVersion = 0;
function bump() {
  tVersion++;
  tListeners.forEach((f) => f());
}
function useOfficeThread(tab: TabId): Thread | undefined {
  useSyncExternalStore(
    (f) => {
      tListeners.add(f);
      return () => {
        tListeners.delete(f);
      };
    },
    () => tVersion,
    () => tVersion,
  );
  return currentOfficeThread(tab);
}
function writeOffice(tab: TabId, t: Thread) {
  saveThread(t);
  try {
    localStorage.setItem(officeKey(tab), t.id);
  } catch {
    /* storage blocked */
  }
  bump();
}
function newOffice(tab: TabId) {
  try {
    localStorage.removeItem(officeKey(tab));
  } catch {
    /* storage blocked */
  }
  bump();
}
/** The item open in the office, as a line Mae can read. */
function focusContext(): string {
  const f = getFocus();
  if (!f) return '';
  if (f.k === 'task') {
    const t = getTask(f.id);
    return t ? `\n\nThe person has this task open: ${t.t}${t.due ? ` (due ${t.due}${t.tm ? ' ' + t.tm : ''})` : ''}.` : '';
  }
  if (f.k === 'event') {
    const e = getEvent(f.id);
    return e ? `\n\nThe person has this event open: ${e.t} on ${e.d}${e.tm ? ' at ' + e.tm : ''}${e.loc ? ' at ' + e.loc : ''}.` : '';
  }
  return f.k === 'day' ? `\n\nThe person is looking at ${f.id}.` : '';
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem('eumae:' + key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** What the planner can see: open tasks and the next seven days. */
function consoleContext(): string {
  const today = ymd(new Date());
  const open = getTasks()
    .filter((t) => !t.d)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
    .slice(0, 15)
    .map((t) => `- ${t.t}${t.due ? ` (due ${t.due}${t.tm ? ' ' + t.tm : ''}${t.due < today ? ', overdue' : ''})` : ''}`);
  const evs = eventsBetween(today, 7)
    .slice(0, 15)
    .map((e) => `- ${e.d} ${e.allDay ? 'all day' : e.tm}: ${e.t}`);
  return `\n\nOpen tasks:\n${open.join('\n') || '- none'}\n\nNext 7 days:\n${evs.join('\n') || '- nothing scheduled'}`;
}

function MaeTab({ tab }: { tab: TabId }) {
  const role = ROLE[tab]!;
  const { turn, switchThread, goTab } = useNav();
  const thread = useOfficeThread(tab);
  const list: Msg[] = thread?.messages ?? [];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const v = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    atBottomRef.current = v;
    setAtBottom(v);
  };
  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setAtBottom(true);
  };
  /* Follow new words only when you're already at the bottom. */
  useEffect(() => {
    if (atBottomRef.current) toBottom();
  }, [list]);
  /* The box grows with what's in it, up to about six lines. */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight + 2, 150) + 'px';
  }, [text]);
  const stamps = timeLabels(list.map((m) => m.ts));

  const send = () => {
    const q = text.trim();
    if (!q || busy) return;
    setText('');
    const base = thread ?? { ...createThread(), title: officeName(tab), from: officeName(tab) };
    const history = base.messages;
    const body = toApiBody(buildRequest(turn, [], q), history, null);
    body.data.systemPrompt += `\n\n${role.prompt}${tab === 'console' ? consoleContext() : ''}${focusContext()}`;
    const mine: Msg = { id: msgId(), role: 'you', text: q, ts: Date.now() };
    const replyId = msgId();
    const put = (reply: string, streaming: boolean) =>
      writeOffice(tab, { ...base, messages: [...history, mine, { id: replyId, role: 'eumae', text: reply, ts: Date.now(), streaming: streaming || undefined }] });
    put('', true);
    threadsChanged();
    atBottomRef.current = true;
    setBusy(true);
    void streamChat(body, (full) => put(full, true)).then((reply) => {
      setBusy(false);
      put(reply.ok ? reply.text : `I couldn't answer: ${reply.error}`, false);
      threadsChanged();
      if (!reply.ok) logEv({ area: AREA[tab], text: `Mae couldn't answer: ${reply.error}`, status: 'bad' });
    });
  };

  return (
    <div className="oMae">
      <div className="oMaeHead">
        <div className="flbl">Mae · {role.name}</div>
        {thread ? (
          <div className="oMaeActs">
            <button
              className="fb"
              onClick={() => {
                switchThread(thread.id);
                goTab('chat');
              }}
            >
              Open in Chat
            </button>
            <button className="fb" onClick={() => newOffice(tab)} disabled={busy}>
              New
            </button>
          </div>
        ) : null}
      </div>
      <div className="oThread" ref={scroller} onScroll={onScroll}>
        {list.length === 0 ? <p className="oIntro">{role.intro}</p> : null}
        {list.map((m, i) => (
          <Fragment key={m.id}>
            {stamps[i] ? <div className="imTime xs m">{stamps[i]}</div> : null}
            {m.role === 'you' ? (
              <div className="oMe">{m.text}</div>
            ) : (
              <div className="oMae1">
                <div className="n">Mae</div>
                {m.text || <span className="fsub">Thinking…</span>}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      <form
        className="oAsk"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {!atBottom ? (
          <button type="button" className="chatDown" onClick={toBottom} aria-label="Scroll to latest" title="Scroll to latest">
            <Icon name="dn" />
          </button>
        ) : null}
        <textarea
          ref={box}
          className="sinput oBox"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={role.hint}
          aria-label="Ask Mae"
        />
        <button className="oSend" type="submit" disabled={!text.trim() || busy} aria-label="Send">
          <Icon name="up" />
        </button>
      </form>
    </div>
  );
}

function Seg<T extends string>({ value, options, onPick }: { value: T; options: T[]; onPick: (v: T) => void }) {
  return (
    <div className="oseg" role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} className={o === value ? 'on' : ''} onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function ContextTab() {
  const { refs, detach, turn, setTurn } = useNav();
  const roles = ['Default', 'Coach', 'Teacher', 'Sparring partner', ...getRoles().map((r) => r.n)];
  const set = (patch: Partial<typeof turn>, text: string) => {
    setTurn(patch);
    logEv({ area: 'Chat', text });
  };
  return (
    <>
      <div className="flbl">Attached to this message</div>
      {refs.length ? (
        refs.map((r) => (
          <div key={r.label} className="frow">
            {r.url ? <img className="pThumb" src={r.url} alt="" /> : <Icon name={r.icon} />}
            <span className="ft">{r.label}</span>
            <button className="pRm" onClick={() => detach(r.label)} aria-label={`Detach ${r.label}`} title="Detach">
              <Icon name="x" />
            </button>
          </div>
        ))
      ) : (
        <p className="oIntro">Nothing attached. The paperclip on the composer brings in a photo or a PDF.</p>
      )}

      <div className="flbl">Always in context</div>
      <div className="frow"><span className="ft">Your projects</span></div>
      <div className="frow"><span className="ft">Today and this week</span></div>
      <div className="frow"><span className="ft">Recent conversations</span></div>

      <div className="flbl">How Mae answers</div>
      <div className="oPick">
        <span className="fsub">Mode</span>
        <Seg<Mode> value={turn.mode} options={['Ask', 'Build', 'Learn']} onPick={(v) => set({ mode: v }, `Mode set to ${v}`)} />
      </div>
      <div className="oPick">
        <span className="fsub">Role</span>
        <select
          className="selIn"
          value={turn.role || 'Default'}
          onChange={(e) => {
            const v = e.target.value;
            set({ role: v === 'Default' ? '' : v }, `Role set to ${v}`);
          }}
          aria-label="Role"
        >
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="oPick">
        <span className="fsub">Skill</span>
        <span className="fmeta">None yet</span>
      </div>
      <div className="oPick">
        <span className="fsub">Thinking</span>
        <Seg<Thinking> value={turn.thinking} options={['Quick', 'Balanced', 'Deep']} onPick={(v) => set({ thinking: v }, `Thinking set to ${v}`)} />
      </div>
      <div className="oPick">
        <span className="fsub">Model</span>
        <Seg<Model> value={turn.model} options={['Auto', 'Fast', 'Best']} onPick={(v) => set({ model: v }, `Model set to ${v}`)} />
      </div>
      <p className="oIntro">The same settings as the + window. Change them in either place.</p>
    </>
  );
}

function Empty({ title, note }: { title: string; note: string }) {
  return (
    <div className="oEmpty">
      <div className="ft">{title}</div>
      <p className="fsub">{note}</p>
    </div>
  );
}

function Desk() {
  return (
    <>
      <Empty
        title="Nothing on your desk"
        note="When Mae notices something or proposes a step, it lands here for your OK. Once it's done, it moves to the Logbook with a receipt and Undo."
      />
      <p className="oIntro">Mae can't notice or act on her own yet. That comes with the backend.</p>
    </>
  );
}

const GRANT_LABEL: Record<string, string> = {
  edit: 'Edit your items',
  file: 'Save files',
  calendar: 'Change your calendar',
  email: 'Send email',
  delete: 'Delete things',
};
const GRANT_VALUE: Record<string, string> = { always: 'Allowed', ask: 'Ask first', never: 'Never' };

function Logbook({ tab }: { tab: TabId }) {
  const { openSettings } = useNav();
  const [part, setPart] = useState<'Activity' | 'Memory' | 'Permissions'>('Activity');
  const rows = useLog(AREA[tab]);
  const mems = readStored<{ id: string; t: string }[]>('mems', []);
  const grants = readStored<Record<string, string>>('grants', {
    edit: 'always', file: 'always', calendar: 'ask', email: 'never', delete: 'never',
  });
  return (
    <>
      <Seg value={part} options={['Activity', 'Memory', 'Permissions']} onPick={setPart} />
      {part === 'Activity' ? (
        rows.length ? (
          <>
            <div className="flbl">{AREA[tab]} today</div>
            {rows.map((l) => (
              <div key={l.id} className="frow top">
                <span className={`dt ${l.status}`} />
                <span className="ft">{l.text}</span>
                <span className="fmeta">{l.ts}</span>
              </div>
            ))}
          </>
        ) : (
          <Empty title="Nothing yet" note={`What you and Mae do in ${AREA[tab]} shows up here, newest first.`} />
        )
      ) : part === 'Memory' ? (
        <>
          <div className="flbl">What Mae remembers</div>
          {mems.length ? (
            mems.map((m) => (
              <div key={m.id} className="frow"><span className="ft">{m.t}</span></div>
            ))
          ) : (
            <p className="oIntro">Nothing saved yet.</p>
          )}
          <button className="fact" onClick={() => openSettings('memory')}>Edit in Settings</button>
        </>
      ) : (
        <>
          <div className="flbl">What Mae may do</div>
          {Object.entries(grants).map(([k, v]) => (
            <div key={k} className="frow">
              <span className="ft">{GRANT_LABEL[k] ?? k}</span>
              <span className="fmeta">{GRANT_VALUE[v] ?? v}</span>
            </div>
          ))}
          <p className="oIntro">These are the rules Mae will follow once she can act. Today she only answers.</p>
          <button className="fact" onClick={() => openSettings('permissions')}>Change in Settings</button>
        </>
      )}
    </>
  );
}

/** Phone: the office's peek bar, sitting just above the tab bar. Hidden on
 *  desktop, where the panel's corner handle is the door. */
export function OfficePeek({ tab, onOpen }: { tab: TabId; onOpen: () => void }) {
  return (
    <button className="peek" onClick={onOpen} aria-label="Open Mae's office">
      <span>
        <b>Mae's office</b>
        <span className="fmeta"> · {OFFICE[tab].map((t) => t.label).join(' · ')}</span>
      </span>
      <Icon name="up" />
    </button>
  );
}

interface OfficeProps {
  tab: TabId;
  open: boolean;
  view: PanelView;
  onView: (view: PanelView) => void;
  onClose: () => void;
  onToggle: () => void;
}

export default function Office({ tab, open, view, onView, onClose, onToggle }: OfficeProps) {
  /* A tapped item gets its own tab, first, on the Console's office only
     (Tasks, Calendar, Goals… all live under Console). */
  const focus = useFocus();
  const item = tab === 'console' ? focus : null;
  const tabs: OTab[] = item ? [{ id: 'item', label: FOCUS_LABEL[item.k] }, ...OFFICE[tab]] : OFFICE[tab];
  const v = fitView(tab, view, !!item);
  return (
    <>
      <div className={`pscrim${open ? ' open' : ''}`} onClick={onClose} />
      {!open ? (
        <button className="pHandle" onClick={onToggle} aria-label="Open Mae's office" title="Mae's office">
          <MaeIcon />
        </button>
      ) : null}

      <aside className={`panel office${open ? ' open' : ''}`} aria-label="Mae's office" aria-hidden={!open}>
        <div className="oHead">
          <span className="oGrab" aria-hidden="true" />
          <b>Mae's office</b>
          <button className="pX" onClick={onClose} aria-label="Close Mae's office">
            <Icon name="x" />
          </button>
        </div>
        <div className="otabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={v === t.id} className={v === t.id ? 'on' : ''} onClick={() => onView(t.id)}>
              {t.label}
              {t.id === 'item' ? (
                <span
                  className="otX"
                  role="button"
                  aria-label="Close this item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocus(null);
                    onView(OFFICE[tab][0].id);
                  }}
                >
                  ×
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className={'pBody oBody' + (v === 'mae' ? ' oBodyMae' : '')}>
          {v === 'item' && item ? (
            <ItemTab focus={item} onView={onView} />
          ) : v === 'mae' ? (
            <MaeTab tab={tab} />
          ) : v === 'context' ? (
            <ContextTab />
          ) : v === 'sandbox' ? (
            <Empty title="Nothing built yet" note="When Mae makes something in this chat, like a page, a document or a chart, it opens here." />
          ) : v === 'build' ? (
            <Empty title="Nothing to build yet" note="Pick something to make in Studio and its steps, preview and Mae's tips show here." />
          ) : v === 'details' ? (
            <Empty title="No file open" note="Open a file in the Library and its details show here: type, size, where it's used." />
          ) : v === 'notes' ? (
            <Empty title="No notes yet" note="Notes you take during a lesson will collect here. Coming soon." />
          ) : v === 'huddles' ? (
            <Empty title="No huddles yet" note="A huddle is a shared chat with Mae, one-on-one or in a group. Mae only uses what's shared there. Coming soon." />
          ) : v === 'desk' ? (
            <Desk />
          ) : (
            <Logbook tab={tab} />
          )}
        </div>
      </aside>
    </>
  );
}
