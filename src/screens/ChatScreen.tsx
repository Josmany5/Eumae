import { useEffect, useRef, useState } from 'react';
import Composer from '../components/shell/Composer';
import { Icon } from '../components/shell/icons';
import { useNav, type Mode } from '../nav';
import { logEv } from '../log';
import { streamChat } from '../chat';
import { speak } from '../voice';
import { buildRequest, toApiBody, type ApiChatBody, type ThreadTurn } from '../request';

interface Msg extends ThreadTurn {
  id: number;
  /** The request this message *is* — built when it was sent, from the turn as it
   *  stood then (src/request.ts). Only what the person sent carries one: the
   *  request *is* the message, and a reply is what came back from it. */
  body?: ApiChatBody;
  /** True from the moment the turn is posted until the reply is whole — what the
   *  dots row is drawn from, and what the mic waits for before sending again. */
  streaming?: boolean;
  /** One sentence, under the text, when the reply did not arrive whole (the
   *  server's own sentence, or this side's — src/chat.ts). The text above it
   *  stays: whatever arrived did arrive. */
  note?: string;
}

const SUGGESTIONS = ['Plan my day', 'Summarize my week', 'Draft a proposal', 'What am I forgetting?'];

/** The thread.
 *
 *  What Eumae is holding is not shown here — it lives in the right panel, which
 *  the rail header and the phone header open. The mockup put that
 *  answer in an `#refs` strip pinned above the input; with a panel to hold it,
 *  a second copy in the composer would just be the same list twice.
 *
 *  Each message keeps the request it was sent with (src/request.ts): built here,
 *  from the turn as it stood, so the settings, the attachments and the text are
 *  frozen together at the moment of sending — and then posted, by the sender
 *  (src/chat.ts), which is the one file that knows the wire.
 *
 *  Two things about the reply are this file's own and not the mockup's:
 *
 *  - The wait is drawn. The mockup puts three dots in the thread while an answer
 *    is on its way (1866) and ours does the same, for the same reason: a request
 *    that is taking ten seconds and a request that silently failed look
 *    identical on an empty screen.
 *  - A reply that did not arrive whole says so, in a sentence under whatever did
 *    arrive (`.bubbleNote`). The mockup replaces the whole bubble with "I could
 *    not reach the AI just now" (1905) and throws away the part that came; a
 *    relay that dies mid-answer has still said something, and dropping it makes
 *    the failure look bigger than it was.
 */
