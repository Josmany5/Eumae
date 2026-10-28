import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNav } from '../nav';
import { useMedia } from '../useMedia';
import { Icon } from './shell/icons';
import { SbxFrame } from './SandboxView';
import { streamChat } from '../chat';
import { toApiBody, buildRequest, BASE_PROMPT } from '../request';
import { addFromReply, extractHtml, hideHtmlWhileStreaming, latestForThread, sandboxContext, setCur, subscribeSbx, sbxVersion } from '../sandbox';
import { addFileWith, setStatus, saveEdit, getFiles } from '../library';
import { armDraft } from '../studio';
import { groupOfKind, type StepId } from '../studioGuide';
import {
  getSession,
  saveSession,
  startWith,
  answer,
  toggle,
  doneMulti,
  skip,
  askNext,
  askStep,
  stepsOf,
  kindOfSession,
  specOf,
  specCount,
  briefOfSession,
  parseSpecReply,
  hideSpec,
  mid,
  STUDIO_CHATS_EVENT,
  type Session,
} from '../studioChat';

/* One Studio item: chat, spec and preview on one screen (his call, Oct 27).
 * Desktop: chat left, Spec / Preview / Versions right. Phone: the spec is a
 * card pinned on top; tap it for the spec or the preview full screen. */

function useSession(id: string): Session | undefined {
  const [, setT] = useState(0);
  useEffect(() => {
    const f = () => setT((t) => t + 1);
    window.addEventListener(STUDIO_CHATS_EVENT, f);
    return () => window.removeEventListener(STUDIO_CHATS_EVENT, f);
  }, []);
  return getSession(id);
}

