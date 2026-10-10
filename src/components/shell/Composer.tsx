import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { useNav, DEFAULT_TURN } from '../../nav';
import { armVisibility, stopListening, toggleMic, type VoiceTyping } from '../../voice';

interface ComposerProps {
  /** `byVoice` is true when the mic sent this rather than the keyboard — the
   *  mockup carries the same flag on to reading the reply aloud (1857, 1902). */
  onSend: (text: string, byVoice?: boolean) => void;
  /** Is a reply in flight? The mic asks before sending, because the mockup's own
   *  mic waits for the answer instead of talking over it (1757). Defaults to
   *  "no", which is what a composer with nothing behind it can honestly say. */
  busy?: () => boolean;
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
export default function Composer({ onSend, busy, placeholder = 'Ask Eumae' }: ComposerProps) {
  const { turn, openAdd, pickFile, notify } = useNav();
  const [text, setTextState] = useState('');
  const [micOn, setMicOn] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  /* The field, and the one value every writer writes. The mic writes through
     `setText` and this send reads the same ref, so there is exactly one place
     the text lives — the mockup's `#cin.value` (1758), kept as a ref rather
     than the node. */
  const field = useRef('');

  const setText = (value: string) => {
    field.current = value;
    setTextState(value);
  };

  /** Grow the field to its content — the same rule the typing below applies,
   *  and needed here too, because the mic writes without a keystroke.
   *
   *  Fitted on the next frame rather than inside the handler that asked: the
   *  handler runs before React has put the new value in the node, so measuring
   *  there measures the *previous* text and the field ends up one step behind
   *  what it holds — a dictation several sentences long stays one sentence tall.
   *  Deferring is also what keeps the mockup's own rule exact — it sets `.value`
   *  and resizes in the same breath (1841), which in a DOM that already holds the
   *  text is what "measure after the write" means. */
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    });
  };

  const send = (byVoice = false) => {
    /* Read off the field, not off the state variable — and this is the whole
       reason `field` exists. `send` is handed to `voice.ts` inside the `VoiceTyping`
       the mic builds (below, and voice.ts:394), and that module holds the object
       for the entire dictation: every later render makes a *new* `send`, and none
       of them can reach the one the mic is holding. So a `send` that closed over
       `text` would still be reading the field as it was when the mic was switched
       on — empty, on a cold mic — and the half-second-quiet send would return
       early without a word, for ever. `field.current` is written on every change
       from either side (typing, `/`, the mic, this function), so it is one value
       with one writer, and it is the same reading the mockup takes straight off
       `#cin.value` at both ends (1758, 1854). */
    const value = field.current.trim();
    if (!value) return false;
    onSend(value, byVoice);
    setText('');
    if (ref.current) ref.current.style.height = 'auto';
    return true;
  };

  /* The mic's tap (mockup `micTap`, 1786). This button used to be the mockup's
     own stub — `onclick="toast('Voice mode')"` on line 391 — and `inject()`
     (1833) is the thing that swaps that handler for this one. So the stub's
     toast text is gone and the markup's own `aria-label="Mic"` stays. */
  const micTap = () => {
    const voice: VoiceTyping = {
      write: (value) => {
        setText(value);
        fit();
      },
      send: (byVoice) => send(byVoice),
      /* Answered by the screen that owns the thread: while a reply is streaming
         the mic waits rather than sending into it (1757), which is the one part
         of the mockup's behaviour that needs something the mic cannot see. A
         composer without a `busy` says no, which is all it can know. */
      busy: () => busy?.() ?? false,
      lit: setMicOn,
      say: notify,
    };
    toggleMic(voice);
  };

  /* Losing the composer is losing the mic's only reason to be listening. */
  useEffect(() => {
    armVisibility();
    return stopListening;
  }, []);

  /* The chip row — the mockup's `chipsHTML` (line 1270) taken one step further.
     That one always shows the mode, adds the role unless it is Default and the
     skill unless one is set, and never draws Thinking or Model because it never
     had a chip for them; its own later draft (`chips10HTML`, line 1341) does
     draw Thinking when it isn't Balanced, which is the rule Phase 5 extends to
     all five. So: one pill per setting that is doing something, mode always,
     defaults hidden — and "doing something" is read off `DEFAULT_TURN` rather
     than spelled out here, so a changed default cannot leave a stale pill.

     Every pill is read-only (I4). §4.13 gives the five to `+` and nothing else,
     so a pill cannot clear itself the way 1341's did with its ×; all of them
     open that one window instead — the receipt is what stops the window being
     write-only. */
  const pills: { k: string; v: string }[] = [
    { k: 'mode', v: turn.mode },
    { k: 'role', v: turn.role },
    { k: 'skill', v: turn.skill },
    { k: 'thinking', v: turn.thinking === DEFAULT_TURN.thinking ? '' : turn.thinking },
    { k: 'model', v: turn.model === DEFAULT_TURN.model ? '' : turn.model },
  ].filter((p) => p.v);

  return (
    <div className="cmpWrap">
      <div className="modeBar">
        {pills.map((p, i) => (
          <button key={p.k} className="modeChip" onClick={openAdd} title="How Eumae answers">
            {p.v}
            {/* One caret for the row, on its last pill — the mockup's single `▾`
                (line 1270) said the chip opens; the row says it once, at its
                end, rather than on all five. */}
            {i === pills.length - 1 ? <span className="cv"> ▾</span> : null}
          </button>
        ))}
      </div>

      <div className="cmp">
        <button className="cmpIcon" onClick={openAdd} aria-label="Add" title="Add to this chat">
          <Icon name="pls" />
        </button>

        <textarea
          ref={ref}
          className="cmpIn"
          id="composer-input"
          name="composer"
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

        <button
          className={`cmpIcon${micOn ? ' on' : ''}`}
          onClick={micTap}
          aria-label="Mic"
          title="Mic"
        >
          <Icon name="mic" />
        </button>
        <button className="cmpSend" onClick={() => send()} aria-label="Send" disabled={!text.trim()}>
          <Icon name="up" />
        </button>
      </div>
    </div>
  );
}
