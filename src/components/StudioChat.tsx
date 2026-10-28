import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Composer from './shell/Composer';
import { renderMd } from '../md';
import { useNav } from '../nav';
import { useMedia } from '../useMedia';
import { Icon } from './shell/icons';
import { SbxFrame } from './SandboxView';
import { streamChat } from '../chat';
import { toApiBody, buildRequest } from '../request';
import { addFromReply, extractHtml, hideHtmlWhileStreaming, latestForThread, sandboxContext, setCur, subscribeSbx, sbxVersion } from '../sandbox';
import { addFileWith, setStatus, saveEdit, getFiles, setBody } from '../library';
import { armDraft } from '../studio';
import {
  getSession,
  saveSession,
  startWith,
  answer,
  skip,
  tick,
  questionOf,
  kindOfSession,
  lineCount,
  briefOfSession,
  isQuestion,
  mid,
  setActiveStudio,
  activeStudio as activeStudioSession,
  SECS,
  CHANGE_CHIPS,
  STUDIO_CHATS_EVENT,
  type Session,
} from '../studioChat';

/* One Studio item (mockups 26 + 27, his calls Oct 28): the questions flow
 * here in the chat, the spec sits in the office (Build tab), Make it is in
 * the chat. The composer is Chat's own. */

export function useStudioSessions(): void {
  const [, setT] = useState(0);
  useEffect(() => {
    const f = () => setT((t) => t + 1);
    window.addEventListener(STUDIO_CHATS_EVENT, f);
    return () => window.removeEventListener(STUDIO_CHATS_EVENT, f);
  }, []);
}

