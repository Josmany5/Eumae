import { useMemo, useState } from 'react';
import { useNav } from '../nav';
import {
  COURSES, COURSE_ORDER, CONTINUE, SECTIONS,
  TUTORIALS, DIGEST,
  courseProgress, isLessonDone, markLessonDone, quizRight,
} from '../classroom';
import { getGuild } from '../guild';
import { queueBrief } from '../studio';
import { Icon } from '../components/shell/icons';
import { ItemMenu } from '../components/ItemMenu';

/* The Classroom - the mockup's latest rCx layer, rebuilt as React.
 *
 * Root: hero continue card (Spanish L5, Resume + Continue-in-Chat) +
 * mirror/nudge + Courses + Training (assigned rows from guild.assigned) +
 * Digest rows with inline Distill + App tutorials. Course view: progress
 * header + lessons (tap marks done) + Quick-check quiz (right/wrong marks
 * like the mockup's qA). Tutorial view: TUT12 steps + Learn-in-Chat.
 * Section view: CX8 blurb + yours + discover rows. Chat handoffs queue a
 * brief, same as Studio.
 */

type CxSel =
  | { kind: 'root' }
  | { kind: 'course'; name: string }
  | { kind: 'tutorial'; name: string }
  | { kind: 'section'; name: string };

export default function ClassroomScreen() {
  const { notify, go, goTab } = useNav();
  const [sel, setSel] = useState<CxSel>({ kind: 'root' });
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const guild = useMemo(() => getGuild(), [tick]);
  const assigned = guild.assigned;

  const toChat = (brief: string) => {
    queueBrief(brief);
    goTab('chat');
  };

  if (sel.kind === 'course') {
    return (
      <CourseView
        name={sel.name}
        onBack={() => { setSel({ kind: 'root' }); refresh(); }}
        notify={notify}
        toChat={toChat}
        refresh={refresh}
        onOpenFull={(n) => go('course', n)}
      />
    );
  }
  if (sel.kind === 'tutorial') {
    return <TutorialView name={sel.name} onBack={() => setSel({ kind: 'root' })} onOpenFull={(n) => go('tut', n)} />;
  }
  if (sel.kind === 'section') {
    return (
      <SectionView
        name={sel.name}
        onBack={() => setSel({ kind: 'root' })}
        onOpenCourse={(n) => setSel({ kind: 'course', name: n })}
        onOpenTutorial={(n) => setSel({ kind: 'tutorial', name: n })}
        toChat={toChat}
        onOpenFull={(n) => go('cxsec', n)}
      />
    );
  }
  return (
    <ClassroomRoot
      assigned={assigned}
      onCourse={(n) => setSel({ kind: 'course', name: n })}
      onTutorial={(n) => setSel({ kind: 'tutorial', name: n })}
      toChat={toChat}
    />
  );
}

