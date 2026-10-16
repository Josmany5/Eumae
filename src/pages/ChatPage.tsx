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
      <Bubbles msgs={t.msgs.map((m) => ({ me: !!m.who, who: p ? p.n : 'Guild', text: m.text }))} />
      <div ref={bottomRef} />
      <MsgBar placeholder={p ? `Message ${p.n}` : 'Message'} value={draft} onChange={setDraft} onSend={send} />
    </div>
  );
}

/* iMessage-style thread: blue bubbles on the right for you, grey on the
 * left for them; runs from one sender stack tight and only the last one
 * gets a tail. Groups show the sender's name above each run. */
function Bubbles({ msgs, group }: { msgs: { me: boolean; who: string; text: string }[]; group?: boolean }) {
  return (
    <div className="im">
      {msgs.map((m, i) => {
        const prev = msgs[i - 1];
        const next = msgs[i + 1];
        const first = !prev || prev.me !== m.me || prev.who !== m.who;
        const last = !next || next.me !== m.me || next.who !== m.who;
        return (
          <div key={i} className={'imRow' + (m.me ? ' me' : '') + (first ? ' first' : '')}>
            {group && !m.me && first ? <div className="imWho">{m.who}</div> : null}
            <div className={'imB' + (last ? ' tail' : '')}>{m.text}</div>
          </div>
        );
      })}
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
      <Bubbles group msgs={gr.msgs.map(([who, text]) => ({ me: who === 'You', who, text }))} />
      <MsgBar placeholder={`Message ${gr.n}`} value={draft} onChange={setDraft} onSend={sendG} />
    </div>
  );
}
