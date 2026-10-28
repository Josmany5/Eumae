import { FileMenu } from '../components/FileMenu';
import { ProjectChip } from '../components/ItemMenu';
import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../nav';
import { queueBrief, armDraft } from '../studio';
import {
  GROUPS,
  KINDS,
  stepsFor,
  briefOf,
  searchStudio,
  groupOfKind,
  guessKind,
  type Kind,
  type Template,
  type Picks,
  type StepId,
} from '../studioGuide';
import { getFiles, addFileWith, setStatus, snapshotLibrary, restoreLibrary, type LibFile } from '../library';
import { allSbx, removeSbx, restoreSbx, snapshotSbx, keepAsDraft, openSbx, type SbxItem } from '../sandbox';
import { useSbx } from '../components/SandboxView';
import { ItemMenu } from '../components/ItemMenu';
import { rowTap } from '../rowTap';
import { undoable } from '../undo';
import { useMedia } from '../useMedia';
import { getThread } from '../threads';
import { Icon } from '../components/shell/icons';

/* Studio = discovery (his call, Oct 27, 9:42 PM). Chat is where you just make
 * things; Studio shows what's possible and helps you get specific first.
 *
 * Walk: home (make box, Drafts, Published, the 4 groups) -> a group's kinds
 * -> a kind's templates (Custom first) -> the guided steps (one question at a
 * time, real example picks, brief filling in live, Eumae's tip) -> Make it,
 * which starts a Studio draft and opens a fresh Chat with the full brief.
 * Data lives in studioGuide.ts. */

type Walk =
  | { at: 'home' }
  | { at: 'group'; group: string }
  | { at: 'kind'; kind: string }
  | { at: 'guide'; kind: string; tpl: string | null; seed?: string };

