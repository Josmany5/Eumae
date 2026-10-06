import { useState } from 'react';
import Composer from '../components/shell/Composer';

interface Msg {
  id: number;
  role: 'you' | 'eumae';
  text: string;
}

const SUGGESTIONS = ['Plan my day', 'Summarize my week', 'Draft a proposal', 'What am I forgetting?'];

export default function ChatScreen() {
  const [msgs, setMsgs] = useState<Msg[]>([]);

  // Stage: pages first, backend later. This is local-only until the
  // memory + harness land and /api/ai is wired to the thread.
  const send = (text: string) => {
    setMsgs((m) => [...m, { id: Date.now(), role: 'you', text }]);
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
        <div className="hint">Enter to send · Shift+Enter for a new line</div>
      </div>
    </div>
  );
}
