import { useEffect, useRef, useState } from 'react';
import Composer from '../components/shell/Composer';
import { Icon } from '../components/shell/icons';
import { useNav, type Mode } from '../nav';
import { logEv } from '../log';
import { streamChat } from '../chat';
import { endVoiceReply, feedVoiceReply, speak, startVoiceReply } from '../voice';
import { buildRequest, toApiBody, type ApiChatBody, type ThreadTurn } from '../request';
import { getThread, saveThread, titleFor } from '../threads';

export interface Msg extends ThreadTurn {
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
  /** Where the reply came from, when search grounded it. */
  sources?: { uri: string; title: string }[];
  /** The files that went out with this message — snapshots of the refs at send
   *  time, so the bubble shows what the AI saw. */
  attachments?: { label: string; icon: string; url?: string }[];
  /** When this message was sent. Shown under the bubble. */
  ts: number;
}

const SUGGESTIONS = ['Plan my day', 'Summarize my week', 'Draft a proposal', 'What am I forgetting?'];

/** How long a Copy button stays a tick. wove's own 1500ms (1704). */
const COPIED_MS = 1500;

/** Put this text on the clipboard, and say whether it got there.
 *
 *  Two paths, because one is not enough: `navigator.clipboard` needs a secure
 *  context and, on Safari, a live gesture — and a copy button that quietly copies
 *  nothing is worse than no button at all, which is why Copy was left off the row
 *  until now. The second path is wove's own (1703): a scratch textarea, selected,
 *  `execCommand('copy')`. Whatever happens, the answer is returned rather than
 *  assumed, and the caller is the one that decides what to say about a failure. */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Refused — no secure context, or no permission. The other path, below. */
    }
  }
  try {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    /* Off-screen rather than hidden: a `display:none` textarea cannot be
       selected, and `select()` on one copies nothing. */
    scratch.style.position = 'fixed';
    scratch.style.top = '0';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(scratch);
    return ok;
  } catch {
    return false;
  }
}

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
/** Sources, collapsed by default — provenance available, not loud. A quiet pill
 *  with the count; tap to fan out the deduped domain chips. */