export function StudioChat({ id }: { id: string }) {
  const { turn, notify, refs, clearRefs, openPanel } = useNav();
  const wide = useMedia('(min-width:900px)');
  useStudioSessions();
  const s = getSession(id);
  useSyncExternalStore(subscribeSbx, sbxVersion);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const n = s?.msgs.length ?? 0;
  const lastText = s?.msgs[n - 1]?.text.length ?? 0;

  /* The office's Build tab follows this item; on desktop it opens with it. */
  useEffect(() => {
    setActiveStudio(id);
    if (wide) openPanel('build');
    /* A reply cut off by a reload is finished as it stands. */
    const x = getSession(id);
    if (x?.msgs.some((m) => m.streaming)) saveSession({ ...x, msgs: x.msgs.map((m) => (m.streaming ? { ...m, streaming: false, text: m.text || 'That reply was cut off. Say it again?' } : m)) });
    return () => setActiveStudio(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [n, lastText]);

  if (!s) return <div className="s m">This Studio item is gone.</div>;
  const kd = kindOfSession(s);
  const thread = `studio:${s.id}`;
  const page = latestForThread(thread);
  const now = () => getSession(s.id) ?? s;

  /* A real Studio draft from the first answer on, so it shows in Drafts, and
     its text is always the spec as it stands. */
  const put = (x: Session) => {
    if (x.started) {
      if (!x.fileId || !getFiles().some((f) => f.id === x.fileId)) {
        const f = addFileWith(x.title.slice(0, 80), kd.lib, briefOfSession(x));
        setStatus(f.id, 'draft');
        x = { ...x, fileId: f.id };
      } else if (!latestForThread(thread)) {
        setBody(x.fileId, x.title.slice(0, 80), briefOfSession(x));
      }
    }
    saveSession(x);
  };

  const send = (raw: string) => {
    const q = raw.trim();
    const att = refs.slice();
    if ((!q && !att.length) || busy) return;
    if (att.length) clearRefs();
    let cur = now();
    /* Their own idea typed instead of a template: it answers What is it. */
    if (!cur.started) cur = startWith(cur, null, true);
    if (page) {
      if (isQuestion(q) && !att.length) return askAbout(q);
      return build(q, att);
    }
    put(answer(cur, q, att));
  };
  /* After a build, a question gets a plain answer, not a rebuild. */
  const askAbout = (q: string) => {
    const base = now();
    const replyId = mid();
    put({ ...base, msgs: [...base.msgs, { id: mid(), who: 'u', text: q }, { id: replyId, who: 'e', text: '', streaming: true }] });
    setBusy(true);
    const body = toApiBody(buildRequest(turn, [], q), [], null);
    body.data.systemPrompt += '\n\n\u27E6studio:answer\u27E7' + sandboxContext(thread);
    void streamChat(body, (t) => {
      const x = getSession(s.id);
      if (x) saveSession({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: t } : m)) });
    }).then((reply) => {
      setBusy(false);
      const x = getSession(s.id);
      if (!x) return;
      const say = reply.ok ? extractHtml(reply.text).rest?.trim() || reply.text : reply.error ?? 'I could not reach Eumae just now.';
      put({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: say, streaming: false, chips: CHANGE_CHIPS } : m)) });
    });
  };

  /* Make it (or change it): the AI gets the whole spec and writes the code. */
  const build = (change?: string, att: typeof refs = []) => {
    if (busy) return;
    let base = now();
    const files = [...base.refs, ...att];
    const replyId = mid();
    base = { ...base, msgs: [...base.msgs, { id: mid(), who: 'u', text: change ?? 'Make it' }, { id: replyId, who: 'e', text: '', streaming: true }] };
    put(base);
    setBusy(true);
    const body = toApiBody(buildRequest(turn, change ? att : files, change ?? briefOfSession(base)), [], null);
    body.data.systemPrompt +=
      '\n\n\u27E6visual\u27E7' + (change ? '\n\u27E6role:studio\u27E7' + sandboxContext(thread) + `\n\n# THE SPEC\n${briefOfSession(base)}` : '\n\u27E6studio:make\u27E7');
    const fresh = getSession(s.id);
    if (fresh?.fileId && !page) armDraft(fresh.fileId);
    void streamChat(body, (t) => {
      const x = getSession(s.id);
      if (x) saveSession({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: hideHtmlWhileStreaming(t).text } : m)) });
    }).then((reply) => {
      setBusy(false);
      const x = getSession(s.id);
      if (!x) return;
      const pulled = reply.ok ? extractHtml(reply.text) : { html: null, rest: reply.text };
      let say = pulled.rest?.trim() || '';
      let built = false;
      if (pulled.html) {
        const r = addFromReply(thread, pulled.html, (change ?? 'First version').slice(0, 80));
        if (x.fileId && !r.item.fileId) saveEdit(x.fileId, r.item.title || x.title, pulled.html);
        built = true;
        say = say || (r.isNew ? `Made ${r.item.title}.` : `Updated ${r.item.title}.`);
        notify(r.isNew ? `Made ${r.item.title}` : `${r.item.title} is now v${r.item.versions.length}`, { undo: r.undo });
      } else if (!reply.ok) {
        say = reply.error ?? 'Something went wrong making it.';
      }
      const msgs = x.msgs.map((m) => (m.id === replyId ? { ...m, text: say || 'Done.', streaming: false, built, make: !built && !page } : m));
      put({
        ...x,
        msgs: built ? [...msgs, { id: mid(), who: 'e', text: 'What should we change? Or ask me anything about it.', chips: CHANGE_CHIPS }] : msgs,
      });
    });
  };

  /* ---- Under a message: pills, Make it, the preview card ---- */
  const lastE = [...s.msgs].reverse().find((m) => m.who === 'e');
  const latestBuilt = [...s.msgs].reverse().find((m) => m.built);
  const under = (m: Session['msgs'][number]) => {
    const live = m.id === lastE?.id && !m.streaming && !busy;
    if (m.start && !s.started) {
      return (
        <div className="scPills">
          {kd.templates.map((t) => (
            <button key={t.n} className="chip" onClick={() => put(startWith(now(), t.n))} title={t.d}>{t.n}</button>
          ))}
          <button className="chip" onClick={() => put(startWith(now(), null))}>Custom</button>
        </div>
      );
    }
    if (m.built && page && m.id === latestBuilt?.id) {
      return (
        <button className="scPrev" onClick={() => setFull(true)} aria-label={`Open ${page.title}`}>
          <SbxFrame html={page.versions[page.cur]?.html ?? ''} title={page.title} className="sbxFrame scPrevF" />
          <span className="scPrevL">
            <b>{page.title}</b>
            <span className="m">v{page.cur + 1} · Tap to open</span>
          </span>
        </button>
      );
    }
    if (!live) return null;
    const q = m.qid && s.queue[0] === m.qid ? questionOf(s, m.qid) : undefined;
    if (q) {
      return (
        <div className="scPills">
          {q.opts.map((o) =>
            q.multi ? (
              <button key={o.l} className={'chip' + (s.ticked.includes(o.l) ? ' on' : '')} onClick={() => put(tick(now(), o.l))}>{o.l}</button>
            ) : (
              <button key={o.l} className="chip" onClick={() => put(answer(now(), o.l))}>{o.l}</button>
            ),
          )}
          {q.multi ? <button className="chip" onClick={() => put(answer(now(), ''))}>Done</button> : null}
          {q.id !== 'else' ? <button className="chip" onClick={() => put(skip(now()))}>Skip</button> : null}
        </div>
      );
    }
    if (m.make && !page) {
      return (
        <div className="btns scMakeRow">
          <button className="pri" onClick={() => build()}>Make it</button>
        </div>
      );
    }
    if (m.chips?.length && page) {
      return (
        <div className="scPills">
          {m.chips.map((c) => (
            <button key={c} className="chip" onClick={() => build(c)}>{c}</button>
          ))}
        </div>
      );
    }
    return null;
  };

  const count = lineCount(s);
  return (
    <div className="scMain">
      {!wide && s.started ? (
        <button className="scPin" onClick={() => openPanel('build')}>
          <b>Spec · {count} {count === 1 ? 'line' : 'lines'}</b>
          <span className="m">In the office ›</span>
        </button>
      ) : null}
      <div className="scMsgs" ref={scroller}>
        {s.msgs.map((m) => (
          <div key={m.id} className="scTurn">
            <div className={'msg' + (m.who === 'u' ? ' you' : '')}>
              <div className="bubble scBub">{m.who === 'e' ? <EText text={m.text} streaming={m.streaming} /> : m.text}</div>
            </div>
            {under(m)}
          </div>
        ))}
      </div>
      <Composer
        onSend={(t) => send(t)}
        busy={() => busy}
        placeholder={!s.started ? 'Or tell Eumae your idea…' : page ? 'Tell Eumae what to change…' : 'Tell Eumae anything…'}
      />
      {full && page ? (
        <div className="scSheet">
          <div className="scSheetBar">
            <button className="hb" onClick={() => setFull(false)} aria-label="Back to the chat"><Icon name="bk" /></button>
            <div className="scSheetT">{page.title}</div>
            <span className="m">v{page.cur + 1}</span>
          </div>
          <SbxFrame html={page.versions[page.cur]?.html ?? ''} title={page.title} className="sbxFrame scFrame" />
        </div>
      ) : null}
    </div>
  );
}

