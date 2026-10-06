import { useRef, useState } from 'react';
import { Icon } from './icons';
import { useNav } from '../../nav';

interface ComposerProps {
  onSend: (text: string) => void;
  placeholder?: string;
}

/** The mockup's composer, whole.
 *
 *  `#composer` (line 391) is the chip row plus `.in`: a single flex row at 28px
 *  radius holding `+`, the field, the mic and send, every control a 40px `.cb`
 *  circle. Two more of its parts are injected at runtime and are just as much
 *  the mockup as the markup is — the paperclip it puts before the mic (line
 *  1799, `accept="image/*,.pdf"`) and the rewrite of `+` from the drawer to the
 *  "Add to this chat" menu (line 1273). Both are here as themselves.
 *
 *  `ctx` used to sit between the paperclip and the mic. The mockup's row has no
 *  context button — it has no panel at all — so it is gone and the row is `+`,
 *  field, paperclip, mic, send. The panel did not lose its door: the rail header
 *  and the phone header still open it (nav.ts).
 *
 *  The doors that remain do different jobs, which is what went wrong the first
 *  time round: `+` sets the chat up and never attaches anything, and the
 *  paperclip brings a photo or PDF into this message. */
export default function Composer({ onSend, placeholder = 'Ask Eumae' }: ComposerProps) {
  const { turn, openAdd, pickFile } = useNav();
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  /* The mockup's chip (line 1270) — mode, then role and skill only when they're
     doing something, then the caret that says it opens. It is the read-out for
     the `+` menu, which is what stops that menu from being write-only. */
  const live = [turn.mode, turn.role, turn.skill].filter(Boolean).join(' · ');

  return (
    <div className="cmpWrap">
      <div className="modeBar">
        <button className="modeChip" onClick={openAdd} title="How Eumae answers">
          {live} <span className="cv">▾</span>
        </button>
      </div>

      <div className="cmp">
        <button className="cmpIcon" onClick={openAdd} aria-label="Add" title="Add to this chat">
          <Icon name="pls" />
        </button>

        <textarea
          ref={ref}
          className="cmpIn"
          rows={1}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            const value = e.target.value;
            // The mockup's `/` (line 1278): a lone slash opens the menu instead
            // of typing one — the shortcut the menu's own tip promises.
            if (value === '/') {
              setText('');
              openAdd();
              return;
            }
            setText(value);
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />

        {/* The mockup's paperclip. What you get when it opens is the OS picker,
            and for `image/*` that is where "Photo library / Take photo / Choose
            file" comes from — no menu of ours to draw. */}
        <button
          className="cmpIcon"
          onClick={pickFile}
          aria-label="Attach a photo or PDF"
          title="Attach a photo or PDF"
        >
          <Icon name="clp" />
        </button>

        <button className="cmpIcon" aria-label="Voice mode" title="Voice mode">
          <Icon name="mic" />
        </button>
        <button className="cmpSend" onClick={send} aria-label="Send" disabled={!text.trim()}>
          <Icon name="up" />
        </button>
      </div>
    </div>
  );
}