export function StudioChat({ id, onBack }: { id: string; onBack: () => void }) {
  const { turn, notify } = useNav();
  const wide = useMedia('(min-width:900px)');
  const s = useSession(id);
  useSyncExternalStore(subscribeSbx, sbxVersion);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'spec' | 'build'>('');
  const [tab, setTab] = useState<'spec' | 'preview' | 'versions'>('spec');
  const [sheet, setSheet] = useState(false);
  const [adding, setAdding] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const last = s?.msgs[s.msgs.length - 1]?.id;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last, s?.msgs.length]);

  if (!s) return null;
  const kd = kindOfSession(s);
  const steps = stepsOf(s);
  const g = groupOfKind(kd.n);
  const thread = `studio:${s.id}`;
  const page = latestForThread(thread);
  const put = (next: Session) => saveSession(next);

  /* A real Studio draft from the first answer on, so it shows in Drafts. */
  const ensureDraft = (x: Session): Session => {
    if (x.fileId && getFiles().some((f) => f.id === x.fileId)) return x;
    const f = addFileWith(x.title.slice(0, 80), kd.lib, briefOfSession(x));
    setStatus(f.id, 'draft');
    return { ...x, fileId: f.id };
  };
  const act = (fn: (x: Session) => Session) => {
    const cur = getSession(s.id) ?? s;
    put(ensureDraft(fn(cur)));
  };

  /* Typed words: a short answer to a one-answer question just answers it;
     anything else goes to Eumae, who adds it to the spec and asks a follow-up.
     After a build, typed words change the build. */
  const send = (raw?: string) => {
    const q = (raw ?? text).trim();
    if (!q || busy) return;
    if (raw === undefined) setText('');
    const cur = getSession(s.id) ?? s;
    if (!cur.started) {
      act((x) => startWith(x, null, q));
      return;
    }
    if (page) return build(q);
    const st = steps[cur.step];
    if (st && !st.multi && q.length <= 60 && raw === undefined) {
      act((x) => answer(x, st.id, q));
      return;
    }
    askEumae(q);
  };

  const askEumae = (q: string) => {
    const base = ensureDraft(getSession(s.id) ?? s);
    const replyId = mid();
    const withMine: Session = { ...base, msgs: [...base.msgs, { id: mid(), who: 'u', text: q }, { id: replyId, who: 'e', text: '', streaming: true }] };
    put(withMine);
    setBusy('spec');
    const body = toApiBody(buildRequest(turn, [], q), [], null);
    const recent = base.msgs.slice(-8).map((m) => `${m.who === 'u' ? 'Them' : 'Eumae'}: ${m.text}`).join('\n');
    body.data.systemPrompt = BASE_PROMPT + '\n\n\u27E6studio:spec\u27E7' +
      `\n\n# KIND\n${kd.n}${base.tpl ? ' (' + base.tpl + ')' : ''}\n\n# SPEC SO FAR\n${briefOfSession(base)}\n\n# RECENT CHAT\n${recent}`;
    void streamChat(body, (full) => {
      const x = getSession(s.id);
      if (!x) return;
      put({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: hideSpec(full) } : m)) });
    }).then((reply) => {
      setBusy('');
      const x = getSession(s.id);
      if (!x) return;
      const r = reply.ok ? parseSpecReply(reply.text) : { say: reply.error ?? 'I could not reach Eumae just now.', add: [], chips: [] };
      const extra = [...x.extra, ...r.add.filter((l) => !x.extra.includes(l))];
      put({
        ...x,
        extra,
        msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: r.say || (r.add.length ? 'Added to the spec.' : 'Got it.'), chips: r.chips, streaming: false } : m)),
      });
    });
  };

  /* Make it (or change it): the page builds here, as a new version. */
  const build = (change?: string) => {
    if (busy) return;
    let base = ensureDraft(getSession(s.id) ?? s);
    const replyId = mid();
    const ask = change ?? briefOfSession(base);
    base = {
      ...base,
      msgs: [...base.msgs, { id: mid(), who: 'u', text: change ?? 'Make it' }, { id: replyId, who: 'e', text: 'Making it…', streaming: true }],
    };
    put(base);
    setBusy('build');
    if (!wide) setSheet(false);
    const body = toApiBody(buildRequest(turn, [], ask), [], null);
    body.data.systemPrompt += '\n\n\u27E6role:studio\u27E7\n\u27E6visual\u27E7' + (change ? sandboxContext(thread) + `\n\n# THE SPEC\n${briefOfSession(base)}` : '');
    if (base.fileId && !page) armDraft(base.fileId);
    void streamChat(body, (full) => {
      const x = getSession(s.id);
      if (!x) return;
      const h = hideHtmlWhileStreaming(full);
      put({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: h.text || 'Making it…' } : m)) });
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
        say = reply.error ?? 'Something went wrong making it. Try Make it again.';
      }
      put({ ...x, msgs: x.msgs.map((m) => (m.id === replyId ? { ...m, text: say || 'Done.', streaming: false } : m)) });
    });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const textish = /^text\/|json|csv|markdown/.test(f.type) || /\.(txt|md|csv|json|tsv)$/i.test(f.name);
    const body = textish && f.size < 300_000 ? await f.text() : '';
    act((x) => ({
      ...x,
      files: [...x.files, { name: f.name, text: body.slice(0, 6000) }],
      msgs: [...x.msgs, { id: mid(), who: 'u', text: `Attached ${f.name}` }, { id: mid(), who: 'e', text: body ? `Got it. I'll use what's in ${f.name}.` : `Got ${f.name}. I can't read inside that kind of file yet, so tell me what matters in it.` }],
    }));
  };

  /* ---- Pills under Eumae's latest question ---- */
  const lastE = [...s.msgs].reverse().find((m) => m.who === 'e');
  const pills = () => {
    if (!lastE || lastE.streaming || busy) return null;
    if (lastE.step === 'start' && !s.started) {
      return (
        <div className="scPills">
          {kd.templates.map((t) => (
            <button key={t.n} className="chip" onClick={() => act((x) => startWith(x, t.n))} title={t.d}>
              {t.n}
            </button>
          ))}
          <button className="chip" onClick={() => act((x) => startWith(x, null))}>Custom</button>
        </div>
      );
    }
    if (lastE.step && lastE.step !== 'start') {
      const st = steps.find((x) => x.id === lastE.step);
      if (!st) return null;
      const v = s.picks[st.id];
      const on = (l: string) => (Array.isArray(v) ? v.includes(l) : v === l);
      return (
        <div className="scPills">
          {st.opts.map((o) => (
            <button
              key={o.l}
              className={'chip' + (on(o.l) ? ' on' : '')}
              onClick={() => act((x) => (st.multi ? toggle(x, st.id, o.l) : answer(x, st.id, o.l)))}
            >
              {o.thumb ? <i className="sgSw" style={{ background: o.thumb.bg, border: '1px solid var(--hair)' }} /> : null}
              {o.sw ? o.sw.map((c) => <i key={c} className="sgSw" style={{ background: c }} />) : null}
              {o.l}
            </button>
          ))}
          {st.multi ? (
            <button className="chip scGo" onClick={() => act((x) => doneMulti(x, st.id))}>Done</button>
          ) : null}
          <button className="chip scSkip" onClick={() => act((x) => skip(x, st.id))}>Skip</button>
        </div>
      );
    }
    if (lastE.chips?.length || s.step < steps.length) {
      return (
        <div className="scPills">
          {(lastE.chips ?? []).map((c) => (
            <button key={c} className="chip" onClick={() => send(c)}>{c}</button>
          ))}
          {s.started && s.step < steps.length && !page ? (
            <button className="chip scGo" onClick={() => act((x) => askNext(x))}>Next: {steps[s.step].name}</button>
          ) : null}
        </div>
      );
    }
    return null;
  };

  const spec = specOf(s);
  const specCard = (
    <div className="scSpec">
      {spec.map((sec) => (
        <div key={sec.h} className="scSec">
          <div className="scSecH">{sec.h}</div>
          {sec.lines.length ? (
            sec.lines.map((l, i) => (
              <div key={sec.h + i} className="scLine">
                {l.step ? (
                  <button className="scLineT" onClick={() => act((x) => askStep(x, l.step as StepId))} title="Change this">
                    {l.text}
                  </button>
                ) : (
                  <span className="scLineT">{l.text}</span>
                )}
                {l.extra !== undefined ? (
                  <button className="scX" aria-label="Remove" onClick={() => act((x) => ({ ...x, extra: x.extra.filter((_, j) => j !== l.extra) }))}>
                    ×
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <div className="scLine m">Not set yet</div>
          )}
        </div>
      ))}
      <div className="scAdd">
        <input
          className="lib2-search"
          placeholder="+ Add a requirement"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && adding.trim()) {
              const l = adding.trim();
              setAdding('');
              act((x) => ({ ...x, extra: [...x.extra, l] }));
            }
          }}
          aria-label="Add a requirement"
        />
      </div>
      <div className="btns">
        <button className="pri" disabled={!!busy} onClick={() => build()}>{page ? 'Make it again from the spec' : 'Make it'}</button>
      </div>
      {!page && s.started && s.step < steps.length ? <div className="xs m">Eumae fills any gaps with what fits best.</div> : null}
    </div>
  );

  const preview = page ? (
    <SbxFrame html={page.versions[page.cur]?.html ?? ''} title={page.title} className="sbxFrame scFrame" />
  ) : (
    <div className="s m scEmpty">{busy === 'build' ? 'Making it…' : 'Nothing made yet. Tap Make it when the spec looks right.'}</div>
  );
  const versions = page ? (
    <div className="tkList">
      {page.versions.map((v, i) => (
        <button key={v.at} className={'scVer' + (i === page.cur ? ' on' : '')} onClick={() => { setCur(page.id, i); setTab('preview'); }}>
          <span>v{i + 1} · {v.label}</span>
          <span className="m">{new Date(v.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        </button>
      )).reverse()}
    </div>
  ) : (
    <div className="s m scEmpty">Versions show up here after the first build.</div>
  );

  const side = (
    <>
      <div className="scTabs">
        {(['spec', 'preview', 'versions'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'spec' ? 'Spec' : t === 'preview' ? 'Preview' : `Versions${page ? ' · ' + page.versions.length : ''}`}
          </button>
        ))}
        {!wide ? <button className="scClose" onClick={() => setSheet(false)} aria-label="Close"><Icon name="x" /></button> : null}
      </div>
      {tab === 'spec' ? specCard : tab === 'preview' ? preview : versions}
    </>
  );

  const placeholder = !s.started
    ? 'Or describe it in your own words…'
    : page
      ? 'Tell Eumae what to change…'
      : 'Tell Eumae anything: how it works, the content, rules…';

  return (
    <div className="scWrap">
      <div className="scMain">
        <div className="scHead">
          <button className="hb" onClick={onBack} aria-label="Back"><Icon name="bk" /></button>
          <div className="scHeadT">
            <div className="xs m">Studio › {g?.n} › {kd.n}</div>
            <div className="scTitle">{s.title}</div>
          </div>
          {s.started ? (
            <button className="pri scMake" disabled={!!busy} onClick={() => build()}>{busy === 'build' ? 'Making…' : page ? 'Remake' : 'Make it'}</button>
          ) : null}
        </div>
        {!wide ? (
          <button className="scPin" onClick={() => { setTab(page ? 'preview' : 'spec'); setSheet(true); }}>
            <span className="scPinT"><b>Spec · {specCount(s)} lines</b><span className="m">{page ? 'Preview ›' : 'Open ›'}</span></span>
            <span className="m scPinS">{spec.flatMap((x) => x.lines).slice(1).map((l) => l.text).join(' · ') || 'Fills in as you answer'}</span>
          </button>
        ) : null}
        <div className="scMsgs" ref={scroller}>
          {s.msgs.map((m) => (
            <div key={m.id} className={'msg' + (m.who === 'u' ? ' you' : '')}>
              <div className="bubble">{m.text || (m.streaming ? '…' : '')}</div>
            </div>
          ))}
          {pills()}
        </div>
        <div className="cmp scCmp">
          <button className="hb" onClick={() => fileIn.current?.click()} aria-label="Attach a file"><Icon name="pls" /></button>
          <input ref={fileIn} type="file" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <textarea
            className="cmpIn"
            rows={1}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Message Eumae"
          />
          <button className="pri scSend" disabled={!text.trim() || !!busy} onClick={() => send()}>Send</button>
        </div>
      </div>
      {wide ? <div className="scSide">{side}</div> : sheet ? <div className="scSheet">{side}</div> : null}
    </div>
  );
}
