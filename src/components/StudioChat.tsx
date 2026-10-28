import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Composer from './shell/Composer';
import { renderMd } from '../md';
import { useNav } from '../nav';
import { useMedia } from '../useMedia';
import { Icon } from './shell/icons';
import { SbxFrame } from './SandboxView';
import { streamChat } from '../chat';
import { toApiBody, buildRequest, BASE_PROMPT } from '../request';
import { addFromReply, extractHtml, hideHtmlWhileStreaming, latestForThread, sandboxContext, setCur, subscribeSbx, sbxVersion } from '../sandbox';
import { addFileWith, setStatus, saveEdit, getFiles } from '../library';
import { armDraft } from '../studio';
import {
  getSession,
  saveSession,
  startWith,
  toggleIdea,
  kindOfSession,
  lineCount,
  summary,
  briefOfSession,
  gaps,
  parseSpecReply,
  applyPatch,
  hideSpec,
  mid,
  SECS,
  STUDIO_CHATS_EVENT,
  type Sec,
  type Session,
} from '../studioChat';

/* One Studio item (mockups 24 + 25, his yes Oct 27): the chat, the spec and
 * the preview on one screen. Phone: the spec is pinned on top; tap it for the
 * spec or the preview. Desktop: chat left, Spec / Preview / Versions right.
 * The composer is Chat's own. */

function useSession(id: string): Session | undefined {
  const [, setT] = useState(0);
  useEffect(() => {
    const f = () => setT((t) => t + 1);
    window.addEventListener(STUDIO_CHATS_EVENT, f);
    return () => window.removeEventListener(STUDIO_CHATS_EVENT, f);
  }, []);
  return getSession(id);
}

