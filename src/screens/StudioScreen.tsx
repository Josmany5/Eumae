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
  draftsOpen,
  setDraftsOpen,
  queueBrief,
} from '../studio';
import { getFiles, type LibFile } from '../library';
import { createProject, saveProject } from '../projects';
import { createFlow, saveFlow } from '../flows';
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
  const { notify, go, goTab } = useNav();
  const [walk, setWalk] = useState<Walk>({ cat: null, tpl: null });
  const [variant, setVariant] = useState(0);
  const [purpose, setPurpose] = useState('');
  const [details, setDetails] = useState('');
  const [showDrafts, setShowDrafts] = useState(() => draftsOpen());
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

  const toggleDrafts = () => {
    const next = !showDrafts;
    setShowDrafts(next);
    setDraftsOpen(next);
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
    } else if (cat === 'Flow' || cat === 'Routine') {
      const steps = de
        .split(/[\n.;]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const t = templateOf(tpl);
      const f = createFlow(pu || tpl);
      saveFlow({
        ...f,
        kind: cat === 'Routine' ? 'routine' : 'flow',
        steps: steps.length ? steps : t ? [...t.s] : [],
      });
      notify(`${cat} created — brief sent to Chat.`);
    } else {
      notify('Brief sent to Chat.');
    }
    queueBrief(brief);
    setWalk({ cat: null, tpl: null });
    setVariant(0);
    setPurpose('');
    setDetails('');
    goTab('chat');
  };

  if (!walk.cat) {
    return (
      <StudioRoot
        published={published}
        made={made}
        showDrafts={showDrafts}
        onToggleDrafts={toggleDrafts}
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

function StudioRoot({ published, made, showDrafts, onToggleDrafts, onPickCat, onPickTpl, onOpen }: {
  published: LibFile[]; made: LibFile[];
  showDrafts: boolean; onToggleDrafts: () => void;
  onPickCat: (cat: string) => void; onPickTpl: (tpl: string) => void; onOpen: (f: LibFile) => void;
}) {
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
      {made.length ? (
        <>
          <div className="row" style={{ marginTop: 14 }}>
            <b style={{ fontSize: 14 }}>Drafts</b>
            <span style={{ flex: 1 }} />
            <button className="fb" onClick={onToggleDrafts}>
              {showDrafts ? 'Hide' : 'Show ' + made.length}
            </button>
          </div>
          {showDrafts ? (
            <div className="card cardPad">
              {made.map((f) => (
                <StudioRow key={f.id} file={f} onOpen={onOpen} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {published.length ? (
        <>
          <h3 className="sec">Published - yours, in Library</h3>
          <div className="card cardPad">
            {published.map((f) => (
              <StudioRow key={f.id} file={f} onOpen={onOpen} />
            ))}
          </div>
        </>
      ) : null}
      {!made.length && !published.length ? (
        <div className="card s m">Nothing made yet. Make something new - it lands here.</div>
      ) : null}
    </div>
  );
}

function StudioRow({ file, onOpen }: { file: LibFile; onOpen: (f: LibFile) => void }) {
  const vers = (file.hist?.length ?? 0) + 1;
  return (
    <div className="li">
      <div className="fi">{file.k.slice(0, 4)}</div>
      <button className="g" style={{ textAlign: 'left' }} onClick={() => onOpen(file)}>
        <div>{file.t}</div>
        <div className="xs m">{file.k} · {file.st} · v{file.v}{vers > 1 ? ` · ${vers} versions` : ''}</div>
        <ProjectChip k="file" id={file.id} />
      </button>
      <span className={'tag ' + (file.st === 'draft' ? 'am' : 'gr')}>{file.st}</span>
      <FileMenu file={file} openTo={() => onOpen(file)} />
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
