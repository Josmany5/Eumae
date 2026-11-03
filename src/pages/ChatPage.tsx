/* Guild thread — bubbles, marks read on open, inline send. Group variant
 * (gchatg) reads groups[].msgs ([who, text] pairs) instead of threads. */

import { fmtStamp } from '../stamp';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNav } from '../nav';
import { getGuild, saveGuild, sendGuildMessage, sendGroupMessage, deleteThread, leaveGroup, setGroupPin, snapshotGuild, restoreGuild } from '../guild';
import { Icon } from '../components/shell/icons';
import type { PageProps } from './index';
import { ItemMenu } from '../components/ItemMenu';

export default function ChatPage({ arg }: PageProps) {
  const { notify, back, go } = useNav();
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
          <ItemMenu
            name={p ? p.n : 'this chat'}
            extra={p ? [{ label: `Open ${p.n}'s page`, onClick: () => go('person', t.p) }] : undefined}
            deleteLabel="Delete chat"
            onDelete={remove}
          />
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
  const [pinEdit, setPinEdit] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((x) => x + 1);
  const g = getGuild();
  const gr = g.groups.find((x) => x.n === name);
  if (!gr) return <div className="empty">No group here.</div>;
  const savePin = () => {
    if (pinEdit === null) return;
    setGroupPin(gr.n, pinEdit);
    setPinEdit(null);
    refresh();
    notify(pinEdit.trim() ? 'Pinned to the top of this guild.' : 'Pin removed.');
  };
  const sendG = () => {
    if (sendGroupMessage(name, draft) === 'Nothing there.') return;
    setDraft('');
    setTick((x) => x + 1);
  };
  const leave = () => {
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
          <ItemMenu
            name={gr.n}
            extra={[{ label: gr.pin ? 'Edit pinned note' : 'Pin a note', onClick: () => setPinEdit(gr.pin ?? '') }]}
            deleteLabel="Leave group"
            onDelete={leave}
          />
        }
      />
      {gr.pin || pinEdit !== null ? (
        <div className="pinNote">
          <div className="row">
            <span className="pinT g">📌 PINNED</span>
            {pinEdit === null ? (
              <button className="lnkBtn" onClick={() => setPinEdit(gr.pin ?? '')}>Edit</button>
            ) : null}
          </div>
          {pinEdit !== null ? (
            <>
              <textarea
                className="sinput"
                rows={2}
                value={pinEdit}
                placeholder="One note everyone in this guild sees first"
                aria-label="Pinned note"
                onChange={(e) => setPinEdit(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="fb" style={{ fontWeight: 700 }} onClick={savePin}>Save pin</button>
                <button className="fb" onClick={() => setPinEdit(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="s" style={{ marginTop: 6 }}>{gr.pin}</div>
          )}
        </div>
      ) : null}
      <Bubbles group msgs={gr.msgs.map(([who, text, at]) => ({ me: who === 'You', who, text, at }))} />
      <MsgBar placeholder={`Message ${gr.n}`} value={draft} onChange={setDraft} onSend={sendG} />
    </div>
  );
}