export function StudioChat({ id }: { id: string }) {
  const { turn, notify, refs, clearRefs } = useNav();
  const wide = useMedia('(min-width:900px)');
  const s = useSession(id);
  useSyncExternalStore(subscribeSbx, sbxVersion);
  const [busy, setBusy] = useState<'' | 'spec' | 'build'>('');
  const [tab, setTab] = useState<'spec' | 'preview' | 'versions'>('spec');
  const [sheet, setSheet] = useState(false);
  const [edit, setEdit] = useState<{ sec: Sec; i: number; v: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const n = s?.msgs.length ?? 0;
  const lastText = s?.msgs[n - 1]?.text.length ?? 0;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [n, lastText]);

  if (!s) return <div className="s m">This Studio item is gone.</div>;
  const kd = kindOfSession(s);
  const thread = `studio:${s.id}`;
  const page = latestForThread(thread);
  const put = (next: Session) => saveSession(next);
  const now = () => getSession(s.id) ?? s;

  /* A real Studio draft from the first answer on, so it shows in Drafts. */
  const ensureDraft = (x: Session): Session => {
    if (x.fileId && getFiles().some((f) => f.id === x.fileId)) return x;
    const f = addFileWith(x.title.slice(0, 80), kd.lib, briefOfSession(x));
    setStatus(f.id, 'draft');
    return { ...x, fileId: f.id };
  };
  const act = (fn: (x: Session) => Session) => put(ensureDraft(fn(now())));

  /* Anything typed goes to Eumae, who files it in the spec and asks the next
     thing. After a build, typed words change the build. */
  const send = (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    const att = refs.slice();
    if (att.length) clearRefs();
    let cur = now();
    if (!cur.started) cur = { ...cur, started: true, spec: { ...cur.spec, is: [`A ${kd.n.toLowerCase()}`] }, title: `New ${kd.n.toLowerCase()}` };
    if (att.length) cur = { ...cur, files: [...cur.files, ...att.map((r) => r.label)] };
    put(cur);
    if (page) return build(q, att);
    askEumae(q, att);
  };

  const askEumae = (q: string, att: typeof refs = []) => {
    const base = ensureDraft(now());
    const replyId = mid();
    put({ ...base, msgs: [...base.msgs, { id: mid(), who: 'u', text: q }, { id: replyId, who: 'e', text: '', streaming: true }] });
    setBusy('spec');
    const body = toApiBody(buildRequest(turn, att, q), [], null);
    const recent = base.msgs.slice(-8).map((m) => `${m.who === 'u' ? 'Them' : 'Eumae'}: ${m.text}`).join('\n');
    const specNow = SECS.map((x) => `${x.id}: ${base.spec[x.id].join(' | ') || '(empty)'}`).join('\n');
    body.data.systemPrompt =
      BASE_PROMPT + '\n\n\u27E6studio:spec\u27E7' +
      `\n\n# KIND\n${kd.n}${base.tpl ? ' (' + base.tpl + ')' : ''}\n\n# SPEC SO FAR\n${specNow}\n\n# STILL MISSING\n${gaps(base)}\n\n# RECENT CHAT\n${recent}`;
    void streamChat(body, (full) => {
      const x = getSession(s.id);
      if (x) put({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: hideSpec(full) } : m)) });
    }).then((reply) => {
      setBusy('');
      const x = getSession(s.id);
      if (!x) return;
      const r = reply.ok ? parseSpecReply(reply.text) : { say: reply.error ?? 'I could not reach Eumae just now.', patch: {} };
      const next = applyPatch(x, r.patch);
      put({
        ...next,
        msgs: next.msgs.map((m) => (m.id === replyId ? { ...m, text: r.say || 'Got it. Added to the spec.', chips: r.patch.chips, streaming: false } : m)),
      });
    });
  };

  /* Make it (or change it): the page builds here, as a new version. */
  const build = (change?: string, att: typeof refs = []) => {
    if (busy) return;
    let base = ensureDraft(now());
    const replyId = mid();
    base = { ...base, msgs: [...base.msgs, { id: mid(), who: 'u', text: change ?? 'Make it' }, { id: replyId, who: 'e', text: '', streaming: true }] };
    put(base);
    setBusy('build');
    const body = toApiBody(buildRequest(turn, att, change ?? briefOfSession(base)), [], null);
    body.data.systemPrompt += '\n\n\u27E6role:studio\u27E7\n\u27E6visual\u27E7' + (change ? sandboxContext(thread) + `\n\n# THE SPEC\n${briefOfSession(base)}` : '');
    if (base.fileId && !page) armDraft(base.fileId);
    void streamChat(body, (full) => {
      const x = getSession(s.id);
      if (!x) return;
      const h = hideHtmlWhileStreaming(full);
      put({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: h.text } : m)) });
    }).then((reply) => {
      setBusy('');
      const x = getSession(s.id);
      if (!x) return;
      const pulled = reply.ok ? extractHtml(reply.text) : { html: null, rest: reply.text };
      let say = pulled.rest?.trim() || '';
      if (pulled.html) {
        const r = addFromReply(thread, pulled.html, (change ?? 'First version').slice(0, 80));
        if (x.fileId && !r.item.fileId) saveEdit(x.fileId, r.item.title || x.title, pulled.html);
        say = say || (r.isNew ? `Made ${r.item.title}.` : `Updated ${r.item.title}.`);
        notify(r.isNew ? `Made ${r.item.title}` : `${r.item.title} is now v${r.item.versions.length}`, { undo: r.undo });
        setTab('preview');
        if (!wide) setSheet(true);
      } else if (!reply.ok) {
        say = reply.error ?? 'Something went wrong making it.';
      }
      put({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: say || 'Done.', streaming: false } : m)) });
    });
  };

  /* ---- Chips under a message (only the newest Eumae message keeps them live) ---- */
  const lastE = [...s.msgs].reverse().find((m) => m.who === 'e');
  const chipsFor = (m: Session['msgs'][number]) => {
    const live = m.id === lastE?.id && !m.streaming && !busy;
    if (m.start && !s.started) {
      return (
        <div className="scPills">
          {kd.templates.map((t) => (
            <button key={t.n} className="chip" onClick={() => act((x) => startWith(x, t.n))} title={t.d}>{t.n}</button>
          ))}
          <button className="chip" onClick={() => act((x) => startWith(x, null))}>Custom</button>
        </div>
      );
    }
    if (m.ideas?.length) {
      return (
        <>
          <div className="scIdeasH">Ideas for {kd.n === 'Slides' ? 'a deck' : `a ${kd.n.toLowerCase()}`}:</div>
          <div className="scPills">
            {m.ideas.map((l) => (
              <button key={l} className={'chip' + (s.spec.does.includes(l) ? ' on' : '')} onClick={() => act((x) => toggleIdea(x, l))}>{l}</button>
            ))}
          </div>
        </>
      );
    }
    const ready = live && !page && lineCount(s) >= 3;
    if (live && (m.chips?.length || ready)) {
      return (
        <div className="scPills">
          {(m.chips ?? []).map((c) => (
            <button key={c} className="chip" onClick={() => send(c)}>{c}</button>
          ))}
          {ready ? <button className="chip scGo" onClick={() => build()}>Make it</button> : null}
        </div>
      );
    }
    return null;
  };

  /* ---- The spec: tap a line to edit it in place ---- */
  const saveLine = () => {
    if (!edit) return;
    const v = edit.v.trim();
    act((x) => {
      const list = [...x.spec[edit.sec]];
      if (edit.i >= list.length) {
        if (v) list.push(v);
      } else if (v) list[edit.i] = v;
      else list.splice(edit.i, 1);
      return { ...x, spec: { ...x.spec, [edit.sec]: list } };
    });
    setEdit(null);
  };
  const specCard = (
    <div className="scSpec">
      {SECS.map((sec) => (
        <div key={sec.id} className="scSec">
          <div className="scSecH">{sec.h}</div>
          {[...s.spec[sec.id], ...(edit?.sec === sec.id && edit.i >= s.spec[sec.id].length ? [''] : [])].map((l, i) =>
            edit && edit.sec === sec.id && edit.i === i ? (
              <input
                key={i}
                className="scEditIn"
                autoFocus
                value={edit.v}
                onChange={(e) => setEdit({ ...edit, v: e.target.value })}
                onBlur={saveLine}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveLine();
                  if (e.key === 'Escape') setEdit(null);
                }}
              />
            ) : (
              <button key={i} className="scLine" onClick={() => setEdit({ sec: sec.id, i, v: l })}>{l}</button>
            ),
          )}
          {!s.spec[sec.id].length && edit?.sec !== sec.id ? <div className="scLine m">{sec.id === 'open' ? 'None' : 'Not set yet'}</div> : null}
        </div>
      ))}
      <button className="scAddReq" onClick={() => setEdit({ sec: 'does', i: s.spec.does.length, v: '' })}>+ Add a requirement</button>
      <div className="btns">
        <button className="pri" disabled={!!busy || !s.started} onClick={() => { if (!wide) setSheet(false); build(); }}>
          {page ? 'Make it again from the spec' : 'Make it'}
        </button>
      </div>
    </div>
  );

  const preview = page ? (
    <SbxFrame html={page.versions[page.cur]?.html ?? ''} title={page.title} className="sbxFrame scFrame" />
  ) : (
    <div className="s m scEmpty">{busy === 'build' ? 'Making it…' : 'Nothing made yet. Tap Make it when the spec looks right.'}</div>
  );
  const versions = page ? (
    <div>
      {page.versions
        .map((v, i) => (
          <button key={v.at} className={'scVer' + (i === page.cur ? ' on' : '')} onClick={() => { setCur(page.id, i); setTab('preview'); }}>
            <span>v{i + 1} · {v.label}</span>
            <span className="m">{new Date(v.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </button>
        ))
        .reverse()}
    </div>
  ) : (
    <div className="s m scEmpty">Versions show up here after the first build.</div>
  );
  const side = (
    <>
      <div className="seg scSeg">
        {(['spec', 'preview', 'versions'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'spec' ? 'Spec' : t === 'preview' ? 'Preview' : 'Versions'}
          </button>
        ))}
      </div>
      {tab === 'spec' ? specCard : tab === 'preview' ? preview : versions}
    </>
  );

  const count = lineCount(s);
  return (
    <div className="scWrap">
      <div className="scMain">
        {!wide ? (
          <button className="scPin" onClick={() => { setTab(page ? 'preview' : 'spec'); setSheet(true); }}>
            <span className="scPinT">
              <b>Spec · {count} {count === 1 ? 'line' : 'lines'}</b>
              <span className="m">{page ? 'Preview ›' : 'Open ›'}</span>
            </span>
            <span className="m scPinS">{summary(s) || 'Fills in as you talk'}</span>
          </button>
        ) : null}
        <div className="scMsgs" ref={scroller}>
          {s.msgs.map((m) => (
            <div key={m.id} className="scTurn">
              <div className={'msg' + (m.who === 'u' ? ' you' : '')}>
                <div className="bubble scBub">{m.who === 'e' ? <EText text={m.text} streaming={m.streaming} building={busy === 'build'} /> : m.text}</div>
              </div>
              {chipsFor(m)}
            </div>
          ))}
        </div>
        <Composer
          onSend={(t) => send(t)}
          busy={() => !!busy}
          placeholder={!s.started ? 'Or tell Eumae your idea…' : page ? 'Tell Eumae what to change…' : 'Tell Eumae anything…'}
        />
      </div>
      {wide ? <div className="scSide">{side}</div> : null}
      {!wide && sheet ? (
        <div className="scSheet">
          <div className="scSheetBar">
            <button className="hb" onClick={() => setSheet(false)} aria-label="Back to the chat"><Icon name="bk" /></button>
            <div className="scSheetT">{s.title}</div>
          </div>
          {side}
        </div>
      ) : null}
    </div>
  );
}

/* Eumae's words, rendered like Chat's replies once they land. */
function EText({ text, streaming, building }: { text: string; streaming?: boolean; building?: boolean }) {
  const html = useMemo(() => (streaming || !text ? null : renderMd(text)), [text, streaming]);
  if (html === null) return <>{text || (building ? 'Making it…' : '…')}</>;
  return <span className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
