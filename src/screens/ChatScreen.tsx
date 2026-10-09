import { useState } from 'react';
import Composer from '../components/shell/Composer';
import { useNav, type Mode } from '../nav';
import { logEv } from '../log';
import { buildRequest, toApiBody, type ApiChatBody, type ThreadTurn } from '../request';

interface Msg extends ThreadTurn {
  id: number;
  /** The request this message *is* — built when it was sent, from the turn as it
   *  stood then (src/request.ts). Kept per message rather than read back off the
   *  live turn, so picking a different model afterwards cannot rewrite how an
   *  earlier message was asked. Phase 6's job is to post it and stream the reply;
   *  until then it is the record, and the reason the mapping is exercised at all
   *  (an uncalled module is tree-shaken straight out of `dist`). */
  body: ApiChatBody;
}

const SUGGESTIONS = ['Plan my day', 'Summarize my week', 'Draft a proposal', 'What am I forgetting?'];

/** The thread.
 *
 *  What Eumae is holding is not shown here — it lives in the right panel, which
 *  the rail header and the phone header open. The mockup put that
 *  answer in an `#refs` strip pinned above the input; with a panel to hold it,
 *  a second copy in the composer would just be the same list twice.
 *
 *  Each message keeps the request it was sent with (src/request.ts) — the
 *  shape /api/ai will be handed in Phase 6, built here so that the turn, the
 *  attachments and the text are frozen together at the moment of sending. */
export default function ChatScreen() {
  const { turn, setTurn, refs } = useNav();
  const [msgs, setMsgs] = useState<Msg[]>([]);

  // Stage: pages first, backend later. This is local-only until the
  // memory + harness land and /api/ai is wired to the thread.
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

    setMsgs((m) => [...m, { id: Date.now(), role: 'you', text, body }]);

    // What happened is a message landing in this thread — there is no reply to
    // record yet, because nothing answers (Phase 6 wires /api/ai). The clip is
    // the opening of it: a log row is a sentence, not a transcript. Where the
    // mic sent it the row says so — the same flag the mockup reads back to have
    // the answer spoken aloud (1857 → 1902), which needs a reply to read.
    const clip = text.length > 60 ? `${text.slice(0, 60)}…` : text;
    logEv({ area: 'Chat', text: byVoice ? `Sent by voice: ${clip}` : `Sent: ${clip}` });
  };

  return (
    <div className="chat">
      <div className="chatScroll">
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
                <div className="bubble">{m.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chatFoot">
        <Composer onSend={send} />
      </div>
    </div>
  );
}
