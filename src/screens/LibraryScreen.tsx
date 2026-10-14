import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../nav';
import {
  getFiles, getFolders, allFolders, getFavs, getTrash, filedFolder, fileUpload,
  folderPrefs, setFolderPrefs, filesIn, addFolder, addFile, toggleFav, toggleStatus,
  bumpVersion, trashFile, restoreTrash, emptyTrash, sortFiles,
  LIB_VIEWS, TYPE_TABS, TYPE_FILTERS,
  liveOnly, folderOf,
  type LibFile, type LibView, type LibSortKey, type LibKind,
} from '../library';
import { deleteUpload, listUploads, uploadData, type Upload } from '../uploads';
import { getProjects } from '../projects';
import { getGuild } from '../guild';
import { Icon } from '../components/shell/icons';

/* The Library as a Finder - the mockup's rLib five views plus Uploads,
 * in a sidebar + folder frame that goes two-pane on desktop.
 *
 * Phone: view chips (the mockup's ftabs) + folder contents, one pane.
 * Desktop (900px+): sidebar (Favorites / folders / Shared / Uploads / Trash)
 * + folder pane with toolbar (search, icon/list toggle, sort). Two shelves:
 * authored files (library.ts) + uploads (uploads.ts, filed per folder).
 * Per-folder view + sort remembered in the store. Mockup rules kept: L9
 * live-only in folders, TYPE10 type tabs, Projects/Classroom special pages,
 * fav star, trash restore-as-draft.
 */

type Sel =
  | { kind: 'view'; view: LibView }
  | { kind: 'folder'; folder: string }
  | { kind: 'trash' };

