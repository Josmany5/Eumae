import { useEffect, useRef, useState } from 'react';
import { clearVoiceLog, getVoiceLog, subscribeVoiceLog, type VoiceLogEntry } from '../../voice';

/** A floating debug overlay: every voice-session event, timestamped, so a phone
 *  test can be screenshotted and read. Collapsed to a dot until opened. */
export default function VoiceDebug() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<VoiceLogEntry[]>(() => getVoiceLog());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeVoiceLog(setEntries), []);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, open]);

  return (
    <div className="vdbg">
      <button
        className="vdbg-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close voice log' : 'Open voice log'}
      >
        {open ? '✕' : '◉'}
      </button>
      {open && (
        <div className="vdbg-panel" role="log" aria-label="Voice debug log">
          <div className="vdbg-head">
            <span>voice log</span>
            <button className="vdbg-clear" onClick={clearVoiceLog}>
              clear
            </button>
          </div>
          <div className="vdbg-list" ref={listRef}>
            {entries.length === 0 ? (
              <div className="vdbg-empty">tap the mic — every step lands here</div>
            ) : (
              entries.map((e, i) => (
                <div key={i} className={e.error ? 'vdbg-row vdbg-err' : 'vdbg-row'}>
                  <span className="vdbg-t">+{(e.t / 1000).toFixed(2)}s</span>
                  <span className="vdbg-m">{e.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
