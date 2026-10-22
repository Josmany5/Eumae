import { projectCountLabel, type Project } from '../projects';
import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../nav';
import {
  getFiles, allFolders, getFavs, getTrash, filedFolder, fileUpload,
  folderPrefs, setFolderPrefs, filesIn, addFolder, addFile, sortFiles,
  getFolders, renameFolder, deleteFolder, snapshotLibrary, restoreLibrary,
  LIB_VIEWS, TYPE_TABS, TYPE_FILTERS,
  liveOnly, folderOf,
  type LibFile, type LibView, type LibSortKey, type LibKind,
} from '../library';
import { TrashPane } from '../components/shell/FileDetail';
import { removeUploadUndoable, listUploads, uploadData, type Upload } from '../uploads';
import { FileMenu } from '../components/FileMenu';
import { ItemMenu, ProjectChip } from '../components/ItemMenu';
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

export type Sel =
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

export default function LibraryScreen({ initial }: { initial?: Sel }) {
  const { notify, go } = useNav();
  const [sel, setSel] = useState<Sel>(initial ?? { kind: 'view', view: 'Folders' });
  const [typeTab, setTypeTab] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
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
  const favs = useMemo(() => getFavs(), [tick]);
  const trash = useMemo(() => getTrash(), [tick]);
  const uploads = useMemo(() => listUploads(), [tick]);

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

  /* Opening a file is one page (ViewPage). It used to also raise the
     FileDetail overlay underneath, so Back landed on a second copy. */
  const openDetail = (_f: LibFile) => {};
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
      {/* View chips — the mockup's ftabs, plus Uploads. The rail's Library
          section already links Favorites/Recent/Shared/Trash; these switch
          the view in place. */}
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
            onFolderChange={(folder) => setSel(folder ? { kind: 'folder', folder } : { kind: 'view', view: 'Folders' })}
            newFolderOpen={newFolderOpen}
            newFolderName={newFolderName}
            onNewFolderName={setNewFolderName}
            onNewFolderOpen={() => { setNewFolderOpen(true); setNewFolderName(''); }}
            onNewFolderClose={() => setNewFolderOpen(false)}
          />
        </section>
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
  onFolderChange: (folder: string | null) => void;
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
      {getFolders().includes(folder) ? <FolderEdit folder={folder} refresh={props.refresh} onChange={props.onFolderChange} /> : null}
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
  const { go } = useNav();
  const [, setTick] = useState(0);
  const changed = () => setTick((t) => t + 1);
  const open = (f: LibFile) => {
    onDetail(f);
    go('view', f.id);
  };
  if (!files.length) return empty ? <div className="s m">{empty}</div> : null;
  if (prefs.view === 'icon') {
    return (
      <div className="lib2-grid">
        {files.map((f) => (
          <div key={f.id} className="lib2-tileWrap">
            <button className="lib2-tile" onClick={() => open(f)} aria-label={f.t}>
              <span className="lib2-tileIcon">
                <Icon name={KIND_ICON[f.k] || 'doc'} />
              </span>
              <span className="lib2-tileName">{f.t}</span>
              <span className="lib2-tileSub">{f.k} · v{f.v}</span>
            </button>
            <FileMenu file={f} onChange={changed} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="card cardPad">
      {files.map((f) => (
        <div key={f.id} className="li">
          <div className="fi">{f.k.slice(0, 4)}</div>
          <button className="g" style={{ textAlign: 'left' }} onClick={() => open(f)}>
            <div>{f.t}</div>
            <div className="xs m">v{f.v} · {f.st} · {folderOf(f)} · {fmtDate(f.createdAt)}</div>
            <ProjectChip k="file" id={f.id} />
          </button>
          {favs.includes(f.id) ? <span className="tag">★</span> : null}
          <span className={'tag ' + (f.st === 'draft' ? 'am' : 'gr')}>{f.st}</span>
          <FileMenu file={f} onChange={changed} />
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
          <span className="v">{projectCountLabel(p as Project)}</span>
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
   get filed. Delete asks nothing: the row goes, Undo brings it back, and
   the bytes in IndexedDB are only dropped once the Undo window has passed. */
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
  const { notify } = useNav();
  const [filing, setFiling] = useState(false);
  const remove = () => {
    const undo = removeUploadUndoable(upload.id);
    if (!undo) return;
    refresh();
    notify('Upload deleted.', {
      undo: () => {
        undo();
        refresh();
      },
    });
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
      {!filing ? (
        <button className="fb" onClick={() => setFiling((v) => !v)} aria-label={'File ' + upload.name}>
          {folder === 'Uploads' ? filedFolder(upload.id) : 'File'}
        </button>
      ) : (
        <select
          className="selIn"
          value={filedFolder(upload.id)}
          onChange={(e) => { fileUpload(upload.id, e.target.value); setFiling(false); refresh(); }}
          aria-label={'File ' + upload.name + ' into'}
        >
          {allFolders().map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      )}
      <ItemMenu
        name={upload.name}
        open={() => onUpload(upload)}
        extra={[{ label: 'Move to folder', onClick: () => setFiling(true) }]}
        onDelete={remove}
      />
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
/* Trash + file detail live in components/shell/FileDetail (shared with
   Studio's sitem page). */

/* Rename / delete for folders you made (built-ins never get these). Delete
   sends files back to their kind folder and offers Undo. */
function FolderEdit({ folder, refresh, onChange }: { folder: string; refresh: () => void; onChange: (folder: string | null) => void }) {
  const { notify } = useNav();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder);
  const submit = () => {
    const msg = renameFolder(folder, name);
    notify(msg);
    if (/renamed/.test(msg)) {
      setRenaming(false);
      onChange(name.trim());
      refresh();
    }
  };
  const remove = () => {
    const snap = snapshotLibrary();
    if (!deleteFolder(folder)) return;
    onChange(null);
    refresh();
    notify('Folder deleted. Its files moved back.', {
      undo: () => {
        restoreLibrary(snap);
        refresh();
      },
    });
  };
  if (renaming) {
    return (
      <div className="btns">
        <span className="g" style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input
            className="lib2-search"
            placeholder="Folder name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setRenaming(false);
            }}
            aria-label="Rename folder"
          />
          <button className="gho" onClick={submit}>Save</button>
        </span>
      </div>
    );
  }
  return (
    <div className="btns">
      <button className="gho" onClick={() => { setName(folder); setRenaming(true); }}>Rename folder</button>
      <button className="gho danger" onClick={remove}>Delete folder</button>
    </div>
  );
}
