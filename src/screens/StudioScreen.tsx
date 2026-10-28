import { FileMenu } from '../components/FileMenu';
import { ProjectChip } from '../components/ItemMenu';
import { useEffect, useState } from 'react';
import { useNav } from '../nav';
import {
  STUDIO_CATEGORIES,
  STUDIO_CATEGORY_ORDER,
  STUDIO_CATEGORY_ICONS,
  templateOf,
  categoryOf,
  buildBrief,
  queueBrief,
  kindFor,
  armDraft,
} from '../studio';
import { getFiles, addFileWith, setStatus, snapshotLibrary, restoreLibrary, type LibFile } from '../library';
import { allSbx, removeSbx, restoreSbx, snapshotSbx, keepAsDraft, openSbx, type SbxItem } from '../sandbox';
import { useSbx } from '../components/SandboxView';
import { ItemMenu } from '../components/ItemMenu';
import { rowTap } from '../rowTap';
import { undoable } from '../undo';
import { useMedia } from '../useMedia';
import { getThread } from '../threads';
import { createProject, saveProject } from '../projects';
import { createFlow } from '../flows';
import { Icon } from '../components/shell/icons';

/* The Studio — the mockup's latest create layer, rebuilt as React.
 *
 * Root ("Your studio", studioRoot12): Published section (→ Library) +
 * Drafts with Show/Hide (drOpen10, persisted) + 12 category rows (TY8 with
 * counts). Picking a category walks the gallery: category → template list
 * (TY8[sCat]) → template detail (TPL8: explainer + starter variants +
 * "good one" checklist + purpose/details → Make it in Chat). sCat/stS/sTpl
 * live in screen state — the walk resets on tab switch, like the mockup.
 *
 * Make it in Chat (goBuild8): Project/Flow/Routine create directly on the
 * real stores AND queue the brief to Chat; everything else just queues the
 * brief. Chat takes the brief once on arrival and sends it.
 */

type Walk = { cat: string | null; tpl: string | null };