function ClassroomRoot({ assigned, onCourse, onTutorial, toChat }: {
  assigned: { t: string; who: string; pct: number; mine: number }[];
  onCourse: (n: string) => void; onTutorial: (n: string) => void;
  toChat: (brief: string) => void;
}) {
  const [want, setWant] = useState('');
  const createCourse = () => {
    const v = want.trim();
    if (!v) return;
    setWant('');
    toChat(`Create a course for me: ${v}`);
  };
  const toYou = assigned.filter((a) => a.mine);
  /* Overall progress across every course — lessons done over lessons total. */
  const totals = COURSE_ORDER.reduce(
    (acc, n) => {
      const c = COURSES[n];
      if (!c) return acc;
      return {
        total: acc.total + c.les.length,
        done: acc.done + c.les.filter((l) => isLessonDone(n, l.t)).length,
      };
    },
    { total: 0, done: 0 },
  );
  const overall = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  return (
    <div>
      <div className="screenT dupT">Classroom</div>
      <div className="s m">Learn it here, in class.</div>
      {/* Hero: overall progress + continue where you left off. The whole
          card is the tap — the dashboard style has no button bar. */}
      <div className="card" role="button" style={{ cursor: 'pointer' }} onClick={() => onCourse(CONTINUE.course)}>
        <div className="row">
          <div className="ringC" style={{ background: `conic-gradient(var(--ac) ${overall}%, var(--card2) ${overall}%)` }}>
            <i>{overall}%</i>
          </div>
          <div className="g">
            <b>Keep going — {CONTINUE.course}</b>
            <div className="s m" style={{ marginTop: 2 }}>{CONTINUE.lesson}</div>
            <div className="xs m" style={{ marginTop: 2 }}>{totals.done} of {totals.total} lessons done</div>
          </div>
          <span className="ch">›</span>
        </div>
      </div>
      {/* Create a course — Console's quick-add shape: one pill field, one
          round button. The words can name any of the four ways in. */}
      <div className="qaBar" style={{ margin: '12px 0 4px' }}>
        <input
          className="qaIn"
          placeholder="Turn something into a course…"
          aria-label="Turn something into a course"
          value={want}
          onChange={(e) => setWant(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createCourse(); }}
        />
        <button className="qaSend" onClick={createCourse} disabled={!want.trim()} aria-label="Create course">
          <Icon name="up" />
        </button>
      </div>
      <div className="xs m">Describe it — or say “from this link”, “from my notes”, or “from scratch”.</div>
      <div className="cxChips">
        <span className="cxChip">{COURSE_ORDER.length} courses</span>
        <span className="cxChip">{totals.done} of {totals.total} lessons done</span>
        <span className="cxChip">{toYou.length} assigned to you</span>
        <span className="cxChip">{DIGEST.length} in the Digest</span>
      </div>
      <h3 className="sec">Courses</h3>
      <div className="cxGrid">
      {COURSE_ORDER.map((n) => (
        <CourseCard key={n} name={n} sub={courseSub(n)} onOpen={() => onCourse(n)} />
      ))}
      </div>
      <h3 className="sec">Training</h3>
      {toYou.length ? toYou.map((a) => (
        <div
          key={a.t}
          className="cxcard"
          role="button"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            const hit = COURSE_ORDER.find((c) => a.t.toLowerCase().includes(c.toLowerCase()));
            if (hit) onCourse(hit);
            else toChat(`Continue my ${a.t} training`);
          }}
        >
          <div className="row"><div className="g"><b>{a.t}</b><div className="xs m">Training · assigned to you · {a.pct}%</div></div><span className="ch">›</span></div>
          <div className="bar"><i style={{ width: a.pct + '%' }} /></div>
        </div>
      )) : <div className="s m">Nothing assigned to you.</div>}
      <h3 className="sec">Digest</h3>
      <div className="card cardPad">
        {DIGEST.map((d) => (
          <DigestRow key={d.t} title={d.t} kind={d.k === 'VID' ? 'Video' : 'Link'} detail={d.d} toChat={toChat} />
        ))}
      </div>
      <h3 className="sec">Eumae tutorials &amp; best practices</h3>
      <div className="card cardPad">
        {Object.keys(TUTORIALS).map((t) => (
          <button key={t} className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => onTutorial(t)}>
            <span className="g s">{t}</span>
            <span className="ch">›</span>
          </button>
        ))}
        <button className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => toChat('Teach me the best practices for using Eumae well')}>
          <span className="g s">Best practices</span>
          <span className="xs m">Ask Eumae</span>
          <span className="ch">›</span>
        </button>
      </div>
    </div>
  );
}

function courseSub(name: string): string {
  const c = COURSES[name];
  if (!c) return 'Course';
  const next = c.les.find((l) => !isLessonDone(name, l.t));
  return next ? next.t : 'Complete';
}

function CourseCard({ name, sub, onOpen }: { name: string; sub: string; onOpen: () => void }) {
  const p = courseProgress(name);
  return (
    <div className="cxcard" role="button" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <div className="row"><div className="g"><b>{name}</b><div className="xs m">{sub}</div></div><span className="tag">{p}%</span></div>
      <div className="bar"><i style={{ width: p + '%' }} /></div>
    </div>
  );
}

