import { useState } from 'react';
import Composer from '../components/shell/Composer';
import { useNav } from '../nav';
import { logEv } from '../log';

interface Msg {
  id: number;
  role: 'you' | 'eumae';
  text: string;
}

const SUGGESTIONS = ['Plan my day', 'Summarize my week', 'Draft a proposal', 'What am I forgetting?'];

/** The thread.
 *
 *  What Eumae is holding is not shown here — it lives in the right panel, which
 *  the rail header and the phone header open. The mockup put that
 *  answer in an `#refs` strip pinned above the input; with a panel to hold it,
 *  a second copy in the composer would just be the same list twice. */
export default function ChatScreen() {
  const { setTurn } = useNav();
  const [msgs, setMsgs] = useState<Msg[]>([]);

  // Stage: pages first, backend later. This is local-only until the
  // memory + harness land and /api/ai is wired to the thread.
  const send = (text: string) => {
    // The mockup reads the mode off what you asked for (line 878), and the add
    // menu's own tip promises it — so the chip has to keep up. It only ever
    // moves to Build or Learn: an ordinary ask leaves the mode where it is.
    if (/(make|build|create|draft|write me|design)/i.test(text)) setTurn({ mode: 'Build' });
    else if (/(learn|teach me|explain|how does|what is a)/i.test(text)) setTurn({ mode: 'Learn' });

    setMsgs((m) => [...m, { id: Date.now(), role: 'you', text }]);

    // What happened is a message landing in this thread — there is no reply to
    // record yet, because nothing answers (Phase 6 wires /api/ai). The clip is
    // the opening of it: a log row is a sentence, not a transcript.
    const clip = text.length > 60 ? `${text.slice(0, 60)}…` : text;
    logEv({ area: 'Chat', text: `Sent: ${clip}` });
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
