/* Guild thread — bubbles, marks read on open, inline send. Group variant
 * (gchatg) reads groups[].msgs ([who, text] pairs) instead of threads. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNav } from '../nav';
import { getGuild, saveGuild, sendGuildMessage, sendGroupMessage, deleteThread, leaveGroup, snapshotGuild, restoreGuild } from '../guild';
import { Icon } from '../components/shell/icons';
import type { PageProps } from './index';

export default function ChatPage({ arg }: PageProps) {
  const { notify, back } = useNav();
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

  const remove = () => {
    if (!window.confirm(`Delete this chat${p ? ` with ${p.n}` : ''}?`)) return;
    const snap = snapshotGuild();
    if (!deleteThread(index)) return;
    back();
    notify('Chat deleted.', { undo: () => restoreGuild(snap) });
  };

  return (
    <div className="qaPage">
      <ImHead
        name={p ? p.n : 'Guild'}
        action={
          <button className="fb gho danger" onClick={remove}>
            Delete chat
          </button>
        }
      />
      <Bubbles msgs={t.msgs.map((m) => ({ me: !!m.who, who: p ? p.n : 'Guild', text: m.text, at: m.at }))} />
      <div ref={bottomRef} />
      <MsgBar placeholder={p ? `Message ${p.n}` : 'Message'} value={draft} onChange={setDraft} onSend={send} />
    </div>
  );
}

/* iMessage-style header: initials avatar over the name, centered. */
function ImHead({ name, sub, action }: { name: string; sub?: string; action?: ReactNode }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return (
    <div className="imHead">
      <div className="imAv">{ini || '?'}</div>
      <div className="imName">{name}</div>
      {sub ? <div className="xs m">{sub}</div> : null}
      {action}
    </div>
  );
}

/* iMessage-style thread: blue bubbles on the right for you, grey on the
 * left for them; runs from one sender stack tight and only the last one
 * gets a tail. Groups show the sender's name above each run. */
function Bubbles({ msgs, group }: { msgs: { me: boolean; who: string; text: string; at?: number }[]; group?: boolean }) {
  /* Time labels, iMessage-style: before the first stamped message, then
     whenever an hour or more has passed since the last stamped one. Old
     messages carry no stamp and get no label. */
  let lastAt: number | undefined;
  const labels = msgs.map((m) => {
    if (m.at === undefined) return null;
    const show = lastAt === undefined || m.at - lastAt > 60 * 60 * 1000;
    lastAt = m.at;
    return show ? fmtStamp(m.at) : null;
  });
  return (
    <div className="im">
      {msgs.map((m, i) => {
        const prev = msgs[i - 1];
        const next = msgs[i + 1];
        /* A time label breaks a run, like iMessage. */
        const first = !prev || prev.me !== m.me || prev.who !== m.who || !!labels[i];
        const last = !next || next.me !== m.me || next.who !== m.who || !!labels[i + 1];
        return (
          <div key={i} className={'imRow' + (m.me ? ' me' : '') + (first ? ' first' : '')}>
            {labels[i] ? <div className="imTime xs m">{labels[i]}</div> : null}
            {group && !m.me && first ? <div className="imWho">{m.who}</div> : null}
            <div className={'imB' + (last ? ' tail' : '')}>{m.text}</div>
          </div>
        );
      })}
    </div>
  );
}

/* "Today 6:14 PM", "Yesterday 9:02 AM", "Mon 3:10 PM" within the week,
   "Oct 12, 3:10 PM" before that. */
function fmtStamp(at: number): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(d)) / 86400000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
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
  const { notify, back } = useNav();
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
  const leave = () => {
    if (!window.confirm(`Leave ${gr.n}?`)) return;
    const snap = snapshotGuild();
    if (!leaveGroup(gr.n)) return;
    back();
    notify(`Left ${gr.n}.`, { undo: () => restoreGuild(snap) });
  };
  return (
    <div className="qaPage">
      <ImHead
        name={gr.n}
        sub={`${gr.msgs.length} messages`}
        action={
          <button className="fb gho danger" onClick={leave}>
            Leave group
          </button>
        }
      />
      <Bubbles group msgs={gr.msgs.map(([who, text, at]) => ({ me: who === 'You', who, text, at }))} />
      <MsgBar placeholder={`Message ${gr.n}`} value={draft} onChange={setDraft} onSend={sendG} />
    </div>
  );
}
