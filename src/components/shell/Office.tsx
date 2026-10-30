import { StudioBuildTab } from '../StudioChat';
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from './icons';
import type { TabId } from './TabBar';
import { logEv, useLog, type LogFiled } from '../../log';
import { useNav, type Mode, type Model, type PanelView, type Thinking } from '../../nav';
import { getRoles } from '../../roles';
import { getTasks } from '../../tasks';
import { eventsBetween, ymd } from '../../events';
import { isOverdue } from '../../due';
import { runEumaeTurn } from '../../eumae/loop';
import { planNote, detachFresh, type Plan } from '../../eumae/dispatcher';
import { PlanCard, EumaeSteps } from '../PlanCard';
import { buildRequest, toApiBody } from '../../request';
import { createThread, getThread, saveThread, threadsChanged, type Msg, type Thread } from '../../threads';
import { msgId } from '../../boot';
import { timeLabels } from '../../stamp';
import { getTask } from '../../tasks';
import { getEvent, getEvents } from '../../events';
import { getNotes, titleOf, noteText } from '../../notes';
import { getProjects, linkedIds, getProject, projectCountLabel } from '../../projects';
import { getFiles } from '../../library';
import type { Ref } from '../../nav';
import { useFocus, setFocus, getFocus, focusLabel, takeAsk, onAsk } from '../../focus';
import { getFlow, getStarter, scheduleLabel, KIND_LABEL, doneToday } from '../../flows';
import { ItemTab } from './ItemTab';
import { SandboxView, useSbx } from '../SandboxView';
import { getOpenSbx, getSbx, latestForThread, wantsAThing, thingHint, extractHtml, hideHtmlWhileStreaming, addFromReply, openSbx, saidNoHint } from '../../sandbox';
import { SbxRow } from '../SandboxView';
import { getCurrentThreadId } from '../../threads';
import { EumaeIcon } from './Header';
import { getGoals, goalPct, goalCount } from '../../goals';

/** Eumae's office: the right panel on desktop, a peek bar and a sheet on a phone.
 *
 *  Every page's office is the same shape: Eumae, the page's own tab, the Desk and
 *  the Logbook (eumae-right-panel.md, locked Oct 18). Chat has no Eumae tab
 *  because the chat *is* Eumae; Guild's Eumae lives inside each huddle.
 *
 *  Nothing here pretends. The Desk stays empty until Eumae can really notice and
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
    { id: 'eumae', label: 'Eumae' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
  studio: [
    { id: 'eumae', label: 'Eumae' },
    { id: 'build', label: 'Build' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
  library: [
    { id: 'eumae', label: 'Eumae' },
    { id: 'details', label: 'Details' },
    { id: 'desk', label: 'Desk' },
    { id: 'logbook', label: 'Logbook' },
  ],
  classroom: [
    { id: 'eumae', label: 'Eumae' },
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

/** Who Eumae is on each page. Sent with every question asked from the office. */
const ROLE: Partial<Record<TabId, { name: string; intro: string; prompt: string; hint: string }>> = {
  console: {
    name: 'Planner',
    intro: 'I can see your open tasks and this week. Ask me what to do first, or to plan your day.',
    prompt: '\u27E6role:console\u27E7',
    hint: 'What should I do first?',
  },
  studio: {
    name: 'Coach',
    intro: 'Tell me what you want to make. I\'ll ask what I need and give you tips as you go.',
    prompt: '\u27E6role:studio\u27E7',
    hint: 'Help me make a one-pager',
  },
  library: {
    name: 'Ask this file',
    intro: 'Ask me about your files. Open one and I\'ll focus on it.',
    prompt: '\u27E6role:library\u27E7',
    hint: 'Ask about your files',
  },
  classroom: {
    name: 'Tutor',
    intro: 'Ask me to explain anything from your lessons, or to quiz you.',
    prompt: '\u27E6role:classroom\u27E7',
    hint: 'Explain this simply',
  },
};

