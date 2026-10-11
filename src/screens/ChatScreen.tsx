import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Composer from '../components/shell/Composer';
import { Icon } from '../components/shell/icons';
import { useNav, type Mode } from '../nav';
import { logEv } from '../log';
import { streamChat } from '../chat';
import { endVoiceReply, feedVoiceReply, speak, startVoiceReply } from '../voice';
import { buildRequest, toApiBody } from '../request';
import { getThread, saveThread, titleFor, type Msg } from '../threads';
import { messagesFor, bootSnapshot, msgId } from '../boot';
import { uploadData } from '../uploads';
import { renderMd } from '../md';

/* A photo inside a saved message. The message carries the upload id (§4.15);
 * the bytes are looked up here, at render time. A message saved before the
 * pointer change carries the data URL itself (`url`) and renders straight
 * from it — no migration, no wipe. While the lookup runs, nothing renders:
 * a broken-image icon is worse than a beat of empty. */
function MsgImage({
  label,
  uploadId,
  url,
  onView,
}: {
  label: string;
  uploadId?: string;
  url?: string;
  onView: (url: string, alt: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(url ?? null);
  useEffect(() => {
    if (url) {
      setSrc(url);
      return;
    }
    if (!uploadId) return;
    let live = true;
    uploadData(uploadId).then((u) => {
      if (live && u) setSrc(u);
    });
    return () => {
      live = false;
    };
  }, [uploadId, url]);
  if (!src) return null;
  return (
    <button
      className="msgAttachBtn"
      onClick={() => onView(src, label)}
      aria-label={`View ${label} full screen`}
    >
      <img className="msgAttachImg" src={src} alt={label} />
    </button>
  );
}


const SUGGESTIONS = ['Plan my day', 'Summarize my week', 'Draft a proposal', 'What am I forgetting?'];

/* An AI reply, rendered through markdown once it has landed. While words
 *  are still arriving the raw text shows — formatting half a reply flickers
 *  (`**half` with no close). Your own messages stay plain: if you type `**`
 *  it stays literal. Memoized per message text so a stream of pieces does
 *  not re-render every bubble on every chunk. */
function ReplyText({ text, streaming }: { text: string; streaming?: boolean }) {
  const html = useMemo(() => (streaming ? null : renderMd(text)), [text, streaming]);
  if (html === null) return <>{text}</>;
  return <span className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* Message IDs come from a counter, not the clock. Two sends in the same
   millisecond used to collide — Date.now() is not an ID. The counter lives
   in boot.ts next to the snapshot; reloads seed it above the highest saved
   ID so they never collide. */
function bootMountMessages(threadId: string | null): Msg[] {
  if (!threadId) return [];
  const snap = bootSnapshot();
  if (snap && snap.threadId === threadId) return snap.messages;
  return messagesFor(threadId);
}

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
  /* Mount messages come from the same boot that App read: on the boot thread
     the snapshot already holds them (no second storage read, no welcome
     flash, no render-phase setState). On any other thread — impossible on
     mount today since App always boots the open one — fall back to the same
     `messagesFor` every switch uses. The effect below handles *switches*
     only (thread A → thread B), which is what effects are for. */
  const [msgs, setMsgs] = useState<Msg[]>(() => bootMountMessages(threadId));
  const [loadedId, setLoadedId] = useState(threadId);

  /* Replies in flight. A ref rather than state because the only reader is the
     mic's guard, which is called from a speech event and not from a render
     (`VoiceTyping.busy`, voice.ts:55) — and because a counter in state would
     re-render the whole thread on every frame of a stream. */
  const inFlight = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  /* Whether the newest line is in view. The scroll button answers exactly
     this: shown when you have gone back to read, hidden at the bottom where
     it would cover the reply for no reason. A reader, not a writer — nothing
     here scrolls, it only reports. */
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const markAtBottom = useCallback((v: boolean) => {
    atBottomRef.current = v;
    setAtBottom(v);
  }, []);

  /* One read of the scroller's position: within a line of the floor counts as
     the floor, because sub-pixel rounding otherwise flickers the button on
     phones that land a hair above it. */
  const readBottom = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    markAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  }, [markAtBottom]);

  /* Jumping down is a user act: it re-pins the follow, so the stream resumes
     carrying the view. */
  const jumpToLatest = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    markAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [markAtBottom]);

  useEffect(() => {
    if (loadedId === threadId) return;
    setLoadedId(threadId);
    /* A switch is a deliberate jump to the newest line — re-pin the follow
       and put the view at the floor in the same breath, so no stale position
       from thread A leaks into thread B. */
    markAtBottom(true);
    setMsgs(messagesFor(threadId));
  }, [threadId, loadedId, markAtBottom]);
  const [viewing, setViewing] = useState<{ url: string; alt: string } | null>(null);
  /* The box open over a message, so its height can follow what is in it
     (below). Only one message is ever being edited, so one ref is enough. */
  const editRef = useRef<HTMLTextAreaElement>(null);
  /* Which message is being rewritten, and what is in the box. One at a time, and
     `null` for none — wove keeps the same single `EDITSTATE` (1711). */
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);

  /* Save the thread when a reply completes — not per chunk. Streaming used
     to rewrite all of storage on every piece of the reply. The messages stay
     in state while they stream; storage catches up when the reply lands.
     Pointers only (§4.15): `body` (the full API request, base64 inside) and
     `url` (the data URL) are stripped before writing — a photo-heavy chat
     would otherwise fill the ~5MB localStorage box and silently stop sticking.
     What survives is the upload id; bytes are re-looked-up with uploadData()
     when the thread renders. Old threads that already carry `url` still render. */
  const saveNow = (messages: Msg[]) => {
    if (!threadId) return;
    const thread = getThread(threadId);
    if (!thread) return;
    const stripped: Msg[] = messages.map((m) => {
      if (!m.attachments && !m.body) return m;
      const { body: _body, ...rest } = m;
      void _body;
      return {
        ...rest,
        ...(rest.attachments
          ? {
              attachments: rest.attachments.map((a) => {
                const { url: _url, ...kept } = a;
                void _url;
                return kept;
              }),
            }
          : null),
      };
    });
    saveThread({ ...thread, messages: stripped });
  };
  /* The id whose Copy just worked, so that button can be a tick for a moment
     (wove swaps the icon the same way, 1704). Zero is no message: ids are
     `Date.now()`, so no real one is ever 0. */
  const [copied, setCopied] = useState(0);

  /* Keep the newest line in view as pieces land. The mockup scrolls its thread
     the same way (1882); the trigger here is the thread itself, since a piece of
     the reply arriving *is* a render. Conditional: arriving pieces carry the
     view down only while you are at the bottom — the moment you scroll up to
     read, the stream stops pulling and the down-button appears instead. New
     sends and thread switches re-pin (both are deliberate jumps to the
     newest line). */
  useEffect(() => {
    if (!atBottomRef.current) return;
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

    /* Two ids from one counter — the turn, and the reply it is
       waiting for — so the reply can still be found in the list while pieces of
       it are arriving and the list is being appended to. */
    const id = msgId();
    const replyId = msgId();
    const now = Date.now();
    const isFirst = msgs.length === 0;
    setMsgs((m) => {
      const next: Msg[] = [
        ...m,
        // Pointers only (§4.15): the upload id survives in storage, the data URL
        // does not — saveNow strips `body` and `url` before writing. Bytes are
        // looked up with uploadData() at send-time (above, via refs) and at
        // render-time (below, via uploadId).
        { id, role: 'you', text, attachments: refs.map((r) => ({ label: r.label, icon: r.icon, uploadId: r.uploadId, url: r.url })), ts: now },
        { id: replyId, role: 'eumae', text: '', streaming: true, ts: now },
      ];
      saveNow(next);
      return next;
    });
    /* Title the thread from the first user message. Outside the updater —
       updaters must stay pure. */
    if (isFirst && threadId && text.trim()) {
      const thread = getThread(threadId);
      if (thread) saveThread({ ...thread, title: titleFor(text) });
    }
    /* Your own send re-pins the follow: you wrote it, you mean the newest. */
    markAtBottom(true);
    /* Attachments belong to the message that carried them. The composer clears;
       the message keeps them. */
    clearRefs();

    /* The clip is the opening of it: a log row is a sentence, not a transcript.
       Where the mic sent it the row says so — the same flag the mockup reads
       back to have the answer spoken aloud (1857 → 1902). */
    /* No log for the message itself — the thread is the record. The log
       keeps actions: searches, tools, saves. */

    inFlight.current += 1;
    /* A voice send reads its own reply aloud as it streams: the first complete
       sentence starts speaking about a second after it is complete, while the
       rest is still arriving — instead of waiting for the whole reply. */
    const voiceId = byVoice ? startVoiceReply(notify) : 0;
    /* The counter always comes back down, even if the reply path throws
       between increment and resolve: a stuck counter reads as a reply
       forever in flight, and the mic refuses until reload. */
    const streamDone = () => {
      inFlight.current = Math.max(0, inFlight.current - 1);
    };
    void streamChat(body, (full) => {
      /* The whole text so far, not the new piece: replacing what the bubble shows
         is the only way two pieces arriving out of order could not show up as a
         sentence in the wrong order. The dots go away with the first piece, which
         is this same update. */
      setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, text: full } : x)));
      if (byVoice) feedVoiceReply(voiceId, full);
    }).then((reply) => {
      streamDone();
      setMsgs((m) => {
        const next = m.map((x) =>
          x.id === replyId
            ? { ...x, streaming: false, text: reply.text, note: reply.error ?? undefined, sources: reply.sources }
            : x,
        );
        saveNow(next);
        return next;
      });

      /* The reply is the other half of what happened, so it is logged the same way
         the message was — one row per event, with its own dot when it went badly
         (`LogStatus`, log.ts:18), so Logs shows a failed ask without having to
         read the sentence. */
      if (!reply.ok) {
        logEv({ area: 'Chat', text: `No reply: ${reply.error}`, status: 'bad' });
      }
      /* Search grounded this reply — an action worth a row. The query is the
         useful part, not the answer text. */
      if (reply.ok && reply.sources && reply.sources.length > 0) {
        logEv({ area: 'Chat', text: `Searched: ${reply.sources.length} source${reply.sources.length === 1 ? '' : 's'}` });
      }

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
    /* Close the full-screen photo first: sending behind the viewer is how a
       send looks like it failed and gets sent twice. */
    setViewing(null);
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
    saveNow(kept);
    send(text, false, kept);
  };

  /** Ask again for the same thing — one small icon under a reply, nothing
   *  else. The last user message goes out again as a fresh send (same text,
   *  photo looked up again by id), so regen on a photo thread still carries
   *  the photo. Not while a reply is arriving. */
  const regen = () => {
    if (inFlight.current > 0) {
      notify('Wait for the reply to finish.');
      return;
    }
    let at = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'you') {
        at = i;
        break;
      }
    }
    if (at < 0) return;
    const kept = msgs.slice(0, at);
    setMsgs(kept);
    saveNow(kept);
    send(msgs[at].text, false, kept);
  };

  return (
    <div className="chat">
      <div className="chatScroll" ref={scroller} onScroll={readBottom}>
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
                          below, the way every chat app does it. A saved message
                          carries the upload id (§4.15); MsgImage resolves the
                          bytes, or renders the carried url for older threads. */}
                      {m.attachments && m.attachments.some((a) => a.icon === 'img' && (a.url || a.uploadId)) ? (
                        <div className="msgImgs">
                          {m.attachments
                            .filter((a) => a.icon === 'img' && (a.url || a.uploadId))
                            .map((a) => (
                              <MsgImage
                                key={a.uploadId ?? a.label}
                                label={a.label}
                                uploadId={a.uploadId}
                                url={a.url}
                                onView={(url, alt) => setViewing({ url, alt })}
                              />
                            ))}
                        </div>
                      ) : null}
                      {(m.text ||
                        (m.attachments && m.attachments.some((a) => !(a.icon === 'img' && (a.url || a.uploadId)))) ||
                        m.note ||
                        (m.sources && m.sources.length > 0)) ? (
                        <div className="bubble">
                          {m.attachments && m.attachments.some((a) => !(a.icon === 'img' && (a.url || a.uploadId))) ? (
                            <div className="msgAttaches">
                              {m.attachments
                                .filter((a) => !(a.icon === 'img' && (a.url || a.uploadId)))
                                .map((a) => (
                                  <div key={a.uploadId ?? a.label} className="msgAttach">
                                    <span className="msgAttachName">{a.label}</span>
                                  </div>
                                ))}
                            </div>
                          ) : null}
                          {m.role === 'eumae' && m.text ? (
                            <ReplyText text={m.text} streaming={m.streaming} />
                          ) : (
                            m.text
                          )}
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
                        <>
                          <button
                            className="mrowBtn spk"
                            onClick={() => speak(m.text, notify)}
                            aria-label="Read aloud"
                            title="Read aloud"
                          >
                            <Icon name="spk" />
                          </button>
                          <button
                            className="mrowBtn"
                            onClick={regen}
                            aria-label="Regenerate reply"
                            title="Regenerate reply"
                          >
                            <Icon name="rgn" />
                          </button>
                        </>
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
        {/* Down to the newest line. Shows only when you have left the bottom —
            at the floor it would cover the reply for no reason. Jumping is a
            user act, so it re-pins the follow and the stream resumes carrying
            the view. No pill, no count: the mockup's shape is one arrow. */}
        {!atBottom && (
          <button className="chatDown" onClick={jumpToLatest} aria-label="Scroll to latest" title="Scroll to latest">
            <Icon name="dn" />
          </button>
        )}
      </div>

      {viewing && (
        <ImageViewer url={viewing.url} alt={viewing.alt} onClose={() => setViewing(null)} />
      )}

    </div>
  );
}
