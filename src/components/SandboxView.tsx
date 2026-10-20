import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './shell/icons';
import { useNav } from '../nav';
import {
  getSbx, setCur, markSaved, lockHtml, openSbx, subscribeSbx, sbxVersion, type SbxItem,
} from '../sandbox';
import { addFileWith, saveEdit, snapshotLibrary, restoreLibrary } from '../library';

export function useSbx(): number {
  return useSyncExternalStore(subscribeSbx, sbxVersion);
}

/* The locked frame. Scripts run; the frame has an opaque origin (no
 * allow-same-origin), so it can't see the app or its storage, and lockHtml's
 * rule keeps it off the network. Before it unmounts it is pointed at a blank
 * page: ripping a live frame out mid-script crashes the iOS webview (Wove). */
export function SbxFrame({ html, title, className }: { html: string; title: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const f = ref.current;
    return () => {
      try {
        if (f) f.srcdoc = '<html><body></body></html>';
      } catch {
        /* never fail an unmount over teardown */
      }
    };
  }, []);
  return <iframe ref={ref} title={title} srcDoc={lockHtml(html)} sandbox="allow-scripts" className={className ?? 'sbxFrame'} />;
}

function FullScreen({ item, onClose }: { item: SbxItem; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  const v = item.versions[item.cur];
  return createPortal(
    <div className="sbxFull" role="dialog" aria-label={item.title}>
      <div className="sbxFullHead">
        <div className="g">
          <div className="sbxTitle">{item.title}</div>
          <div className="sbxMeta">v{item.cur + 1} of {item.versions.length}</div>
        </div>
        <button type="button" className="sbxClose" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <SbxFrame html={v.html} title={item.title} className="sbxFrame sbxFrameFull" />
    </div>,
    document.body,
  );
}

/** The office Sandbox tab: the page, its versions, the code, Save. */
export function SandboxView({ id }: { id: string }) {
  useSbx();
  const { notify } = useNav();
  const [code, setCode] = useState(false);
  const [full, setFull] = useState(false);
  const item = getSbx(id);
  if (!item) return null;
  const v = item.versions[item.cur];
  const vn = item.cur + 1;
  const saved = !!item.fileId && item.savedV === vn;

  const pick = (i: number) => {
    const was = item.cur;
    setCur(item.id, i);
    notify(`Showing v${i + 1}`, { undo: () => setCur(item.id, was) });
  };

  const doSave = () => {
    const snap = snapshotLibrary();
    const wasFile = item.fileId;
    const wasV = item.savedV;
    let fid = item.fileId;
    if (fid && saveEdit(fid, item.title, v.html)) {
      notify(`Saved v${vn} to Library`, {
        undo: () => {
          restoreLibrary(snap);
          markSaved(item.id, wasFile, wasV);
        },
      });
    } else {
      fid = addFileWith(item.title, 'WEB', v.html).id;
      notify('Saved to Library', {
        undo: () => {
          restoreLibrary(snap);
          markSaved(item.id, wasFile, wasV);
        },
      });
    }
    markSaved(item.id, fid, vn);
  };

  return (
    <div className="sbx">
      <div className="sbxHead">
        <div className="g">
          <div className="sbxTitle">{item.title}</div>
          <div className="sbxMeta">{v.label ? `v${vn} · ${v.label}` : `v${vn}`}</div>
        </div>
      </div>
      {item.versions.length > 1 ? (
        <div className="chips sbxVers">
          {item.versions.map((_, i) => (
            <button key={i} type="button" className={'chip' + (i === item.cur ? ' on' : '')} onClick={() => i !== item.cur && pick(i)}>
              v{i + 1}
            </button>
          ))}
        </div>
      ) : null}
      <div className="seg">
        <button type="button" className={code ? '' : 'on'} onClick={() => setCode(false)}>Preview</button>
        <button type="button" className={code ? 'on' : ''} onClick={() => setCode(true)}>Code</button>
      </div>
      {code ? <pre className="sbxCode">{v.html}</pre> : <SbxFrame key={item.id + ':' + item.cur} html={v.html} title={item.title} />}
      <div className="btns">
        <button type="button" onClick={() => setFull(true)}>Full screen</button>
        <button type="button" disabled={saved} onClick={doSave}>
          {saved ? 'Saved' : item.fileId ? `Save v${vn}` : 'Save to Library'}
        </button>
      </div>
      {full ? <FullScreen item={item} onClose={() => setFull(false)} /> : null}
    </div>
  );
}

/** The one row a reply shows for what it made. Tapping opens the Sandbox. */
export function SbxRow({ made }: { made: { id: string; v: number; title: string } }) {
  useSbx();
  const { openPanel } = useNav();
  const item = getSbx(made.id);
  return (
    <button
      type="button"
      className="sbxRow"
      disabled={!item}
      onClick={() => {
        if (!item) return;
        if (item.cur !== made.v - 1 && made.v <= item.versions.length) setCur(item.id, made.v - 1);
        openSbx(item.id);
        openPanel('sandbox');
      }}
    >
      <span className="sbxRowIc"><Icon name="zap" /></span>
      <span className="g sbxRowT">{item ? made.title : 'Removed'}</span>
      <span className="sbxRowV">v{made.v}</span>
      {item ? <span className="sbxRowGo">Open</span> : null}
    </button>
  );
}