/* Eumae's office threads: one per page, saved as real chat threads (marked
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
/** The item open in the office, as a line Eumae can read. */
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
  if (f.k === 'goal') {
    const g = getGoals().find((x) => x.id === f.id);
    return g
      ? `\n\nThe person has this goal open: ${g.t}${g.d ? ' (why: ' + g.d + ')' : ''}, ${goalPct(g)}% done${goalCount(g) ? ' (' + goalCount(g) + ')' : ''}${g.td ? ', target ' + g.td : ''}.`
      : '';
  }
  if (f.k === 'project') {
    const p = getProject(f.id);
    return p ? `\n\nThe person has this project open: ${p.n}${p.d ? ' (' + p.d + ')' : ''}, ${projectCountLabel(p)}${p.due ? ', deadline ' + p.due : ''}.` : '';
  }
  if (f.k === 'flow') {
    const x = getFlow(f.id);
    return x
      ? `\n\nThe person has this ${KIND_LABEL[x.kind].toLowerCase()} open (they run it themselves): ${x.n}, ${scheduleLabel(x)}${x.steps.length ? `, steps: ${x.steps.join('; ')} (${doneToday(x).length} of ${x.steps.length} done today)` : ''}.`
      : '';
  }
  if (f.k === 'starter') {
    const x = getStarter(f.id);
    return x
      ? `\n\nThe person is previewing a starter ${KIND_LABEL[x.kind].toLowerCase()} they haven't added yet: ${x.n} (${x.u})${x.steps.length ? `, steps: ${x.steps.join('; ')}` : ''}.`
      : '';
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
    .map((t) => `- ${t.t}${t.due ? ` (due ${t.due}${t.tm ? ' ' + t.tm : ''}${isOverdue(t) ? ', overdue' : ''})` : ''}`);
  const evs = eventsBetween(today, 7)
    .slice(0, 15)
    .map((e) => `- ${e.d} ${e.allDay ? 'all day' : e.tm}: ${e.t}`);
  return `\n\nOpen tasks:\n${open.join('\n') || '- none'}\n\nNext 7 days:\n${evs.join('\n') || '- nothing scheduled'}`;
}

/** A page Eumae made from the office: Open takes you to its chat with the Sandbox up. */
function OfficeMade({ made, threadId }: { made: NonNullable<Msg['made']>; threadId: string }) {
  const { switchThread, goTab } = useNav();
  return (
    <div
      onClickCapture={() => {
        switchThread(threadId);
        goTab('chat');
      }}
    >
      <SbxRow made={made} />
    </div>
  );
}