const KIND_ICON: Record<string, string> = {
  DOC: 'doc', PDF: 'doc', IMG: 'img', WEB: 'lnk', WIDGET: 'zap',
  GAME: 'zap', LINK: 'lnk', ROUTINE: 'clk', COURSE: 'cap', DIGEST: 'doc',
};

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export default function LibraryScreen() {
  const { notify, go } = useNav();
  const [sel, setSel] = useState<Sel>({ kind: 'view', view: 'Folders' });
  const [typeTab, setTypeTab] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [detail, setDetail] = useState<LibFile | null>(null);
  const [preview, setPreview] = useState<{ upload: Upload; url: string } | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const refresh = () => setTick((t) => t + 1);
  void tick;

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const files = useMemo(() => getFiles(), [tick]);
  const folders = useMemo(() => getFolders(), [tick]);
  const favs = useMemo(() => getFavs(), [tick]);
  const trash = useMemo(() => getTrash(), [tick]);
  const uploads = useMemo(() => listUploads(), [tick]);
  void folders;

  /* Current folder name drives prefs + counts. Views map: Folders shows
     nothing until a folder is picked on desktop (phone shows folder list);
     folder sel, Recent/Shared/Favorites/Uploads/By-type each read as one. */
  const folderName =
    sel.kind === 'folder' ? sel.folder
    : sel.kind === 'view' && sel.view === 'Uploads' ? 'Uploads'
    : sel.kind === 'view' && sel.view === 'Shared' ? 'Shared'
    : sel.kind === 'view' && sel.view === 'Favorites' ? 'Favorites'
    : sel.kind === 'view' && sel.view === 'Recent' ? 'Recent'
    : sel.kind === 'trash' ? 'Trash'
    : 'Library';
  const prefs = folderPrefs(folderName);

  /* Uploads filed per folder - unlisted ones live in Uploads. */
  const uploadsIn = (folder: string) => uploads.filter((u) => filedFolder(u.id) === folder);

  /* Sidebar counts: authored live + filed uploads. Projects = project count,
     Shared = guild shared count - the mockup's cnt. */
  const guild = useMemo(() => getGuild(), [tick]);
  const projects = useMemo(() => getProjects(), [tick]);
  const folderCount = (f: string) => {
    if (f === 'Projects') return projects.length;
    if (f === 'Shared') return guild.shared.length;
    return filesIn(f).length + uploadsIn(f).length;
  };

  const q = query.trim().toLowerCase();
  const matches = (t: string) => !q || t.toLowerCase().includes(q);

  const openDetail = (f: LibFile) => setDetail(f);
  const openUpload = async (u: Upload) => {
    const url = await uploadData(u.id);
    if (!url) {
      notify('Could not open that file.');
      return;
    }
    setPreview({ upload: u, url });
  };

  return (
    <div className="lib2">
      {/* Phone chips - the mockup's ftabs, plus Uploads. Desktop hides
          these; the sidebar takes over. */}
      <div className="ftabs lib2-chips">
        {LIB_VIEWS.map((v) => (
          <button
            key={v}
            className={sel.kind === 'view' && sel.view === v ? 'on' : ''}
            onClick={() => { setSel({ kind: 'view', view: v }); setQuery(''); }}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="lib2-body">
        <nav className="lib2-side" aria-label="Library sidebar">
          <div className="lib2-sec">Favorites</div>
          <SideRow
            label="Favorites"
            count={favs.length}
            active={sel.kind === 'view' && sel.view === 'Favorites'}
            onClick={() => setSel({ kind: 'view', view: 'Favorites' })}
          />
          <div className="lib2-sec">Folders</div>
          {allFolders().map((f) => (
            <SideRow
              key={f}
              label={f}
              count={folderCount(f)}
              active={sel.kind === 'folder' && sel.folder === f}
              onClick={() => { setSel({ kind: 'folder', folder: f }); setQuery(''); }}
            />
          ))}
          {getFolders().length === 0 ? null : null}
          <div className="lib2-sec">More</div>
          <SideRow
            label="Uploads"
            count={uploads.length}
            active={sel.kind === 'view' && sel.view === 'Uploads'}
            onClick={() => setSel({ kind: 'view', view: 'Uploads' })}
          />
          <SideRow
            label="Shared"
            count={guild.shared.length}
            active={sel.kind === 'view' && sel.view === 'Shared'}
            onClick={() => setSel({ kind: 'view', view: 'Shared' })}
          />
          <SideRow
            label="Trash"
            count={trash.length}
            active={sel.kind === 'trash'}
            onClick={() => setSel({ kind: 'trash' })}
          />
          <div className="btns">
            <button className="gho" onClick={() => { setNewFolderOpen(true); setNewFolderName(''); }}>
              New folder
            </button>
          </div>
        </nav>
        <section className="lib2-main">
          <LibToolbar
            title={folderName}
            query={query}
            onQuery={setQuery}
            view={prefs.view}
            onView={(view) => { setFolderPrefs(folderName, { view }); refresh(); }}
            sort={prefs.sort}
            dir={prefs.dir}
            onSort={(sort) => { setFolderPrefs(folderName, { sort }); refresh(); }}
            onDir={() => { setFolderPrefs(folderName, { dir: prefs.dir === 'asc' ? 'desc' : 'asc' }); refresh(); }}
            onBack={sel.kind === 'folder' ? () => setSel({ kind: 'view', view: 'Folders' }) : undefined}
          />
          <LibContents
            sel={sel}
            typeTab={typeTab}
            onTypeTab={setTypeTab}
            prefs={prefs}
            query={q}
            matches={matches}
            files={files}
            favs={favs}
            trash={trash}
            uploads={uploads}
            uploadsIn={uploadsIn}
            folderCount={folderCount}
            guild={guild}
            projects={projects}
            notify={notify}
            go={go}
            refresh={refresh}
            onDetail={openDetail}
            onUpload={openUpload}
            onSelectFolder={(folder) => { setSel({ kind: 'folder', folder }); setQuery(''); }}
            newFolderOpen={newFolderOpen}
            newFolderName={newFolderName}
            onNewFolderName={setNewFolderName}
            onNewFolderOpen={() => { setNewFolderOpen(true); setNewFolderName(''); }}
            onNewFolderClose={() => setNewFolderOpen(false)}
          />
        </section>
      </div>
      {detail ? (
        <FileDetail
          file={detail}
          fav={favs.includes(detail.id)}
          notify={notify}
          refresh={refresh}
          onClose={() => { setDetail(null); refresh(); }}
        />
      ) : null}
      {preview ? (
        <div className="lib-preview" role="dialog" aria-label={preview.upload.name}>
          <div className="lib-preview-head">
            <span>{preview.upload.name}</span>
            <button onClick={() => setPreview(null)} aria-label="Close preview">
              ×
            </button>
          </div>
          <div className="lib-preview-body">
            {preview.upload.kind === 'image' && <img src={preview.url} alt={preview.upload.name} />}
            {preview.upload.kind === 'video' && <video src={preview.url} controls playsInline />}
            {preview.upload.kind === 'audio' && <audio src={preview.url} controls />}
            {(preview.upload.kind === 'pdf' || preview.upload.kind === 'text' || preview.upload.kind === 'doc' || preview.upload.kind === 'other') && (
              <iframe src={preview.url} title={preview.upload.name} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SideRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button className={'lib2-row' + (active ? ' on' : '')} onClick={onClick}>
      <Icon name={label === 'Trash' ? 'arch' : label === 'Favorites' ? 'str' : label === 'Uploads' ? 'up' : label === 'Shared' ? 'lnk' : 'fol'} />
      <span className="g">{label}</span>
      {count ? <span className="v">{count}</span> : null}
    </button>
  );
}

function LibToolbar({ title, query, onQuery, view, onView, sort, dir, onSort, onDir, onBack }: {
  title: string; query: string; onQuery: (q: string) => void;
  view: 'icon' | 'list'; onView: (v: 'icon' | 'list') => void;
  sort: LibSortKey; dir: 'asc' | 'desc';
  onSort: (s: LibSortKey) => void; onDir: () => void; onBack?: () => void;
}) {
  return (
    <div className="lib2-bar">
      {onBack ? (
        <button className="hb" onClick={onBack} aria-label="Back to folders">
          <Icon name="bk" />
        </button>
      ) : null}
      <div className="lib2-title">{title}</div>
      <input
        className="lib2-search"
        placeholder="Search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        aria-label={'Search ' + title}
      />
      <div className="lib2-tools" role="group" aria-label="View and sort">
        <button className={view === 'icon' ? 'on' : ''} onClick={() => onView('icon')} aria-label="Icon view" aria-pressed={view === 'icon'}>
          <Icon name="img" />
        </button>
        <button className={view === 'list' ? 'on' : ''} onClick={() => onView('list')} aria-label="List view" aria-pressed={view === 'list'}>
          <Icon name="menu" />
        </button>
        <select value={sort} onChange={(e) => onSort(e.target.value as LibSortKey)} aria-label="Sort by">
          <option value="name">Name</option>
          <option value="date">Date</option>
          <option value="kind">Kind</option>
        </select>
        <button onClick={onDir} aria-label={dir === 'asc' ? 'Sort descending' : 'Sort ascending'}>
          {dir === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  );
}

/* Contents switch: folders list, folder pane, type tabs, recent, shared,
   favorites, uploads, trash. Special folders (Projects/Classroom) keep the
   mockup's shaped pages. */
function LibContents(props: {
  sel: { kind: 'view'; view: LibView } | { kind: 'folder'; folder: string } | { kind: 'trash' };
  typeTab: string; onTypeTab: (t: string) => void;
  prefs: { view: 'icon' | 'list'; sort: LibSortKey; dir: 'asc' | 'desc' };
  query: string; matches: (t: string) => boolean;
  files: LibFile[]; favs: string[]; trash: { t: string; k: string }[];
  uploads: Upload[]; uploadsIn: (folder: string) => Upload[];
  folderCount: (f: string) => number;
  guild: { shared: { n: string; k: string; p: number }[]; people: { n: string }[] };
  projects: { id: string; n: string; dn: number; ts: number }[];
  notify: (m: string) => void; go: (page: string, arg?: unknown) => void;
  refresh: () => void;
  onDetail: (f: LibFile) => void; onUpload: (u: Upload) => void;
  onSelectFolder: (folder: string) => void;
  newFolderOpen: boolean; newFolderName: string;
  onNewFolderName: (n: string) => void; onNewFolderOpen: () => void; onNewFolderClose: () => void;
}) {
  const { sel, prefs, matches } = props;

  if (sel.kind === 'view' && sel.view === 'Folders') {
    return (
      <FolderList
        matches={matches}
        folderCount={props.folderCount}
        onSelectFolder={props.onSelectFolder}
        newFolderOpen={props.newFolderOpen}
        newFolderName={props.newFolderName}
        onNewFolderName={props.onNewFolderName}
        onNewFolderOpen={props.onNewFolderOpen}
        onNewFolderClose={props.onNewFolderClose}
        notify={props.notify}
        refresh={props.refresh}
      />
    );
  }
  if (sel.kind === 'trash') {
    return <TrashPane trash={props.trash} notify={props.notify} refresh={props.refresh} />;
  }
  if (sel.kind === 'view' && sel.view === 'By type') {
    const tab = TYPE_FILTERS[props.typeTab] ?? null;
    const list = sortFiles(
      liveOnly(props.files).filter((f) => (!tab || tab.includes(f.k)) && matches(f.t)),
      prefs.sort, prefs.dir,
    );
    return (
      <>
        <div className="ftabs">
          {TYPE_TABS.map((t) => (
            <button key={t} className={props.typeTab === t ? 'on' : ''} onClick={() => props.onTypeTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="s m" style={{ margin: '2px 0 8px' }}>Published and saved — drafts live in Studio.</div>
        <FileGrid files={list} prefs={prefs} favs={props.favs} onDetail={props.onDetail} empty="Nothing here yet." />
      </>
    );
  }
  if (sel.kind === 'view' && sel.view === 'Recent') {
    const list = [...liveOnly(props.files)].filter((f) => matches(f.t)).sort((a, b) => b.createdAt - a.createdAt);
    return (
      <>
        <h3 className="sec">Today</h3>
        <FileGrid files={list} prefs={prefs} favs={props.favs} onDetail={props.onDetail} empty="Nothing here yet." />
      </>
    );
  }
  if (sel.kind === 'view' && sel.view === 'Shared') {
    return <SharedPane guild={props.guild} matches={matches} />;
  }
  if (sel.kind === 'view' && sel.view === 'Favorites') {
    const list = sortFiles(liveOnly(props.files).filter((f) => props.favs.includes(f.id) && matches(f.t)), prefs.sort, prefs.dir);
    return <FileGrid files={list} prefs={prefs} favs={props.favs} onDetail={props.onDetail} empty="Star something to keep it here." />;
  }
  if (sel.kind === 'view' && sel.view === 'Uploads') {
    return <UploadsPane uploads={props.uploads} matches={matches} refresh={props.refresh} onUpload={props.onUpload} folder="Uploads" />;
  }
  /* Folder pane. */
  const folder = sel.kind === 'folder' ? sel.folder : 'Uploads';
  if (folder === 'Projects') return <ProjectsPane projects={props.projects} matches={matches} go={props.go} />;
  if (folder === 'Classroom') return <ClassroomPane files={props.files} matches={matches} prefs={prefs} favs={props.favs} onDetail={props.onDetail} />;
  if (folder === 'Shared') return <SharedPane guild={props.guild} matches={matches} />;
  const authored = sortFiles(props.files.filter((f) => folderOf(f) === folder).filter((f) => f.st === 'live' && matches(f.t)), prefs.sort, prefs.dir);
  const ups = props.uploadsIn(folder).filter((u) => matches(u.name));
  return (
    <>
      <FileGrid files={authored} prefs={prefs} favs={props.favs} onDetail={props.onDetail} empty="" />
      {ups.length ? <UploadRows uploads={ups} onUpload={props.onUpload} refresh={props.refresh} folder={folder} /> : null}
      {!authored.length && !ups.length ? <div className="s m">Nothing here yet.</div> : null}
      <FolderActions folder={folder} notify={props.notify} refresh={props.refresh} />
    </>
  );
}

function FolderList({ matches, folderCount, onSelectFolder, newFolderOpen, newFolderName, onNewFolderName, onNewFolderOpen, onNewFolderClose, notify, refresh }: {
  matches: (t: string) => boolean;
  folderCount: (f: string) => number;
  onSelectFolder: (folder: string) => void;
  newFolderOpen: boolean; newFolderName: string;
  onNewFolderName: (n: string) => void; onNewFolderOpen: () => void; onNewFolderClose: () => void;
  notify: (m: string) => void; refresh: () => void;
}) {
  const submit = () => {
    const msg = addFolder(newFolderName);
    notify(msg);
    if (/created/.test(msg)) { onNewFolderClose(); refresh(); }
  };
  return (
    <>
      <div className="s m" style={{ margin: '2px 0 8px' }}>Published and saved — drafts live in Studio.</div>
      <div className="card cardPad">
        {allFolders().filter(matches).map((f) => (
          <button key={f} className="sr" onClick={() => onSelectFolder(f)}>
            <Icon name="fol" />
            <span className="g">{f}</span>
            {folderCount(f) ? <span className="v">{folderCount(f)}</span> : null}
            <span className="ch">›</span>
          </button>
        ))}
      </div>
      <div className="btns">
        {newFolderOpen ? (
          <span className="g" style={{ display: 'flex', gap: 8, flex: 1 }}>
            <input
              className="lib2-search"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => onNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') onNewFolderClose();
              }}
              aria-label="New folder name"
            />
            <button className="gho" onClick={submit}>
              Create
            </button>
          </span>
        ) : (
          <button className="gho" onClick={onNewFolderOpen}>
            New folder
          </button>
        )}
      </div>
    </>
  );
}

/* File grid: icon tiles or sortable list rows. Star toggles fav inline -
   the mockup's fOpen fav button, without the sheet round-trip. */
function FileGrid({ files, prefs, favs, onDetail, empty }: {
  files: LibFile[]; prefs: { view: 'icon' | 'list'; sort: LibSortKey; dir: 'asc' | 'desc' };
  favs: string[]; onDetail: (f: LibFile) => void; empty: string;
}) {
  if (!files.length) return empty ? <div className="s m">{empty}</div> : null;
  if (prefs.view === 'icon') {
    return (
      <div className="lib2-grid">
        {files.map((f) => (
          <button key={f.id} className="lib2-tile" onClick={() => onDetail(f)} aria-label={f.t}>
            <span className="lib2-tileIcon">
              <Icon name={KIND_ICON[f.k] || 'doc'} />
            </span>
            <span className="lib2-tileName">{f.t}</span>
            <span className="lib2-tileSub">{f.k} · v{f.v}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="card cardPad">
      {files.map((f) => (
        <div key={f.id} className="li">
          <div className="fi">{f.k.slice(0, 4)}</div>
          <button className="g" style={{ textAlign: 'left' }} onClick={() => onDetail(f)}>
            <div>{f.t}</div>
            <div className="xs m">v{f.v} · {f.st} · {folderOf(f)} · {fmtDate(f.createdAt)}</div>
          </button>
          {favs.includes(f.id) ? <span className="tag">★</span> : null}
          <span className={'tag ' + (f.st === 'draft' ? 'am' : 'gr')}>{f.st}</span>
        </div>
      ))}
    </div>
  );
}

function SharedPane({ guild, matches }: {
  guild: { shared: { n: string; k: string; p: number }[]; people: { n: string }[] };
  matches: (t: string) => boolean;
}) {
  const rows = guild.shared.filter((x) => matches(x.n));
  if (!rows.length) return <div className="s m">Nothing shared yet.</div>;
  return (
    <div className="card cardPad">
      {rows.map((x) => {
        const p = guild.people[x.p];
        return (
          <div key={x.n} className="li">
            <div className="fi">{x.k.slice(0, 4).toUpperCase()}</div>
            <div className="g">
              <b>{x.n}</b>
              <div className="xs m">Shared with {p ? p.n : 'Guild'}</div>
            </div>
            <span className="tag">{x.k}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProjectsPane({ projects, matches, go }: {
  projects: { id: string; n: string; dn: number; ts: number }[];
  matches: (t: string) => boolean; go: (page: string, arg?: unknown) => void;
}) {
  return (
    <div className="card cardPad">
      {projects.filter((p) => matches(p.n)).map((p) => (
        <button key={p.id} className="sr" onClick={() => go('project', p.id)}>
          <Icon name="fol" />
          <span className="g">{p.n}</span>
          <span className="v">{p.dn} of {p.ts}</span>
          <span className="ch">›</span>
        </button>
      ))}
    </div>
  );
}

function ClassroomPane({ files, matches, prefs, favs, onDetail }: {
  files: LibFile[]; matches: (t: string) => boolean;
  prefs: { view: 'icon' | 'list'; sort: LibSortKey; dir: 'asc' | 'desc' };
  favs: string[]; onDetail: (f: LibFile) => void;
}) {
  const live = liveOnly(files).filter((f) => matches(f.t));
  const courses = sortFiles(live.filter((f) => f.k === 'COURSE'), prefs.sort, prefs.dir);
  const digests = sortFiles(live.filter((f) => f.k === 'DIGEST'), prefs.sort, prefs.dir);
  const docs = sortFiles(live.filter((f) => f.k === 'DOC' && folderOf(f) === 'Classroom'), prefs.sort, prefs.dir);
  return (
    <>
      <h3 className="sec">Courses and training</h3>
      <FileGrid files={courses} prefs={prefs} favs={favs} onDetail={onDetail} empty="No courses yet." />
      <h3 className="sec">Digests</h3>
      <FileGrid files={digests} prefs={prefs} favs={favs} onDetail={onDetail} empty="No digests yet." />
      <h3 className="sec">Documents</h3>
      <FileGrid files={docs} prefs={prefs} favs={favs} onDetail={onDetail} empty="No documents yet." />
    </>
  );
}

/* Upload rows inside a folder + the Uploads view. Filing moves the upload's
   home - the mockup's libUpload names a file; here real paperclip files
   get filed. Delete stays destructive (bytes in IndexedDB) with a confirm. */
function UploadRows({ uploads, onUpload, refresh, folder }: {
  uploads: Upload[]; onUpload: (u: Upload) => void;
  refresh: () => void; folder: string;
}) {
  return (
    <div className="card cardPad" style={{ marginTop: 8 }}>
      {uploads.map((u) => (
        <UploadRow key={u.id} upload={u} onUpload={onUpload} refresh={refresh} folder={folder} />
      ))}
    </div>
  );
}

function UploadRow({ upload, onUpload, refresh, folder }: {
  upload: Upload; onUpload: (u: Upload) => void;
  refresh: () => void; folder: string;
}) {
  const [filing, setFiling] = useState(false);
  const remove = async () => {
    if (!window.confirm('Delete ' + upload.name + '? This cannot be undone.')) return;
    await deleteUpload(upload.id);
    refresh();
  };
  return (
    <div className="li">
      {upload.kind === 'image' ? (
        <UploadThumb id={upload.id} name={upload.name} />
      ) : (
        <span className="lib-icon" aria-hidden />
      )}
      <button className="g" style={{ textAlign: 'left' }} onClick={() => onUpload(upload)}>
        <div className="lib-name">{upload.name}</div>
        <div className="xs m">{fmtSize(upload.size)} · {fmtDate(upload.createdAt)}</div>
      </button>
      {folder === 'Uploads' || !filing ? (
        <button className="fb" onClick={() => setFiling((v) => !v)} aria-label={'File ' + upload.name}>
          {folder === 'Uploads' ? filedFolder(upload.id) : 'File'}
        </button>
      ) : (
        <select
          value={filedFolder(upload.id)}
          onChange={(e) => { fileUpload(upload.id, e.target.value); setFiling(false); refresh(); }}
          aria-label={'File ' + upload.name + ' into'}
        >
          {allFolders().map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      )}
      <button className="lib-del" aria-label={'Delete ' + upload.name} onClick={remove}>
        ×
      </button>
    </div>
  );
}

function UploadsPane({ uploads, matches, refresh, onUpload, folder }: {
  uploads: Upload[]; matches: (t: string) => boolean;
  refresh: () => void;
  onUpload: (u: Upload) => void; folder: string;
}) {
  const list = uploads.filter((u) => matches(u.name));
  if (!list.length) return <div className="s m">Upload with the paperclip and it lands here.</div>;
  return (
    <div className="card cardPad">
      {list.map((u) => (
        <UploadRow key={u.id} upload={u} onUpload={onUpload} refresh={refresh} folder={folder} />
      ))}
    </div>
  );
}

function UploadThumb({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    uploadData(id).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [id]);
  return url ? <img className="lib-thumb" src={url} alt={name} /> : <span className="lib-icon" aria-hidden />;
}

function FolderActions({ folder, notify, refresh }: { folder: string; notify: (m: string) => void; refresh: () => void }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const submit = () => {
    const kinds: LibKind[] = folder === 'Links' ? ['LINK'] : folder === 'Routines' ? ['ROUTINE'] : ['DOC'];
    addFile(name, kinds[0], folder);
    notify('Filed in ' + folder + '.');
    setNaming(false);
    setName('');
    refresh();
  };
  if (!naming) {
    return (
      <div className="btns">
        <button className="gho" onClick={() => setNaming(true)}>New here</button>
      </div>
    );
  }
  return (
    <div className="btns">
      <span className="g" style={{ display: 'flex', gap: 8, flex: 1 }}>
        <input
          className="lib2-search"
          placeholder="Name it"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setNaming(false);
          }}
          aria-label="New file name"
        />
        <button className="gho" onClick={submit}>Create</button>
      </span>
    </div>
  );
}

/* Trash: restore-as-draft or empty. The mockup's libTrash sheet, inline. */
function TrashPane({ trash, notify, refresh }: {
  trash: { t: string; k: string }[]; notify: (m: string) => void; refresh: () => void;
}) {
  if (!trash.length) return <div className="s m">Trash is empty.</div>;
  return (
    <>
      <div className="card cardPad">
        {trash.map((x, i) => (
          <div key={x.t + i} className="li">
            <div className="fi">{x.k.slice(0, 4)}</div>
            <div className="g">{x.t}</div>
            <button
              className="fb"
              onClick={() => { restoreTrash(i); notify('Restored.'); refresh(); }}
            >
              Restore
            </button>
          </div>
        ))}
      </div>
      <div className="btns">
        <button
          className="gho"
          onClick={() => {
            if (!window.confirm('Empty trash? This cannot be undone.')) return;
            emptyTrash();
            notify('Trash emptied.');
            refresh();
          }}
        >
          Empty trash
        </button>
      </div>
    </>
  );
}

/* File detail: the mockup's fOpen sheet - title/body/type/status/version
   with Publish flip, Edit bump, fav star, trash. */
function FileDetail({ file, fav, notify, refresh, onClose }: {
  file: LibFile; fav: boolean;
  notify: (m: string) => void; refresh: () => void; onClose: () => void;
}) {
  const [f, setF] = useState<LibFile>(file);
  const act = (msg: string, fn: () => LibFile | boolean | null) => {
    const out = fn();
    if (out === false || out === null) { notify('Nothing there.'); return; }
    if (typeof out === 'object') setF({ ...out });
    notify(msg);
    refresh();
  };
  return (
    <div className="lib-preview" role="dialog" aria-label={f.t}>
      <div className="lib-preview-head">
        <button onClick={onClose} aria-label="Back to Library">
          <Icon name="bk" />
        </button>
        <span>{f.t}</span>
        <button onClick={() => act(fav ? 'Unstarred.' : 'Starred.', () => toggleFav(f.id))} aria-label="Toggle favorite">
          {fav ? '★' : '☆'}
        </button>
      </div>
      <div className="pageBody" style={{ padding: '0 14px 14px' }}>
        <div className="card">{f.b || 'No preview.'}</div>
        <div className="kv"><span className="m">Type</span><span>{f.k}</span></div>
        <div className="kv"><span className="m">Status</span><span>{f.st}</span></div>
        <div className="kv"><span className="m">Version</span><span>v{f.v}</span></div>
        <div className="kv"><span className="m">Folder</span><span>{folderOf(f)}</span></div>
        <div className="btns">
          <button className="pri" onClick={() => act(f.st === 'draft' ? 'Published.' : 'Unpublished.', () => toggleStatus(f.id))}>
            {f.st === 'draft' ? 'Publish' : 'Unpublish'}
          </button>
          <button className="gho" onClick={() => act('Edited.', () => bumpVersion(f.id))}>
            Edit
          </button>
          <button
            className="gho"
            onClick={() => {
              trashFile(f.id);
              notify('Trashed.');
              onClose();
            }}
          >
            Trash
          </button>
        </div>
      </div>
    </div>
  );
}
