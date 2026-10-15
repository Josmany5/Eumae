/* Guild thread — bubbles, marks read on open, inline send. Group variant
 * (gchatg) reads groups[].msgs ([who, text] pairs) instead of threads. */

import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { getGuild, saveGuild, sendGuildMessage } from '../guild';
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
    <div>
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
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8 }}>
        <input
          placeholder={p ? `Message ${p.n}` : 'Message'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          style={{ flex: 1 }}
          aria-label="Message"
        />
        <button className="fb" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}

export function GroupChatPage({ arg }: PageProps) {
  const name = typeof arg === 'string' ? arg : '';
  const g = getGuild();
  const gr = g.groups.find((x) => x.n === name);
  if (!gr) return <div className="empty">No group here.</div>;
  return (
    <div>
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
    </div>
  );
}