export default function StudioScreen() {
  const { notify, go, goTab, newChat, currentThreadId, switchThread, openPanel } = useNav();
  useSbx();
  const wide = useMedia('(min-width:900px)');
  const [walk, setWalk] = useState<Walk>({ at: 'home' });
  const [tick, setTick] = useState(0);
  const [shelf, setShelf] = useState<'drafts' | 'pub' | null>(null);

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const files = getFiles();
  void tick;
  const made = files.filter((f) => f.st === 'draft');
  const published = files.filter((f) => f.st !== 'draft');
  /* Pages made in a chat that were never kept: they are drafts too. */
  const loose = allSbx().filter((x) => !x.fileId || !files.some((f) => f.id === x.fileId));
  const refresh = () => setTick((t) => t + 1);
  const openLoose = (x: SbxItem) => {
    if (x.threadId) switchThread(x.threadId);
    else goTab('chat');
    openSbx(x.id);
    if (wide) openPanel('sandbox');
  };

  const pickKind = (k: string) => {
    const kd = KINDS[k];
    if (kd?.soon) {
      notify(`${kd.n} is coming soon. It needs the backend first.`);
      return;
    }
    setWalk({ at: 'kind', kind: k });
  };

  /* Make it: a real Studio draft now (the brief is v1, the chat's page becomes
     the next versions), then a fresh chat with the whole brief. */
  const make = (kind: Kind, tpl: Template | null, picks: Picks) => {
    const brief = briefOf(kind, tpl, picks);
    const title = (typeof picks.describe === 'string' && picks.describe.trim()) || (tpl ? tpl.n : kind.n);
    const lib = snapshotLibrary();
    const f = addFileWith(title.slice(0, 80), kind.lib, brief);
    setStatus(f.id, 'draft');
    armDraft(f.id);
    queueBrief(brief);
    notify('Draft started in Studio. Brief sent to Chat.', { undo: () => restoreLibrary(lib) });
    setWalk({ at: 'home' });
    const cur = currentThreadId ? getThread(currentThreadId) : undefined;
    if (cur && cur.messages.length > 0) newChat();
    else goTab('chat');
  };

  if (walk.at === 'group') {
    const g = GROUPS.find((x) => x.n === walk.group);
    if (!g) return null;
    return (
      <div>
        <BackBar onBack={() => setWalk({ at: 'home' })} />
        <div className="xs m">Studio › {g.n}</div>
        <div className="screenT">{g.n}</div>
        <div className="s m">{g.d}</div>
        <div className="stGrid" style={{ marginTop: 14 }}>
          {g.kinds.map((k) => {
            const kd = KINDS[k];
            return (
              <button key={k} className="stTile" onClick={() => pickKind(k)}>
                <Icon name={kd.icon} />
                <span className="stName">
                  {kd.n} {kd.soon ? <span className="tag am">Soon</span> : null}
                </span>
                <span className="stSub">{kd.d}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (walk.at === 'kind') {
    const kd = KINDS[walk.kind];
    if (!kd) return null;
    const g = groupOfKind(kd.n);
    return (
      <div>
        <BackBar onBack={() => setWalk(g ? { at: 'group', group: g.n } : { at: 'home' })} />
        <div className="xs m">Studio › {g?.n} › {kd.n}</div>
        <div className="screenT">{kd.n}</div>
        <div className="s m">Start from one of these, or make your own.</div>
        <div className="sgTpls">
          <button className="sgTpl sgCustom" onClick={() => setWalk({ at: 'guide', kind: kd.n, tpl: null })}>
            <span className="sgTplThumb">+</span>
            <b>Custom</b>
            <span className="m">Describe your own {kd.n.toLowerCase()}</span>
          </button>
          {kd.templates.map((t, i) => (
            <button key={t.n} className="sgTpl" onClick={() => setWalk({ at: 'guide', kind: kd.n, tpl: t.n })}>
              <span className={'sgTplThumb sgT' + (i % 3)}>{t.n}</span>
              <b>{t.n}</b>
              <span className="m">{t.d}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (walk.at === 'guide') {
    const kd = KINDS[walk.kind];
    if (!kd) return null;
    const tpl = walk.tpl ? kd.templates.find((t) => t.n === walk.tpl) ?? null : null;
    return (
      <Guide
        key={kd.n + '|' + (tpl?.n ?? 'custom') + '|' + (walk.seed ?? '')}
        kind={kd}
        tpl={tpl}
        seed={walk.seed}
        onBack={() => setWalk(walk.seed !== undefined ? { at: 'home' } : { at: 'kind', kind: kd.n })}
        onMake={(p) => make(kd, tpl, p)}
        onAsk={() => openPanel('eumae')}
      />
    );
  }

  return (
    <div>
      <div className="screenT dupT">Your studio</div>
      <div className="s m">See what you can make, get specific, and Eumae helps along the way.</div>
      <MakeBox
        onKind={pickKind}
        onTpl={(k, t) => setWalk({ at: 'guide', kind: k, tpl: t })}
        onFree={(text) => setWalk({ at: 'guide', kind: guessKind(text), tpl: null, seed: text })}
      />
      <div className="sgShelves">
        <button className={'sgShelf' + (shelf === 'drafts' ? ' on' : '')} onClick={() => setShelf(shelf === 'drafts' ? null : 'drafts')}>
          Drafts · {made.length + loose.length}
        </button>
        <button className={'sgShelf' + (shelf === 'pub' ? ' on' : '')} onClick={() => setShelf(shelf === 'pub' ? null : 'pub')}>
          Published · {published.length}
        </button>
      </div>
      {shelf ? (
        <div className="tkList" style={{ marginTop: 8 }}>
          {shelf === 'drafts' ? (
            made.length + loose.length ? (
              <>
                {made.map((f) => (
                  <StudioRow key={f.id} file={f} onOpen={(x) => go('sitem', x.id)} onChange={refresh} />
                ))}
                {loose.map((x) => (
                  <LooseRow key={x.id} item={x} onOpen={() => openLoose(x)} onChange={refresh} />
                ))}
              </>
            ) : (
              <div className="s m">No drafts yet.</div>
            )
          ) : published.length ? (
            published.map((f) => (
              <StudioRow key={f.id} file={f} onOpen={(x) => go('sitem', x.id)} onChange={refresh} />
            ))
          ) : (
            <div className="s m">Nothing published yet.</div>
          )}
        </div>
      ) : null}
      {GROUPS.map((g) => (
        <section key={g.n}>
          <h3 className="sec">{g.n}</h3>
          <div className="stGrid">
            {g.kinds.map((k) => {
              const kd = KINDS[k];
              return (
                <button key={k} className="stTile" onClick={() => pickKind(k)}>
                  <Icon name={kd.icon} />
                  <span className="stName">
                    {kd.n} {kd.soon ? <span className="tag am">Soon</span> : null}
                  </span>
                  <span className="stSub">{kd.d}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* The box at the top: type what you want. Matches show as you type; Enter or
   the last row starts from scratch with your words as the description. */
function MakeBox({ onKind, onTpl, onFree }: {
  onKind: (k: string) => void; onTpl: (k: string, t: string) => void; onFree: (text: string) => void;
}) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchStudio(q), [q]);
  const t = q.trim();
  return (
    <div style={{ marginTop: 12 }}>
      <input
        className="lib2-search"
        style={{ width: '100%', maxWidth: 560, padding: '12px 14px' }}
        placeholder="What do you want to make?"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && t) onFree(t);
          if (e.key === 'Escape') setQ('');
        }}
        aria-label="What do you want to make?"
      />
      {t ? (
        <div className="sgHits">
          {hits.map((h) => (
            <button
              key={h.kind + (h.tpl ?? '')}
              className="sgHit"
              onClick={() => (h.tpl ? onTpl(h.kind, h.tpl) : onKind(h.kind))}
            >
              <span>{h.tpl ?? h.kind}</span>
              <span>{h.tpl ? h.kind : 'Kind'}</span>
            </button>
          ))}
          <button className="sgHit" onClick={() => onFree(t)}>
            <span>Start “{t}” from scratch</span>
            <span>Custom</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* The guided steps: one question at a time, picks from real examples, a
   Something else box on every step, the brief filling in live, Eumae's tip. */
function Guide({ kind, tpl, seed, onBack, onMake, onAsk }: {
  kind: Kind; tpl: Template | null; seed?: string;
  onBack: () => void; onMake: (p: Picks) => void; onAsk: () => void;
}) {
  const custom = !tpl;
  const steps = useMemo(() => stepsFor(kind, custom), [kind, custom]);
  const [picks, setPicks] = useState<Picks>(() => ({ ...(tpl?.preset ?? {}), ...(seed ? { describe: seed } : {}) }));
  const [i, setI] = useState(() => (seed ? Math.min(1, steps.length - 1) : 0));
  const [other, setOther] = useState('');
  const step = steps[i];
  const g = groupOfKind(kind.n);
  const val = picks[step.id];
  const isOn = (l: string) => (Array.isArray(val) ? val.includes(l) : val === l);

  const choose = (l: string) => {
    setPicks((p) => {
      if (step.multi) {
        const cur = Array.isArray(p[step.id]) ? (p[step.id] as string[]) : [];
        return { ...p, [step.id]: cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l] };
      }
      return { ...p, [step.id]: p[step.id] === l ? undefined : l };
    });
  };
  const addOther = () => {
    const x = other.trim();
    if (!x) return;
    if (step.multi) {
      setPicks((p) => {
        const cur = Array.isArray(p[step.id]) ? (p[step.id] as string[]) : [];
        return { ...p, [step.id]: cur.includes(x) ? cur : [...cur, x] };
      });
    } else setPicks((p) => ({ ...p, [step.id]: x }));
    setOther('');
  };
  const goStep = (n: number) => {
    setOther('');
    setI(Math.max(0, Math.min(steps.length - 1, n)));
  };
  const last = i === steps.length - 1;
  const show = (id: StepId) => {
    const v = picks[id];
    return Array.isArray(v) ? v.join(', ') : v || '';
  };

  return (
    <div className="sgWrap">
      <div className="sgMain">
        <BackBar onBack={onBack} />
        <div className="xs m">Studio › {g?.n} › {kind.n}{tpl ? ' › ' + tpl.n : ' › Custom'}</div>
        <div className="screenT">{tpl ? tpl.n : 'Custom ' + kind.n.toLowerCase()}</div>
        <div className="sgSteps">
          {steps.map((st, n) => (
            <button
              key={st.id}
              className={n === i ? 'on' : show(st.id) ? 'done' : ''}
              onClick={() => goStep(n)}
            >
              {show(st.id) && n !== i ? '✓ ' : `${n + 1} `}
              {st.name}
            </button>
          ))}
        </div>
        <div className="sgQ">{step.q}</div>
        {step.id === 'describe' ? (
          <textarea
            className="sinput"
            style={{ minHeight: 90, display: 'block', width: '100%', maxWidth: 560, font: 'inherit', resize: 'vertical' }}
            placeholder={`A ${kind.n.toLowerCase()} for...`}
            value={typeof picks.describe === 'string' ? picks.describe : ''}
            onChange={(e) => setPicks((p) => ({ ...p, describe: e.target.value }))}
            aria-label="Describe it"
          />
        ) : (
          <>
            <div className="m s" style={{ marginBottom: 10 }}>
              {step.multi ? 'Tick all that fit.' : 'Tap one.'} Or write your own.
            </div>
            {step.id === 'style' ? (
              <div className="sgStyles">
                {step.opts.map((o) => (
                  <button key={o.l} className={'sgStyle' + (isOn(o.l) ? ' on' : '')} onClick={() => choose(o.l)}>
                    <span className="sgThumb" style={{ background: o.thumb?.bg, color: o.thumb?.fg }}>{o.thumb?.t}</span>
                    <b>{o.l}</b>
                    <span className="m">{o.d}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="sgChips">
                {step.opts.map((o) => (
                  <button key={o.l} className={'chip' + (isOn(o.l) ? ' on' : '')} onClick={() => choose(o.l)}>
                    {o.sw ? o.sw.map((c) => <i key={c} className="sgSw" style={{ background: c }} />) : null}
                    {o.l}
                  </button>
                ))}
                {Array.isArray(val)
                  ? val.filter((v) => !step.opts.some((o) => o.l === v)).map((v) => (
                      <button key={v} className="chip on" onClick={() => choose(v)}>{v}</button>
                    ))
                  : typeof val === 'string' && val && !step.opts.some((o) => o.l === val) ? (
                      <button className="chip on" onClick={() => choose(val)}>{val}</button>
                    ) : null}
              </div>
            )}
            <div className="sgOther">
              <input
                className="lib2-search"
                placeholder="Something else..."
                value={other}
                onChange={(e) => setOther(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addOther();
                }}
                aria-label="Something else"
              />
              {other.trim() ? <button className="fb" onClick={addOther}>Add</button> : null}
            </div>
          </>
        )}
        <div className="btns">
          {last ? (
            <button className="pri" onClick={() => onMake(picks)}>Make it</button>
          ) : (
            <button className="pri" onClick={() => goStep(i + 1)}>Next: {steps[i + 1].name}</button>
          )}
          {i > 0 ? <button className="gho" onClick={() => goStep(i - 1)}>Back</button> : null}
          {!last ? <button className="gho" onClick={() => onMake(picks)}>Skip the rest, make it now</button> : null}
        </div>
      </div>
      <div className="sgSide">
        <div className="sgCard">
          <div className="sgCardT">Your brief, so far</div>
          <div className="kv"><span className="m">Kind</span><span>{tpl ? `${kind.n} · ${tpl.n}` : kind.n}</span></div>
          {steps.map((st) => (
            <div key={st.id} className="kv">
              <span className="m">{st.name}</span>
              <span className={show(st.id) ? '' : 'm'}>{show(st.id) || '—'}</span>
            </div>
          ))}
          <div className="btns">
            <button className="pri" onClick={() => onMake(picks)}>Make it</button>
          </div>
        </div>
        <div className="sgCard">
          <div className="sgCardT">Eumae</div>
          <div><b className="sgTipB">Tip:</b> {step.tip}</div>
          <div className="btns">
            <button className="fb" onClick={onAsk}>Ask Eumae about it</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ago(ms: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const KIND_WORD: Record<string, string> = {
  DOC: 'Document', PDF: 'PDF', IMG: 'Image', WEB: 'Page', WIDGET: 'Widget', GAME: 'Game',
  LINK: 'Link', ROUTINE: 'Automation', COURSE: 'Course', DIGEST: 'Digest',
};

function StudioRow({ file, onOpen, onChange }: { file: LibFile; onOpen: (f: LibFile) => void; onChange: () => void }) {
  const last = Math.max(file.createdAt, ...(file.hist ?? []).map((h) => h.at));
  const open = () => onOpen(file);
  return (
    <div className="frow top tkRow gRow tapRow" onClick={rowTap(open)}>
      <div className="ft">
        <button className="tlT" onClick={open}>
          <span>{file.t}</span>
        </button>
        <div className="fsub">{[KIND_WORD[file.k] || file.k, `v${file.v}`, ago(last)].join(' · ')}</div>
        <ProjectChip k="file" id={file.id} />
      </div>
      <FileMenu file={file} openTo={open} onChange={onChange} />
    </div>
  );
}

/* A page from a chat that was never kept. Open goes to its chat; Keep makes
   it a Studio draft; Delete throws the page away (the chat keeps its words). */
function LooseRow({ item, onOpen, onChange }: { item: SbxItem; onOpen: () => void; onChange: () => void }) {
  const { notify } = useNav();
  const last = item.versions[item.versions.length - 1]?.at ?? item.createdAt;
  return (
    <div className="frow top tkRow gRow tapRow" onClick={rowTap(onOpen)}>
      <div className="ft">
        <button className="tlT" onClick={onOpen}>
          <span>{item.title || 'Untitled page'}</span>
        </button>
        <div className="fsub">{['Page in a chat', `v${item.versions.length}`, ago(last), 'not kept yet'].join(' · ')}</div>
      </div>
      <ItemMenu
        name={item.title || 'Untitled page'}
        open={onOpen}
        openLabel="Open in its chat"
        extra={[
          {
            label: 'Keep as draft',
            onClick: () => {
              const lib = snapshotLibrary();
              const sb = snapshotSbx();
              if (keepAsDraft(item.id)) {
                onChange();
                notify('Kept as a draft.', {
                  undo: () => {
                    restoreLibrary(lib);
                    restoreSbx(sb);
                    onChange();
                  },
                });
              }
            },
          },
        ]}
        onChange={onChange}
        onDelete={() => undoable(notify, 'Page deleted.', snapshotSbx, restoreSbx, () => removeSbx(item.id), onChange)}
      />
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="backbar">
      <button className="hb" onClick={onBack} aria-label="Back">
        <Icon name="bk" />
      </button>
      <div className="tt" />
    </div>
  );
}