/* Eumae's words, rendered like Chat's replies once they land. */
function EText({ text, streaming }: { text: string; streaming?: boolean }) {
  const html = useMemo(() => (streaming || !text ? null : renderMd(text)), [text, streaming]);
  if (html === null) return <>{text || '…'}</>;
  return <span className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* The office's Build tab: the spec as it stands (context only; details are
 * added in the chat), then the versions once something is made. */
export function StudioBuildTab() {
  useStudioSessions();
  useSyncExternalStore(subscribeSbx, sbxVersion);
  const s = activeStudioSession();
  if (!s || !s.started) {
    return (
      <div className="oEmpty">
        <div className="ft">Nothing to build yet</div>
        <p className="fsub">Pick something to make in Studio. Its spec fills in here as you answer.</p>
      </div>
    );
  }
  const page = latestForThread(`studio:${s.id}`);
  return (
    <div className="scSpec">
      <div className="scSpecT">{s.title}</div>
      {SECS.filter((x) => s.spec[x.id].length).map((sec) => (
        <div key={sec.id} className="scSec">
          <div className="scSecH">{sec.h}</div>
          {s.spec[sec.id].map((l, i) => (
            <div key={i} className={'scLine' + (sec.id === 'open' ? ' m' : '')}>{l}</div>
          ))}
        </div>
      ))}
      <div className="s m">Add more in the chat. Make it hands this whole spec to Eumae.</div>
      {page ? (
        <div className="scSec">
          <div className="scSecH">Versions</div>
          {page.versions
            .map((v, i) => (
              <button key={v.at} className={'scVer' + (i === page.cur ? ' on' : '')} onClick={() => setCur(page.id, i)}>
                <span>v{i + 1} · {v.label}</span>
                <span className="m">{new Date(v.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </button>
            ))
            .reverse()}
        </div>
      ) : null}
    </div>
  );
}