function EumaeTab({ tab }: { tab: TabId }) {
  const role = ROLE[tab]!;
  const { turn, switchThread, goTab, notify } = useNav();
  const thread = useOfficeThread(tab);
  const list: Msg[] = thread?.messages ?? [];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  /* Follow the thread until Eumae's reply starts; then hold her first line at
     the top so you read from the start (his call, Oct 21). Scrolling by hand
     stops the follow; reaching the bottom again resumes it. */
  const followRef = useRef(true);
  const progRef = useRef(-1);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const v = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    atBottomRef.current = v;
    setAtBottom(v);
    if (Math.abs(el.scrollTop - progRef.current) > 2) followRef.current = v;
  };
  const setTop = (el: HTMLDivElement, y: number) => {
    progRef.current = Math.max(0, Math.round(y));
    el.scrollTop = y;
  };
  const toBottom = () => {
    const el = scroller.current;
    if (el) setTop(el, el.scrollHeight - el.clientHeight);
    atBottomRef.current = true;
    followRef.current = true;
    setAtBottom(true);
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el || !followRef.current) return;
    const last = list[list.length - 1];
    if (!last || last.role === 'you') return toBottom();
    const node = el.querySelector<HTMLElement>(`[data-mid="${last.id}"]`);
    const bottom = el.scrollHeight - el.clientHeight;
    if (!node) return setTop(el, bottom);
    const top = node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 8;
    setTop(el, Math.min(bottom, top));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  /* The box grows with what's in it, up to about six lines. */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight + 2, 150) + 'px';
  }, [text]);
  const stamps = timeLabels(list.map((m) => m.ts));

  const send = (preset?: string) => {
    const q = (typeof preset === 'string' ? preset : text).trim();
    if (!q || busy) return;
    if (typeof preset !== 'string') setText('');
    const base = thread ?? { ...createThread(), title: officeName(tab), from: officeName(tab) };
    const history = base.messages;
    const body = toApiBody(
      buildRequest(turn, [], q),
      history.map((m) => (m.plan ? { ...m, text: `${m.text}\n\n${planNote(m.plan)}` } : m)),
      null,
    );
    /* Which room asked, and what that room can see: the Console adds its state
       and the focus card, every room carries the focus card. Only the four
       rooms with a persona have a name on the server side. */
    if (ROLE[tab]) body.data.prompt.room = tab as 'console' | 'studio' | 'library' | 'classroom';
    const ctx = `${tab === 'console' ? consoleContext() : ''}${focusContext()}`;
    /* Same rule as Chat: a "make me a thing" ask gets a page, not a project card.
       A bare no is a no (Oct 20: "no" came back as a 300-line page). */
    const thing = wantsAThing(q);
    body.data.prompt.context = [ctx, thing ? thingHint(thing) : '', saidNoHint(q)].filter(Boolean).join('');
    const mine: Msg = { id: msgId(), role: 'you', text: q, ts: Date.now() };
    const replyId = msgId();
    const put = (reply: string, streaming: boolean, extra: Partial<Msg> = {}, prior: Msg[] = history) =>
      writeOffice(tab, { ...base, messages: [...prior, mine, { id: replyId, role: 'eumae', text: reply, ts: Date.now(), streaming: streaming || undefined, ...extra }] });
    put('', true);
    threadsChanged();
    atBottomRef.current = true;
    followRef.current = true;
    setBusy(true);
    /* One open card per thread: this turn adds to the one still waiting. */
    const openMsg = [...history].reverse().find((m) => m.plan?.status === 'pending');
    void runEumaeTurn(body, `${officeName(tab)} office`, (full) => {
      const h = hideHtmlWhileStreaming(full);
      put(h.text || (h.making ? 'Making it…' : ''), true);
    }, openMsg?.plan).then((reply) => {
      setBusy(false);
      const now = (base.id ? getThread(base.id)?.messages : undefined) ?? history;
      const oldNow = openMsg ? now.find((m) => m.id === openMsg.id)?.plan : undefined;
      let plan = reply.plan;
      const carried = !!plan && !!openMsg?.plan && plan.id === openMsg.plan.id;
      if (plan && carried && oldNow?.status !== 'pending') plan = detachFresh(plan) ?? undefined;
      if (plan && !plan.steps.length) plan = undefined;
      const emptied = carried && !!reply.plan && !reply.plan.steps.length;
      const prior = history.map((m) => {
        const cur = now.find((x) => x.id === m.id) ?? m;
        if (!(carried && m.id === openMsg!.id && oldNow?.status === 'pending')) return cur;
        return emptied ? { ...cur, plan: { ...cur.plan!, status: 'cancelled' as const } } : { ...cur, plan: undefined };
      });
      /* A page in the reply goes to the Sandbox; the bubble keeps the words. */
      let text = reply.ok ? reply.text : `I couldn't answer: ${reply.error}`;
      let made: Msg['made'];
      const pulled = reply.ok ? extractHtml(reply.text) : { html: null, rest: text };
      if (pulled.html && base.id) {
        const r = addFromReply(base.id, pulled.html, q);
        made = { id: r.item.id, v: r.item.versions.length, title: r.item.title };
        text = pulled.rest || (r.isNew ? `Made ${r.item.title}.` : `Updated ${r.item.title}.`);
        openSbx(r.item.id);
        notify(r.isNew ? `Made ${r.item.title}` : `${r.item.title} is now v${made.v}`, { undo: r.undo });
        logEv({ area: AREA[tab], text: r.isNew ? `Made in Sandbox: ${r.item.title}` : `Sandbox v${made.v}: ${r.item.title}` });
      }
      put(
        text,
        false,
        { ...(plan ? { plan } : {}), ...(reply.steps.length ? { steps: reply.steps } : {}), ...(made ? { made } : {}) },
        prior,
      );
      threadsChanged();
      if (reply.open) setFocus({ k: reply.open.k, id: reply.open.id });
      if (!reply.ok) logEv({ area: AREA[tab], text: `Eumae couldn't answer: ${reply.error}`, status: 'bad' });
    });
  };

  /* A row's "Ask Eumae" left a question: send it as soon as this tab is up. */
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const go = () => {
      const q = takeAsk();
      if (q) window.setTimeout(() => sendRef.current(q), 0);
    };
    go();
    return onAsk(go);
  }, []);

  /** A plan card changed (approved, cancelled, undone): keep it on its message. */
  const setPlan = (id: number, plan: Plan) => {
    if (!thread) return;
    writeOffice(tab, { ...thread, messages: thread.messages.map((m) => (m.id === id ? { ...m, plan } : m)) });
    threadsChanged();
  };

  return (
    <div className="oEumae">
      <div className="oEumaeHead">
        <div className="flbl">Eumae · {role.name}</div>
        {thread ? (
          <div className="oEumaeActs">
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
              <div className="oEumae1" data-mid={m.id}>
                <div className="n">Eumae</div>
                {m.text || <span className="fsub">Thinking…</span>}
                {!m.streaming ? <EumaeSteps steps={m.steps} plan={m.plan} /> : null}
                {m.made && thread ? <OfficeMade made={m.made} threadId={thread.id} /> : null}
                {m.plan ? <PlanCard plan={m.plan} notify={notify} area={AREA[tab]} onChange={(p) => setPlan(m.id, p)} /> : null}
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
          aria-label="Ask Eumae"
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

/* Context › Add from: pick a project, note, Library file, event or task and
   it rides with your next message as text Eumae reads. */
type SrcKind = 'Projects' | 'Notes' | 'Library' | 'Calendar' | 'Tasks';
const SRC: SrcKind[] = ['Projects', 'Notes', 'Library', 'Calendar', 'Tasks'];
function sourceItems(k: SrcKind): Ref[] {
  const fmtD = (d?: string) => (d ? new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');
  switch (k) {
    case 'Projects': {
      const tasks = getTasks();
      return getProjects().map((p) => {
        const open = linkedIds(p.id, 'task').map((id) => tasks.find((t) => t.id === id)).filter((t) => t && !t.d).map((t) => '- ' + t!.t);
        return { label: p.n, icon: 'fol', ctx: `Project: ${p.n}${p.d ? '\n' + p.d : ''}${p.due ? '\nDue ' + fmtD(p.due) : ''}${open.length ? '\nOpen tasks:\n' + open.join('\n') : ''}` };
      });
    }
    case 'Notes':
      return getNotes().map((n) => ({ label: titleOf(n), icon: 'doc', ctx: `Note: ${titleOf(n)}\n${noteText(n)}` }));
    case 'Library':
      return getFiles().map((f) => ({ label: f.t, icon: 'doc', ctx: `Library file: ${f.t}\n${f.b}` }));
    case 'Calendar':
      return [...getEvents()]
        .sort((a, b) => (a.d + a.tm).localeCompare(b.d + b.tm))
        .map((e) => ({ label: `${e.t} · ${fmtD(e.d)}`, icon: 'cal', ctx: `Event: ${e.t}, ${fmtD(e.d)}${e.tm ? ' ' + e.tm : ''}${e.loc ? ', at ' + e.loc : ''}` }));
    case 'Tasks':
      return getTasks()
        .filter((t) => !t.d)
        .map((t) => ({
          label: t.t,
          icon: 'chk',
          ctx: `Task: ${t.t}${t.due ? ', due ' + fmtD(t.due) + (t.tm ? ' ' + t.tm : '') : ''}${t.sub?.length ? '\nSteps:\n' + t.sub.map((x) => (x.d ? '- [done] ' : '- ') + x.t).join('\n') : ''}`,
        }));
  }
}
function AddFrom() {
  const { attach, refs } = useNav();
  const [src, setSrc] = useState<SrcKind | null>(null);
  const [q, setQ] = useState('');
  const items = src ? sourceItems(src).filter((r) => r.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40) : [];
  return (
    <>
      <div className="flbl">Add from</div>
      <div className="ctxChips">
        {SRC.map((k) => (
          <button
            key={k}
            className={'ctxChip' + (src === k ? ' on' : '')}
            onClick={() => {
              setSrc((v) => (v === k ? null : k));
              setQ('');
            }}
          >
            + {k}
          </button>
        ))}
      </div>
      {src ? (
        <div className="ctxPick">
          <input className="sinput" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${src.toLowerCase()}`} aria-label={`Search ${src}`} autoFocus />
          {items.length ? (
            items.map((r) => {
              const on = refs.some((x) => x.label === r.label);
              return (
                <button
                  key={r.label}
                  className="frow ctxRow"
                  disabled={on}
                  onClick={() => {
                    attach(r);
                    setSrc(null);
                  }}
                >
                  <Icon name={r.icon} />
                  <span className="ft">{r.label}</span>
                  <span className="fmeta">{on ? 'Attached' : 'Add'}</span>
                </button>
              );
            })
          ) : (
            <p className="oIntro">Nothing here{q ? ' matches' : ' yet'}.</p>
          )}
        </div>
      ) : null}
    </>
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
      <div className="flbl">Attached</div>
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
        <p className="oIntro">Nothing attached yet. Add something below, or use the paperclip for a photo or PDF.</p>
      )}

      <AddFrom />

      <div className="flbl">Always in context</div>
      <div className="frow"><span className="ft">Your projects</span></div>
      <div className="frow"><span className="ft">Today and this week</span></div>
      <div className="frow"><span className="ft">Recent conversations</span></div>

      <div className="flbl">How Eumae answers</div>
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

/* What the Sandbox shows: the page last opened, else this chat's newest page. */
function SandboxTab() {
  useSbx();
  const open = getSbx(getOpenSbx()) ?? latestForThread(getCurrentThreadId());
  if (!open) return <Empty title="Nothing built yet" note="Ask Eumae in this chat to make a page, a widget, a calculator or a game. It opens here, and each change becomes a new version." />;
  return <SandboxView id={open.id} />;
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
        note="When Eumae notices something or proposes a step, it lands here for your OK. Once it's done, it moves to the Logbook with a receipt and Undo."
      />
      <p className="oIntro">Eumae can't notice or act on its own yet. That comes with the backend.</p>
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
          <Empty title="Nothing yet" note={`What you and Eumae do in ${AREA[tab]} shows up here, newest first.`} />
        )
      ) : part === 'Memory' ? (
        <>
          <div className="flbl">What Eumae remembers</div>
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
          <div className="flbl">What Eumae may do</div>
          {Object.entries(grants).map(([k, v]) => (
            <div key={k} className="frow">
              <span className="ft">{GRANT_LABEL[k] ?? k}</span>
              <span className="fmeta">{GRANT_VALUE[v] ?? v}</span>
            </div>
          ))}
          <p className="oIntro">These are the rules Eumae will follow once it can act. Today it only answers.</p>
          <button className="fact" onClick={() => openSettings('permissions')}>Change in Settings</button>
        </>
      )}
    </>
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
  const tabs: OTab[] = item ? [{ id: 'item', label: focusLabel(item) }, ...OFFICE[tab]] : OFFICE[tab];
  const v = fitView(tab, view, !!item);
  return (
    <>
      <div className={`pscrim${open ? ' open' : ''}`} onClick={onClose} />
      {!open ? (
        <button className="pHandle" onClick={onToggle} aria-label="Open Eumae's office" title="Eumae's office">
          <EumaeIcon />
        </button>
      ) : null}

      <aside className={`panel office${open ? ' open' : ''}`} aria-label="Eumae's office" aria-hidden={!open}>
        <div className="oHead">
          <span className="oGrab" aria-hidden="true" />
          <b>Eumae's office</b>
          <button className="pX" onClick={onClose} aria-label="Close Eumae's office">
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
        <div className={'pBody oBody' + (v === 'eumae' ? ' oBodyEumae' : '')}>
          {v === 'item' && item ? (
            <ItemTab focus={item} onView={onView} />
          ) : v === 'eumae' ? (
            <EumaeTab tab={tab} />
          ) : v === 'context' ? (
            <ContextTab />
          ) : v === 'sandbox' ? (
            <SandboxTab />
          ) : v === 'build' ? (
            <StudioBuildTab />
          ) : v === 'details' ? (
            <Empty title="No file open" note="Open a file in the Library and its details show here: type, size, where it's used." />
          ) : v === 'notes' ? (
            <Empty title="No notes yet" note="Notes you take during a lesson will collect here. Coming soon." />
          ) : v === 'huddles' ? (
            <Empty title="No huddles yet" note="A huddle is a shared chat with Eumae, one-on-one or in a group. Eumae only uses what's shared there. Coming soon." />
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
