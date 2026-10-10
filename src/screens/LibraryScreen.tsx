import { useEffect, useState } from 'react';
import Empty from './Empty';
import { deleteUpload, listUploads, uploadData, type Upload, type UploadKind } from '../uploads';
import { useNav } from '../nav';

const FILTERS: { id: UploadKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'text', label: 'Text' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'doc', label: 'Docs' },
];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LibraryScreen() {
  const { notify } = useNav();
  const [filter, setFilter] = useState<UploadKind | 'all'>('all');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [preview, setPreview] = useState<{ upload: Upload; url: string } | null>(null);

  useEffect(() => {
    setUploads(listUploads());
  }, []);

  const shown = filter === 'all' ? uploads : uploads.filter((u) => u.kind === filter);

  const open = async (upload: Upload) => {
    const url = await uploadData(upload.id);
    if (!url) {
      notify('Could not open that file.');
      return;
    }
    setPreview({ upload, url });
  };

  const remove = async (id: string) => {
    await deleteUpload(id);
    setUploads(listUploads());
    if (preview?.upload.id === id) setPreview(null);
  };

  if (uploads.length === 0) {
    return (
      <Empty
        eyebrow="Library"
        title="Everything you've made"
        note="Upload a file with the paperclip and it lands here — nothing homeless."
      />
    );
  }

  return (
    <div className="lib">
      <div className="lib-filters" role="tablist" aria-label="Filter by type">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? 'on' : ''}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="lib-empty">Nothing here yet.</p>
      ) : (
        <ul className="lib-list">
          {shown.map((u) => (
            <li key={u.id}>
              <button className="lib-row" onClick={() => open(u)}>
                {u.kind === 'image' ? (
                  <Thumb id={u.id} name={u.name} />
                ) : (
                  <span className={`lib-icon lib-${u.kind}`} aria-hidden />
                )}
                <span className="lib-meta">
                  <span className="lib-name">{u.name}</span>
                  <span className="lib-sub">
                    {fmtSize(u.size)} · {fmtDate(u.createdAt)}
                  </span>
                </span>
              </button>
              <button className="lib-del" aria-label={`Delete ${u.name}`} onClick={() => remove(u.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {preview && (
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
            {(preview.upload.kind === 'pdf' ||
              preview.upload.kind === 'text' ||
              preview.upload.kind === 'doc' ||
              preview.upload.kind === 'other') && (
              <iframe src={preview.url} title={preview.upload.name} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Thumb({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    uploadData(id).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [id]);
  return url ? <img className="lib-thumb" src={url} alt={name} /> : <span className="lib-icon lib-image" aria-hidden />;
}
