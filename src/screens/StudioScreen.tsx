import { FileMenu } from '../components/FileMenu';
import { ProjectChip } from '../components/ItemMenu';
import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../nav';
import { GROUPS, KINDS, searchStudio, guessKind } from '../studioGuide';
import { newSession, saveSession, sessionForFile } from '../studioChat';
import { getFiles, snapshotLibrary, restoreLibrary, type LibFile } from '../library';
import { allSbx, removeSbx, restoreSbx, snapshotSbx, keepAsDraft, openSbx, type SbxItem } from '../sandbox';
import { useSbx } from '../components/SandboxView';
import { ItemMenu } from '../components/ItemMenu';
import { rowTap } from '../rowTap';
import { undoable } from '../undo';
import { useMedia } from '../useMedia';
import { Icon } from '../components/shell/icons';

/* Studio = discovery (his call, Oct 27, 9:42 PM). Chat is where you just make
 * things; Studio shows what's possible and helps you get specific first.
 *
 * Home: make box, small Drafts / Published pills, group tabs, then every kind
 * as a flat row under fold-up group headings (his rule: never hide the kinds).
 * Tapping a kind opens its Studio chat (components/StudioChat.tsx): questions,
 * spec and preview on one screen; nothing jumps to main Chat.
 * Data lives in studioGuide.ts. */

export default function StudioScreen() {
  const { notify, go, goTab, switchThread, openPanel } = useNav();
  useSbx();
  const wide = useMedia('(min-width:900px)');
  const [tabG, setTabG] = useState<string>('All');
  const [folded, setFolded] = useState<string[]>([]);
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

  const open = (k: string, tpl?: string | null, seed?: string) => {
    const kd = KINDS[k];
    if (!kd) return;
    if (kd.soon) {
      notify(`${kd.n} is coming soon. It needs the backend first.`);
      return;
    }
    const sess = newSession(kd, tpl, seed);
    saveSession(sess);
    go('schat', sess.id);
  };
  const openFile = (f: LibFile) => {
    const sess = sessionForFile(f.id);
    if (sess) go('schat', sess.id);
    else go('sitem', f.id);
  };

  const shown = tabG === 'All' ? GROUPS : GROUPS.filter((g) => g.n === tabG);
  return (
    <div>
      <div className="screenT dupT">Your studio</div>
      <div className="s m">See what you can make, get specific, and Eumae helps along the way.</div>
      <MakeBox
        onKind={(k) => open(k)}
        onTpl={(k, t) => open(k, t)}
        onFree={(text) => open(guessKind(text), null, text)}
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
                  <StudioRow key={f.id} file={f} onOpen={openFile} onChange={refresh} />
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
              <StudioRow key={f.id} file={f} onOpen={openFile} onChange={refresh} />
            ))
          ) : (
            <div className="s m">Nothing published yet.</div>
          )}
        </div>
      ) : null}
      <div className="scGTabs">
        {['All', ...GROUPS.map((g) => g.n)].map((n) => (
          <button key={n} className={tabG === n ? 'on' : ''} onClick={() => { setTabG(n); setFolded((f) => (n === 'All' ? [] : f.filter((x) => x !== n))); }}>
            {n} <span>{n === 'All' ? 21 : GROUPS.find((g) => g.n === n)?.kinds.length}</span>
          </button>
        ))}
      </div>
      {shown.map((g) => {
        const isFolded = folded.includes(g.n);
        return (
          <section key={g.n}>
            <button
              className="scGH"
              onClick={() => setFolded((f) => (f.includes(g.n) ? f.filter((x) => x !== g.n) : [...f, g.n]))}
              aria-expanded={!isFolded}
            >
              <span className="scCv">{isFolded ? '›' : '⌄'}</span>
              {g.n}
              <span className="m">{g.kinds.length}{isFolded ? ' · ' + g.kinds.join(', ') : ''}</span>
            </button>
            {isFolded ? null : (
              <div className="scKinds">
                {g.kinds.map((k) => {
                  const kd = KINDS[k];
                  return (
                    <button key={k} className="scKind" onClick={() => open(k)}>
                      <span className="scKIc"><Icon name={kd.icon} /></span>
                      <span className="scKT">
                        <b>{kd.n}{kd.soon ? <span className="tag am">Soon</span> : null}</b>
                        <span className="m">{kd.d}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
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