function SourcesPill({ sources }: { sources: { uri: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sources">
      <button className="sourcesPill" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Sources · {sources.length}
      </button>
      {open && (
        <div className="sourcesChips">
          {sources.map((s) => (
            <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer" className="sourceChip">
              <img
                className="sourceFav"
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(s.title)}&sz=32`}
                alt=""
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span>{s.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full-screen image viewer — tap a picture in chat, see it big. Dark backdrop,
 *  × to close, tap outside to close. */
function ImageViewer({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  return (
    <div className="imgViewer" role="dialog" aria-label={alt} onClick={onClose}>
      <button className="imgViewerX" onClick={onClose} aria-label="Close">
        <Icon name="x" />
      </button>
      <img
        className="imgViewerImg"
        src={url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function ChatScreen() {
  const { turn, setTurn, refs, clearRefs, notify, currentThreadId: threadId } = useNav();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [viewing, setViewing] = useState<{ url: string; alt: string } | null>(null);
  /* Replies in flight. A ref rather than state because the only reader is the
     mic's guard, which is called from a speech event and not from a render
     (`VoiceTyping.busy`, voice.ts:55) — and because a counter in state would
     re-render the whole thread on every frame of a stream. */
  const inFlight = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  /* The box open over a message, so its height can follow what is in it
     (below). Only one message is ever being edited, so one ref is enough. */
  const editRef = useRef<HTMLTextAreaElement>(null);
  /* Which message is being rewritten, and what is in the box. One at a time, and
     `null` for none — wove keeps the same single `EDITSTATE` (1711). */
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  /* True on the render where the thread just changed — the save below must
     skip it, or the old thread's messages overwrite the new thread before its
     own messages load (the 2026-10-10 history corruption). */
  const switching = useRef(false);
  /* Load the current thread's messages. App owns thread identity. */
  useEffect(() => {
    const thread = threadId ? getThread(threadId) : undefined;
    switching.current = true;
    setMsgs(thread ? thread.messages : []);
  }, [threadId]);

  /* Save messages to the current thread on every change. */
  useEffect(() => {
    if (!threadId) return;
    if (switching.current) {
      switching.current = false;
      return;
    }
    const thread = getThread(threadId);
    if (!thread) return;
    saveThread({ ...thread, messages: msgs });
  }, [msgs, threadId]);
  /* The id whose Copy just worked, so that button can be a tick for a moment
     (wove swaps the icon the same way, 1704). Zero is no message: ids are
     `Date.now()`, so no real one is ever 0. */
  const [copied, setCopied] = useState(0);

  /* Keep the newest line in view as pieces land. The mockup scrolls its thread
     the same way (1882); the trigger here is the thread itself, since a piece of
     the reply arriving *is* a render. */
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  /* The edit box fits what it holds, capped the way the composer is and for the
     same reasons (Composer.tsx: 160px, then it scrolls): a message of a
     paragraph shows as a paragraph, and the box never takes the thread to do
     it. It is fitted on the next frame because this runs on the render that
     opened the box, when React has not put the text in the node yet — measure
     there and it measures an empty field. */
  useEffect(() => {
    const el = editRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    });
  }, [editing]);

  /* `history` is the thread this message belongs to. It is an argument — rather
     than always `msgs` — because one caller cannot wait for the state to catch
     up: an edit cuts the thread and re-sends in the same breath (`sendEdit`), and
     on that render `msgs` is still the list with the old message and its reply
     in it. Everything else leaves it out and sends the thread as it stands. */
  const send = (text: string, byVoice = false, history?: Msg[]) => {
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
    const body = toApiBody(buildRequest({ ...turn, mode: moved ?? turn.mode }, refs, text), history ?? msgs);

    /* Two ids from one reading of the clock — the turn, and the reply it is
       waiting for — so the reply can still be found in the list while pieces of
       it are arriving and the list is being appended to. */
    const id = Date.now();
    const replyId = id + 1;
    const now = Date.now();
    const isFirst = msgs.length === 0;
    setMsgs((m) => [
      ...m,
      { id, role: 'you', text, body, attachments: refs.map((r) => ({ label: r.label, icon: r.icon, url: r.url })), ts: now },
      { id: replyId, role: 'eumae', text: '', streaming: true, ts: now },
    ]);
    /* Title the thread from the first user message. Outside the updater —
       updaters must stay pure. */
    if (isFirst && threadId && text.trim()) {
      const thread = getThread(threadId);
      if (thread) saveThread({ ...thread, title: titleFor(text) });
    }
    /* Attachments belong to the message that carried them. The composer clears;
       the message keeps them. */
    clearRefs();

    /* The clip is the opening of it: a log row is a sentence, not a transcript.
       Where the mic sent it the row says so — the same flag the mockup reads
       back to have the answer spoken aloud (1857 → 1902). */
    const clip = text.length > 60 ? `${text.slice(0, 60)}…` : text;
    logEv({ area: 'Chat', text: byVoice ? `Sent by voice: ${clip}` : `Sent: ${clip}` });

    inFlight.current += 1;
    /* A voice send reads its own reply aloud as it streams: the first complete
       sentence starts speaking about a second after it is complete, while the
       rest is still arriving — instead of waiting for the whole reply. */
    const voiceId = byVoice ? startVoiceReply(notify) : 0;
    void streamChat(body, (full) => {
      /* The whole text so far, not the new piece: replacing what the bubble shows
         is the only way two pieces arriving out of order could not show up as a
         sentence in the wrong order. The dots go away with the first piece, which
         is this same update. */
      setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, text: full } : x)));
      if (byVoice) feedVoiceReply(voiceId, full);
    }).then((reply) => {
      inFlight.current -= 1;
      setMsgs((m) =>
        m.map((x) =>
          x.id === replyId
            ? { ...x, streaming: false, text: reply.text, note: reply.error ?? undefined, sources: reply.sources }
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

      /* The streaming read-aloud ends with the stream: the held-back tail is
         spoken, or a failed reply says why once. A reply is only read when the
         mic asked — the mockup carries `byVoice` from the send to here for
         exactly this (1902). */
      if (byVoice) endVoiceReply(voiceId, reply.ok, reply.error ?? undefined);
    });
  };

  /** Copy one message. The receipt is wove's: the button becomes a tick for a
   *  moment and nothing is said, because a toast over the text you just copied is
   *  in the way of the thing you copied it for. A failure is the one case that
   *  gets a sentence — silence there is a button that looks like it worked. */
  const copy = (text: string, id: number) => {
    void copyText(text).then((ok) => {
      if (!ok) {
        notify('Could not copy that');
        return;
      }
      setCopied(id);
      window.setTimeout(() => setCopied((current) => (current === id ? 0 : current)), COPIED_MS);
    });
  };

  /** Open the box on one of your own messages — wove's `wxEdit` (1711). Not while
   *  a reply is arriving, and it says why rather than doing nothing: an edit cuts
   *  the thread from that message on, and a thread being written from two
   *  directions at once is not something either end can make sense of. */
  const startEdit = (m: Msg) => {
    if (inFlight.current > 0) {
      notify('Wait for the reply to finish.');
      return;
    }
    setEditing({ id: m.id, text: m.text });
  };

  /** Send the rewritten message. Everything from it on goes — the reply it got,
   *  and anything after that — because the edit is a different question and an
   *  answer to the old one has nothing to stand on (wove truncates the same way,
   *  1722). The thread without them is handed to `send` directly: the state has
   *  not rendered yet, and asking the model about a message that is being
   *  deleted is exactly the bug this argument exists to avoid. */
  const sendEdit = () => {
    const draft = editing;
    if (!draft) return;
    setEditing(null);
    const text = draft.text.trim();
    if (!text) return;
    const at = msgs.findIndex((m) => m.id === draft.id);
    const kept = at < 0 ? msgs : msgs.slice(0, at);
    setMsgs(kept);
    send(text, false, kept);
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
                <div className={`msgCol${editing?.id === m.id ? ' editing' : ''}`}>
                  {editing?.id === m.id ? (
                    /* Your own message, open for rewriting — wove's inline box
                       (1715): the text where the bubble was, Cancel, Send. It sits
                       in `.msgCol`, which on your side is already right-aligned and
                       is given the width the box fills while it is open
                       (tokens.css), so it lands over the message it is replacing
                       and takes the room a bubble is allowed. Escape is Cancel,
                       because the browser offers that reflex to anything holding a
                       draft; Enter sends and Shift+Enter breaks the line, which is
                       what the field at the bottom of the thread already does
                       (Composer.tsx). */
                    <div className="editBox">
                      <textarea
                        className="editIn"
                        id="edit-message"
                        name="edit"
                        ref={editRef}
                        rows={3}
                        value={editing.text}
                        autoFocus
                        onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditing(null);
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendEdit();
                          }
                        }}
                      />
                      <div className="editBtns">
                        <button className="editCancel" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                        <button className="editSend" onClick={sendEdit}>
                          Send
                        </button>
                      </div>
                    </div>
                  ) : m.streaming && !m.text ? (
                    /* Three dots while the answer is on its way — the mockup's own
                       waiting row (1866; its `.wxpill` in the style block at 1836). */
                    <div className="wxpill">
                      <span className="wxd" />
                      <span className="wxd" />
                      <span className="wxd" />
                    </div>
                  ) : (
                    <>
                      {/* Images stand alone — the picture is the bubble, not
                          something inside it. Text and files go in the bubble
                          below, the way every chat app does it. */}
                      {m.attachments && m.attachments.some((a) => a.icon === 'img' && a.url) ? (
                        <div className="msgImgs">
                          {m.attachments
                            .filter((a) => a.icon === 'img' && a.url)
                            .map((a) => (
                              <button
                                key={a.label}
                                className="msgAttachBtn"
                                onClick={() => a.url && setViewing({ url: a.url, alt: a.label })}
                                aria-label={`View ${a.label} full screen`}
                              >
                                <img className="msgAttachImg" src={a.url} alt={a.label} />
                              </button>
                            ))}
                        </div>
                      ) : null}
                      {(m.text ||
                        (m.attachments && m.attachments.some((a) => !(a.icon === 'img' && a.url))) ||
                        m.note ||
                        (m.sources && m.sources.length > 0)) ? (
                        <div className="bubble">
                          {m.attachments && m.attachments.some((a) => !(a.icon === 'img' && a.url)) ? (
                            <div className="msgAttaches">
                              {m.attachments
                                .filter((a) => !(a.icon === 'img' && a.url))
                                .map((a) => (
                                  <div key={a.label} className="msgAttach">
                                    <span className="msgAttachName">{a.label}</span>
                                  </div>
                                ))}
                            </div>
                          ) : null}
                          {m.text}
                          {m.note ? <div className="bubbleNote">{m.note}</div> : null}
                          {m.sources && m.sources.length > 0 ? (
                            <SourcesPill sources={m.sources} />
                          ) : null}
                        </div>
                      ) : null}
                      {m.ts ? (
                        <span className="msgTs">
                          {new Date(m.ts).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : null}
                    </>
                  )}
                  {/* The two buttons under a message, from wove's two rows: `rowA`
                      (1642) is Copy then Read aloud under a reply, `rowU` (1643) is
                      Copy then Edit under your own. Copy is on both, because both
                      are text you might want elsewhere; Edit is only on yours,
                      because a reply is not something you can rewrite. The tick
                      replacing the copy icon for a moment is wove's receipt too
                      (1704), and it is the only one: it says it happened without
                      covering the words that were copied.

                      No row while a reply is still arriving, and none while the box
                      is open: the buttons belong to a message, and mid-stream there
                      is no message yet — just the dots — and mid-edit the message is
                      the box. */}
                  {!m.streaming && m.text && editing?.id !== m.id ? (
                    <div className="mrow">
                      <button
                        className={`mrowBtn${copied === m.id ? ' ok' : ''}`}
                        onClick={() => copy(m.text, m.id)}
                        aria-label="Copy"
                        title="Copy"
                      >
                        <Icon name={copied === m.id ? 'tick' : 'cp'} />
                      </button>
                      {m.role === 'eumae' ? (
                        <button
                          className="mrowBtn"
                          onClick={() => speak(m.text, notify)}
                          aria-label="Read aloud"
                          title="Read aloud"
                        >
                          <Icon name="spk" />
                        </button>
                      ) : (
                        <button
                          className="mrowBtn"
                          onClick={() => startEdit(m)}
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Icon name="ed" />
                        </button>
                      )}
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

      {viewing && (
        <ImageViewer url={viewing.url} alt={viewing.alt} onClose={() => setViewing(null)} />
      )}

    </div>
  );
}
