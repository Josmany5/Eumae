/* Uploaded files: what the paperclip takes in, what the Library keeps.
 *
 * Every upload carries the same stamps as everything else saved — when it was
 * created, what action created it — so a file is as findable as a message.
 * The bytes live in IndexedDB (localStorage is far too small for photos); the
 * index lives in localStorage under `eumae:uploads` so the Library can list
 * without opening the database. */

/** One saved upload. The shape every saved thing shares: id, timestamps,
 *  and the action that made it. */
export interface Upload {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** ms since epoch. */
  createdAt: number;
  /** What made it: 'upload' for the paperclip, later 'ai-made' for generations. */
  action: string;
  /** 'image' | 'pdf' | 'text' | 'audio' | 'video' | 'doc' | 'other' — the
   *  Library's filter row reads this, not the MIME string. */
  kind: UploadKind;
}

export type UploadKind = 'image' | 'pdf' | 'text' | 'audio' | 'video' | 'doc' | 'other';

const INDEX_KEY = 'eumae:uploads';
const DB_NAME = 'eumae-uploads';
const STORE = 'files';

export function kindOf(mimeType: string, name: string): UploadKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/') || /\.(txt|md|csv|json|js|ts|tsx|py|html|css)$/i.test(name)) return 'text';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (/word|excel|powerpoint|officedocument/i.test(mimeType)) return 'doc';
  return 'other';
}

function readIndex(): Upload[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Upload[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(list: Upload[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* Storage full — the files are still in IndexedDB; the list just won't
       survive a reload. */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** A data URL for the file's bytes. HEIC (the iPhone's default photo format)
 *  becomes JPEG on the way in — nothing else in the pipeline reads HEIC. */
async function dataUrlOf(file: File): Promise<string> {
  const isHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (!isHeic) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) throw new Error('no 2d context');
  ctx2d.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) throw new Error('heic convert failed');
  return dataUrlOf(new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' }));
}

/** Save a picked file. Returns the index entry; the bytes are in IndexedDB. */
export async function saveUpload(file: File): Promise<Upload> {
  const url = await dataUrlOf(file);
  const upload: Upload = {
    id: `u${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: file.name || 'Untitled',
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: Date.now(),
    action: 'upload',
    kind: kindOf(file.type, file.name),
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(url, upload.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  const index = readIndex();
  index.unshift(upload);
  writeIndex(index);
  return upload;
}

/** The file's data URL, for previewing or sending to the AI. */
export async function uploadData(id: string): Promise<string | null> {
  const db = await openDb();
  const url = await new Promise<string | null>((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
    req.onerror = () => resolve(null);
  });
  db.close();
  return url;
}

export function listUploads(): Upload[] {
  return readIndex();
}

/** Drop an upload from the index and the database. */
export async function deleteUpload(id: string): Promise<void> {
  writeIndex(readIndex().filter((u) => u.id !== id));
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}