/* A Digest row hands the item to Chat for the distilling itself — the row
   is the tap, no Distill button. It used to unfold three canned bullets
   that were the same for every title (invented data). */
function DigestRow({ title, kind, detail, toChat }: { title: string; kind: string; detail: string; toChat: (brief: string) => void }) {
  return (
    <button
      className="li"
      style={{ width: '100%', textAlign: 'left' }}
      onClick={() => toChat(`Distill "${title}" into its main argument, the tactics worth stealing, and what to ignore`)}
    >
      <span className="fi">{kind}</span>
      <span className="g"><span>{title}</span><span className="xs m" style={{ display: 'block' }}>{detail}</span></span>
      <span className="xs m">Distill</span>
      <span className="ch">›</span>
    </button>
  );
}

function CourseView({ name, onBack, notify, toChat, refresh, onOpenFull }: {
  name: string; onBack: () => void;
  notify: (m: string) => void; toChat: (brief: string) => void; refresh: () => void;
  onOpenFull: (n: string) => void;
}) {
  const c = COURSES[name];
  const [picked, setPicked] = useState<string | null>(null);
  if (!c) { onBack(); return null; }
  const p = courseProgress(name);
  const answer = (choice: string) => {
    setPicked(choice);
    if (choice === quizRight(name)) notify('Correct');
  };
  return (
    <div>
      <div className="backbar">
        <button className="hb" onClick={onBack} aria-label="Back">
          <Icon name="bk" />
        </button>
        <div className="tt">{name}</div>
        <div className="bbsp" />
      </div>
      <div className="card">
        <div className="row">
          <div className="g"><b>{name}</b><div className="xs m">Course · in progress</div></div>
          <span className="tag">{p}%</span>
        </div>
        <div className="bar"><i style={{ width: p + '%' }} /></div>
      </div>
      <h3 className="sec">Lessons</h3>
      <div className="card cardPad">
        {c.les.map((l) => {
          const done = isLessonDone(name, l.t);
          return (
            <div key={l.t} className="li">
              <button
                className={'ck' + (done ? ' d' : '')}
                aria-label={done ? `${l.t} done` : `Mark ${l.t} done`}
                onClick={() => { if (!done) { markLessonDone(name, l.t); refresh(); } }}
              />
              <span className="g">
                {l.t}
                {done ? <div className="xs m">done</div> : null}
              </span>
              <ItemMenu
                name={l.t}
                extra={done ? undefined : [{ label: 'Mark done', onClick: () => { markLessonDone(name, l.t); refresh(); } }]}
              />
            </div>
          );
        })}
      </div>
      <div className="card cardPad">
        <button className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => toChat(`Make a quiz from my ${name} course`)}>
          <span className="g s">Make a quiz from this course</span>
          <span className="ch">›</span>
        </button>
        <button className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => toChat(`Make a set of flashcards from my ${name} course`)}>
          <span className="g s">Make flashcards from this course</span>
          <span className="ch">›</span>
        </button>
      </div>
      <div className="card">
        <b>Quick check</b>
        <div className="qz">
          <div className="s" style={{ margin: '8px 0' }}>{c.q.q}</div>
          {[c.q.right, c.q.wrong].map((choice) => (
            <button
              key={choice}
              className={picked === null ? '' : picked === choice ? (choice === c.q.right ? 'right' : 'wrong') : ''}
              onClick={() => answer(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
      <div className="card cardPad">
        <button className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenFull(name)}>
          <span className="g s">Open full page</span>
          <span className="ch">›</span>
        </button>
      </div>
    </div>
  );
}

function TutorialView({ name, onBack, onOpenFull }: {
  name: string; onBack: () => void;
  onOpenFull: (n: string) => void;
}) {
  const steps = TUTORIALS[name] || ['Open it from the Classroom tab.', 'Everything here is reference — no progress, no pressure.'];
  return (
    <div>
      <div className="backbar">
        <button className="hb" onClick={onBack} aria-label="Back">
          <Icon name="bk" />
        </button>
        <div className="tt">{name}</div>
        <div className="bbsp" />
      </div>
      <div className="card">
        <b>{name}</b>
        {steps.map((s, i) => (
          <div key={s} className="hi" style={{ marginTop: 10 }}>
            <span className="dt ok" />
            <div className="s"><b>Step {i + 1}.</b> {s}</div>
          </div>
        ))}
      </div>
      <div className="card cardPad">
        <button className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenFull(name)}>
          <span className="g s">Open full page</span>
          <span className="ch">›</span>
        </button>
      </div>
    </div>
  );
}

function SectionView({ name, onBack, onOpenCourse, onOpenTutorial, toChat, onOpenFull }: {
  name: string; onBack: () => void;
  onOpenCourse: (n: string) => void; onOpenTutorial: (n: string) => void;
  toChat: (brief: string) => void;
  onOpenFull: (n: string) => void;
}) {
  const sec = SECTIONS[name];
  const [link, setLink] = useState('');
  if (!sec) { onBack(); return null; }
  const openRow = (row: string) => {
    if (name === 'Courses') {
      const hit = COURSE_ORDER.find((c) => row.startsWith(c));
      if (hit) { onOpenCourse(hit); return; }
    }
    if (name === 'App tutorials') { onOpenTutorial(row); return; }
    if (name === 'Training') {
      const courseHit = COURSE_ORDER.find((c) => row.toLowerCase().includes(c.toLowerCase()));
      if (courseHit) {
        onOpenCourse(courseHit);
        return;
      }
      toChat('Continue my ' + row + ' training');
      return;
    }
    toChat('Preview: ' + row);
  };
  return (
    <div>
      <div className="backbar">
        <button className="hb" onClick={onBack} aria-label="Back">
          <Icon name="bk" />
        </button>
        <div className="tt">{name}</div>
        <div className="bbsp" />
      </div>
      <div className="card"><div className="s">{sec.blurb}</div></div>
      {name === 'Digest' ? (
        /* Distill used to print three canned bullets ("Main argument in one
           line") no matter what was pasted, which is invented data. Now it
           hands the real link to Chat, where Eumae actually reads it. The
           field is Console's quick-add shape: one pill, one round button. */
        <div className="qaBar" style={{ margin: '12px 0 4px' }}>
          <input
            className="qaIn"
            placeholder="Paste a link to distill…"
            aria-label="Paste a link to distill"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && link.trim()) toChat(`Distill this into its main argument, the tactics worth stealing, and what to ignore: ${link.trim()}`); }}
          />
          <button
            className="qaSend"
            disabled={!link.trim()}
            aria-label="Distill in Chat"
            onClick={() => toChat(`Distill this into its main argument, the tactics worth stealing, and what to ignore: ${link.trim()}`)}
          >
            <Icon name="up" />
          </button>
        </div>
      ) : null}
      <h3 className="sec">Yours</h3>
      <div className="card cardPad">
        {sec.yours.map((row) => (
          <button key={row} className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => openRow(row)}>
            <span className="g"><b>{row}</b></span>
            <span className="ch">›</span>
          </button>
        ))}
      </div>
      {sec.discover.length ? (
        <>
          <h3 className="sec">Discover</h3>
          <div className="card cardPad">
            {sec.discover.map((row) => (
              <button key={row} className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => openRow(row)}>
                <span className="g"><b>{row}</b></span>
                <span className="ch">›</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
      <div className="card cardPad">
        {sec.create ? (
          <button className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => toChat(sec.create + ': ')}>
            <span className="g s">{sec.create}</span>
            <span className="ch">›</span>
          </button>
        ) : null}
        <button className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenFull(name)}>
          <span className="g s">Open full page</span>
          <span className="ch">›</span>
        </button>
      </div>
    </div>
  );
}