export default function ChatScreen() {
  const { turn, setTurn, refs, notify } = useNav();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  /* Replies in flight. A ref rather than state because the only reader is the
     mic's guard, which is called from a speech event and not from a render
     (`VoiceTyping.busy`, voice.ts:55) — and because a counter in state would
     re-render the whole thread on every frame of a stream. */
  const inFlight = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  /* Keep the newest line in view as pieces land. The mockup scrolls its thread
     the same way (1882); the trigger here is the thread itself, since a piece of
     the reply arriving *is* a render. */
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const send = (text: string, byVoice = false) => {
    // The mockup reads the mode off what you asked for (line 878), and the add
    // menu's own tip promises it — so the chip has to keep up. It only ever
    // moves to Build or Learn: an ordinary ask leaves the mode where it is.
    const moved: Mode | null = /(make|build|create|draft|write me|design)/i.test(text)
      ? 'Build'
      : /(learn|teach me|explain|how does|what is a)/i.test(text)
        ? 'Learn'
        : null;
    if (moved) setTurn({ mode: moved });

    /* The request this message *is*, composed from the turn as it is *after* the
       mode moved — the mockup composes its prompt at send time for the same
       reason (1872). `setTurn` is state and lands next paint, so the new mode is
       applied here by hand instead of being read back a render too late, and the
       history is the thread as it stands *before* this message, which is what the
       mockup's own `slice(0,-1)` is doing (1871). */
    const body = toApiBody(buildRequest({ ...turn, mode: moved ?? turn.mode }, refs, text), msgs);

    /* Two ids from one reading of the clock — the turn, and the reply it is
       waiting for — so the reply can still be found in the list while pieces of
       it are arriving and the list is being appended to. */
    const id = Date.now();
    const replyId = id + 1;
    setMsgs((m) => [
      ...m,
      { id, role: 'you', text, body },
      { id: replyId, role: 'eumae', text: '', streaming: true },
    ]);

    /* The clip is the opening of it: a log row is a sentence, not a transcript.
       Where the mic sent it the row says so — the same flag the mockup reads
       back to have the answer spoken aloud (1857 → 1902). */
    const clip = text.length > 60 ? `${text.slice(0, 60)}…` : text;
    logEv({ area: 'Chat', text: byVoice ? `Sent by voice: ${clip}` : `Sent: ${clip}` });

    inFlight.current += 1;
    void streamChat(body, (full) => {
      /* The whole text so far, not the new piece: replacing what the bubble shows
         is the only way two pieces arriving out of order could not show up as a
         sentence in the wrong order. The dots go away with the first piece, which
         is this same update. */
      setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, text: full } : x)));
    }).then((reply) => {
      inFlight.current -= 1;
      setMsgs((m) =>
        m.map((x) =>
          x.id === replyId
            ? { ...x, streaming: false, text: reply.text, note: reply.error ?? undefined }
            : x,
        ),
      );

      /* The reply is the other half of what happened, so it is logged the same way
         the message was — one row per event, with its own dot when it went badly
         (`LogStatus`, log.ts:18), so Logs shows a failed ask without having to
         read the sentence. */
      const said = reply.text.length > 60 ? `${reply.text.slice(0, 60)}…` : reply.text;
      logEv(
        reply.ok
          ? { area: 'Chat', text: `Replied: ${said}` }
          : { area: 'Chat', text: `No reply: ${reply.error}`, status: 'bad' },
      );

      /* Read back only when it arrived, and only when the mic asked: the mockup
         carries `byVoice` from the send to here for exactly this (1902), and half
         a sentence read out is worse than none. */
      if (byVoice && reply.ok && reply.text) speak(reply.text, notify);
    });
  };

  return (
    <div className="chat">
      <div className="chatScroll" ref={scroller}>
        {msgs.length === 0 ? (
          <div className="hello">
            <h1 className="helloT">What are we doing today?</h1>
            <p className="helloN">
              Eumae knows your projects, your day, and your history. Ask for anything — or just start.
            </p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="thread">
            {msgs.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className="msgCol">
                  {m.streaming && !m.text ? (
                    /* Three dots while the answer is on its way — the mockup's own
                       waiting row (1866; its `.wxpill` in the style block at 1836). */
                    <div className="wxpill">
                      <span className="wxd" />
                      <span className="wxd" />
                      <span className="wxd" />
                    </div>
                  ) : (
                    <div className="bubble">
                      {m.text}
                      {m.note ? <div className="bubbleNote">{m.note}</div> : null}
                    </div>
                  )}
                  {/* Read aloud, under the reply it reads — the mockup's `rowA`
                      (1642), which carries a Copy button and this one beside it.
                      Copy is not here: it needs a clipboard path and a receipt to
                      say it happened, and a button that copies nothing is worse
                      than no button. The speaker is real (voice.ts), and it reads
                      whatever arrived, including a reply cut short. */}
                  {m.role === 'eumae' && !m.streaming && m.text ? (
                    <div className="mrow">
                      <button
                        className="mrowBtn"
                        onClick={() => speak(m.text, notify)}
                        aria-label="Read aloud"
                        title="Read aloud"
                      >
                        <Icon name="spk" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chatFoot">
        {/* The mic needs to know whether a reply is in flight, and only this
            screen knows: the count is kept here (1857) and read there (1757). */}
        <Composer onSend={send} busy={() => inFlight.current > 0} />
      </div>
    </div>
  );
}
