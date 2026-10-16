/* Guild thread — bubbles, marks read on open, inline send. Group variant
 * (gchatg) reads groups[].msgs ([who, text] pairs) instead of threads. */

import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { getGuild, saveGuild, sendGuildMessage, sendGroupMessage } from '../guild';
import { Icon } from '../components/shell/icons';
import type { PageProps } from './index';

export default function ChatPage({ arg }: PageProps) {
  const { notify } = useNav();
  const index = typeof arg === 'number' ? arg : -1;
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  void tick;

  const g = getGuild();
  const t = g.threads[index];
  useEffect(() => {
    if (t && t.un) {
      const next = getGuild();
      next.threads[index] = { ...t, un: 0 };
      saveGuild(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  });

  if (!t) return <div className="empty">No thread here.</div>;
  const p = g.people[t.p];

  const send = () => {
    const v = draft.trim();
    if (!v) return;
    const msg = sendGuildMessage(index, v);
    if (msg === 'Nothing there.') {
      notify('Nothing there.');
      return;
    }
    setDraft('');
    setTick((x) => x + 1);
  };

  return (
    <div className="qaPage">
      <div id="thread" style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' }}>
        {t.msgs.map((m, i) =>
          m.who ? (
            <div key={i} className="b me">
              <div className="w">You</div>
              <div>{m.text}</div>
            </div>
          ) : (
            <div key={i} className="b">
              <div className="w">{p ? p.n : 'Guild'}</div>
              <div>{m.text}</div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>
      <MsgBar placeholder={p ? `Message ${p.n}` : 'Message'} value={draft} onChange={setDraft} onSend={send} />
    </div>
  );
}

/* The Guild message bar — same look as the quick-add bars, docked at the
 * page bottom via .qaPage. */
function MsgBar({ placeholder, value, onChange, onSend }: { placeholder: string; value: string; onChange: (v: string) => void; onSend: () => void }) {
  const ready = value.trim().length > 0;
  return (
    <div className="qa">
      <div className={'qaBar' + (ready ? ' ready' : '')}>
        <input
          className="qaIn"
          placeholder={placeholder}
          value={value}
          enterKeyHint="send"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend();
          }}
          aria-label="Message"
        />
        <button className="qaSend" onClick={onSend} disabled={!ready} aria-label="Send">
          <Icon name="up" />
        </button>
      </div>
    </div>
  );
}

export function GroupChatPage({ arg }: PageProps) {
  const name = typeof arg === 'string' ? arg : '';
  const [draft, setDraft] = useState('');
  const [, setTick] = useState(0);
  const g = getGuild();
  const gr = g.groups.find((x) => x.n === name);
  if (!gr) return <div className="empty">No group here.</div>;
  const sendG = () => {
    if (sendGroupMessage(name, draft) === 'Nothing there.') return;
    setDraft('');
    setTick((x) => x + 1);
  };
  return (
    <div className="qaPage">
      <div className="s m" style={{ marginBottom: 8 }}>
        {gr.msgs.length} messages · {gr.last}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' }}>
        {gr.msgs.map(([who, text], i) =>
          who === 'You' ? (
            <div key={i} className="b me">
              <div className="w">You</div>
              <div>{text}</div>
            </div>
          ) : (
            <div key={i} className="b">
              <div className="w">{who}</div>
              <div>{text}</div>
            </div>
          ),
        )}
      </div>
      <MsgBar placeholder={`Message ${gr.n}`} value={draft} onChange={setDraft} onSend={sendG} />
    </div>
  );
}