export default function StudioScreen() {
  const { notify, go, goTab, newChat, currentThreadId, switchThread, openPanel } = useNav();
  useSbx();
  const wide = useMedia('(min-width:900px)');
  const [walk, setWalk] = useState<Walk>({ cat: null, tpl: null });
  const [variant, setVariant] = useState(0);
  const [purpose, setPurpose] = useState('');
  const [details, setDetails] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const files = getFiles();
  const made = files.filter((f) => f.st === 'draft');
  void tick;
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

  /* Make it in Chat — the mockup's goBuild8. Direct creates on the real
     stores, brief queued for Chat either way. */
  const build = () => {
    const tpl = walk.tpl;
    if (!tpl) return;
    const cat = categoryOf(tpl) ?? walk.cat ?? '';
    const brief = buildBrief(tpl, variant, purpose, details);
    const pu = purpose.trim();
    const de = details.trim();
    if (cat === 'Project') {
      const p = createProject((pu || tpl).slice(0, 48));
      saveProject({ ...p, d: de || templateOf(tpl)?.u || '' });
      notify('Project created — brief sent to Chat.');
    } else if (kindFor(cat, tpl)) {
      /* Everything else starts as a real Studio draft right now. The brief is
         its first version; the page the chat makes becomes the next one. */
      const lib = snapshotLibrary();
      const f = addFileWith((pu || tpl).slice(0, 80), kindFor(cat, tpl)!, brief);
      setStatus(f.id, 'draft');
      armDraft(f.id);
      notify('Draft started in Studio. Brief sent to Chat.', { undo: () => restoreLibrary(lib) });
    } else if (cat === 'Flow' || cat === 'Routine') {
      const steps = de
        .split(/[\n.;]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const t = templateOf(tpl);
      createFlow(pu || tpl, cat === 'Routine' ? 'routine' : 'flow', {
        steps: steps.length ? steps : t ? [...t.s] : [],
      });
      notify(`${cat} created — brief sent to Chat.`);
    }
    queueBrief(brief);
    setWalk({ cat: null, tpl: null });
    setVariant(0);
    setPurpose('');
    setDetails('');
    /* A brief always lands in an empty chat (his call, Oct 20): the chat you
       were in stays as it was, and a new one opens with the brief sent. */
    const cur = currentThreadId ? getThread(currentThreadId) : undefined;
    if (cur && cur.messages.length > 0) newChat();
    else goTab('chat');
  };

  if (!walk.cat) {
    return (
      <StudioRoot
        published={published}
        made={made}
        loose={loose}
        onOpenLoose={openLoose}
        onChange={refresh}
        onPickCat={(cat) => setWalk({ cat, tpl: null })}
        onPickTpl={(tpl) => {
          setWalk({ cat: categoryOf(tpl), tpl });
          setVariant(0);
          setPurpose('');
          setDetails('');
        }}
        onOpen={(f) => go('sitem', f.id)}
      />
    );
  }
  if (!walk.tpl) {
    return (
      <CategoryView
        cat={walk.cat}
        onBack={() => setWalk({ cat: null, tpl: null })}
        onPickCat={(cat) => setWalk({ cat, tpl: null })}
        onPickTpl={(tpl) => {
          setWalk({ cat: walk.cat, tpl });
          setVariant(0);
          setPurpose('');
          setDetails('');
        }}
      />
    );
  }
  const t = templateOf(walk.tpl);
  if (!t) {
    setWalk({ cat: walk.cat, tpl: null });
    return null;
  }
  return (
    <TemplateView
      name={walk.tpl}
      cat={walk.cat}
      variant={variant}
      onVariant={setVariant}
      purpose={purpose}
      onPurpose={setPurpose}
      details={details}
      onDetails={setDetails}
      onBack={() => setWalk({ cat: categoryOf(walk.tpl!) ?? walk.cat, tpl: null })}
      onBuild={build}
      onLearn={() => go('lesson', walk.tpl)}
    />
  );
}

function StudioRoot({ published, made, loose, onOpenLoose, onChange, onPickCat, onPickTpl, onOpen }: {
  published: LibFile[]; made: LibFile[]; loose: SbxItem[];
  onOpenLoose: (x: SbxItem) => void; onChange: () => void;
  onPickCat: (cat: string) => void; onPickTpl: (tpl: string) => void; onOpen: (f: LibFile) => void;
}) {
  const drafts = made.length + loose.length;
  return (
    <div>
      <div className="screenT dupT">Your studio</div>
      <div className="s m">Everything you have made - drafts, published, every version.</div>
      <div className="btns">
        <button className="pri" onClick={() => onPickCat("__gallery__")}>Make something new</button>
      </div>
      <TemplateSearch onPickTpl={onPickTpl} />
      <h3 className="sec">What can I make?</h3>
      <div className="stGrid">
        {STUDIO_CATEGORY_ORDER.map((cat) => (
          <button key={cat} className="stTile" onClick={() => onPickCat(cat)}>
            <Icon name={STUDIO_CATEGORY_ICONS[cat] || 'pls'} />
            <span className="stName">{cat}</span>
            <span className="stSub">{STUDIO_CATEGORIES[cat].length} kinds</span>
          </button>
        ))}
      </div>
      <div className="tkList" style={{ marginTop: 14 }}>
        {drafts ? (
          <section className="tkGroup">
            <div className="sdiv tkH">
              <span>Drafts</span>
              <span className="fmeta">{drafts}</span>
            </div>
            {made.map((f) => (
              <StudioRow key={f.id} file={f} onOpen={onOpen} onChange={onChange} />
            ))}
            {loose.map((x) => (
              <LooseRow key={x.id} item={x} onOpen={() => onOpenLoose(x)} onChange={onChange} />
            ))}
          </section>
        ) : null}
        {published.length ? (
          <section className="tkGroup">
            <div className="sdiv tkH">
              <span>Published</span>
              <span className="fmeta">{published.length}</span>
            </div>
            {published.map((f) => (
              <StudioRow key={f.id} file={f} onOpen={onOpen} onChange={onChange} />
            ))}
          </section>
        ) : null}
      </div>
      {!drafts && !published.length ? (
        <div className="s m" style={{ marginTop: 14 }}>Nothing made yet. Make something new - it lands here.</div>
      ) : null}
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

/* "Make something new" lands on the gallery - the mockup's "What can I
   make?" state. The gallery is the category list; picking one walks in. */
function GalleryView({ onBack, onPickCat }: { onBack: () => void; onPickCat: (cat: string) => void }) {
  return (
    <div>
      <BackBar onBack={onBack} />
      <div className="screenT">What can I make?</div>
      <div className="s m">Browse what Eumae can make. See it first - then build it in Chat.</div>
      <h3 className="sec">Can make</h3>
      <div className="stGrid">
      {STUDIO_CATEGORY_ORDER.map((cat) => (
        <button key={cat} className="stTile" onClick={() => onPickCat(cat)}>
          <Icon name={STUDIO_CATEGORY_ICONS[cat] || 'pls'} />
          <span className="stName">{cat}</span>
          <span className="stSub">{STUDIO_CATEGORIES[cat].join(' · ')}</span>
        </button>
      ))}
      </div>
    </div>
  );
}

function CategoryView({ cat, onBack, onPickTpl, onPickCat }: {
  cat: string; onBack: () => void; onPickTpl: (tpl: string) => void; onPickCat: (cat: string) => void;
}) {
  /* Gallery pseudo-category: show the picker, not a template list. Picking a
     category walks INTO it (cat), it is not a template - wiring it to
     onPickTpl bounced every tap back to the gallery. */
  if (cat === '__gallery__') return <GalleryView onBack={onBack} onPickCat={onPickCat} />;
  return (
    <div>
      <BackBar onBack={onBack} />
      <div className="screenT">{cat}</div>
      <div className="s m">Kinds of {cat.toLowerCase()} Eumae can make.</div>
      <div className="card cardPad tplList">
        {(STUDIO_CATEGORIES[cat] || []).map((tpl) => (
          <button key={tpl} className="sr" onClick={() => onPickTpl(tpl)}>
            <span className="g">{tpl}</span>
            <span className="ch">›</span>
          </button>
        ))}
      </div>
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

function TemplateView({ name, cat, variant, onVariant, purpose, onPurpose, details, onDetails, onBack, onBuild, onLearn }: {
  name: string; cat: string;
  variant: number; onVariant: (i: number) => void;
  purpose: string; onPurpose: (s: string) => void;
  details: string; onDetails: (s: string) => void;
  onBack: () => void; onBuild: () => void; onLearn: () => void;
}) {
  const t = templateOf(name);
  if (!t) return null;
  return (
    <div>
      <BackBar onBack={onBack} />
      <div className="screenT">{name}</div>
      <div className="s m">{t.u}</div>
      <div className="tplSplit">
      <div>
      {t.v.map((v, i) => (
        <button
          key={v[0] + v[1]}
          className="card"
          style={variant === i ? { border: '1.5px solid var(--ac)' } : undefined}
          onClick={() => onVariant(i)}
        >
          <div className="xs m" style={{ marginBottom: 6 }}>{v[0]} template</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{v[1]}</div>
          {v.slice(2).map((l) => (
            <div key={l} style={{ marginTop: 4 }}>{l}</div>
          ))}
          <div style={{ marginTop: 8 }}>{variant === i ? <span className="tag">Selected</span> : null}</div>
        </button>
      ))}
      </div>
      <div>
      <div className="card">
        <b>How a good one is built</b>
        <ul className="st">
          {t.s.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div className="card">
        <b>Define it first</b>
        <div className="s m">Answer what you can - the more Eumae knows up front, the closer the first try lands.</div>
        <input
          className="sinput"
          placeholder="What is it for?"
          value={purpose}
          onChange={(e) => onPurpose(e.target.value)}
          style={{ margin: '10px 0 8px', display: 'block' }}
          aria-label="What is it for?"
        />
        <textarea
          className="sinput"
          placeholder="Anything it must include - names, numbers, steps..."
          value={details}
          onChange={(e) => onDetails(e.target.value)}
          style={{ minHeight: 70, display: 'block', font: 'inherit', resize: 'vertical' }}
          aria-label="Anything it must include"
        />
      </div>
      </div>
      </div>
      <div className="btns">
        <button className="pri" onClick={onBuild}>Make it in Chat</button>
        <button className="gho" onClick={onLearn}>Learn what makes a good one</button>
      </div>
      <div className="xs m" style={{ marginTop: 6 }}>Category: {cat}</div>
    </div>
  );
}

/* Search every template by name, category, or what it is for. */
function TemplateSearch({ onPickTpl }: { onPickTpl: (tpl: string) => void }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const hits = term
    ? STUDIO_CATEGORY_ORDER.flatMap((cat) =>
        STUDIO_CATEGORIES[cat]
          .filter((t) =>
            (t + ' ' + cat + ' ' + (templateOf(t)?.u ?? '')).toLowerCase().includes(term),
          )
          .map((t) => ({ t, cat })),
      ).slice(0, 8)
    : [];
  return (
    <div style={{ marginTop: 12 }}>
      <input
        className="lib2-search"
        style={{ width: '100%', maxWidth: 420, padding: '10px 12px' }}
        placeholder="Search templates - résumé, budget, quiz..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search templates"
      />
      {term ? (
        <div className="card cardPad" style={{ marginTop: 8 }}>
          {hits.length ? (
            hits.map(({ t, cat }) => (
              <button key={cat + t} className="sr" onClick={() => onPickTpl(t)}>
                <span className="g">{t}</span>
                <span className="xs m">{cat}</span>
                <span className="ch">›</span>
              </button>
            ))
          ) : (
            <div className="s m">No template matches. Try a broader word.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
