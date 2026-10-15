import { useMemo, useState } from 'react';
import { useNav } from '../nav';
import {
  COURSES, COURSE_ORDER, CONTINUE, SECTIONS, SECTION_ORDER,
  TUTORIALS, DIGEST,
  courseProgress, isLessonDone, markLessonDone, quizRight,
} from '../classroom';
import { getGuild } from '../guild';
import { queueBrief } from '../studio';
import { Icon } from '../components/shell/icons';

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
  const { notify, goTab } = useNav();
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
      />
    );
  }
  if (sel.kind === 'tutorial') {
    return <TutorialView name={sel.name} onBack={() => setSel({ kind: 'root' })} toChat={toChat} />;
  }
  if (sel.kind === 'section') {
    return (
      <SectionView
        name={sel.name}
        onBack={() => setSel({ kind: 'root' })}
        onOpenCourse={(n) => setSel({ kind: 'course', name: n })}
        onOpenTutorial={(n) => setSel({ kind: 'tutorial', name: n })}
        notify={notify}
        toChat={toChat}
      />
    );
  }
  return (
    <ClassroomRoot
      assigned={assigned}
      onCourse={(n) => setSel({ kind: 'course', name: n })}
      onTutorial={(n) => setSel({ kind: 'tutorial', name: n })}
      onSection={(n) => setSel({ kind: 'section', name: n })}
      notify={notify}
      toChat={toChat}
    />
  );
}

function ClassroomRoot({ assigned, onCourse, onTutorial, onSection, notify, toChat }: {
  assigned: { t: string; who: string; pct: number; mine: number }[];
  onCourse: (n: string) => void; onTutorial: (n: string) => void; onSection: (n: string) => void;
  notify: (m: string) => void; toChat: (brief: string) => void;
}) {
  const cont = courseProgress(CONTINUE.course);
  const toYou = assigned.filter((a) => a.mine);
  return (
    <div>
      <div className="screenT">Classroom</div>
      <div className="s m">Learn it here - or ask in Chat and keep going.</div>
      {/* Hero: continue where you left off. */}
      <div className="card">
        <div className="big">{toYou.length + 1}<small>lesson{toYou.length ? 's' : ''} to continue</small></div>
        <div className="s" style={{ marginTop: 4 }}>{CONTINUE.course} · {CONTINUE.lesson}</div>
        <div className="bar"><i style={{ width: cont + '%' }} /></div>
        <div className="btns">
          <button className="pri" onClick={() => onCourse(CONTINUE.course)}>Resume</button>
          <button className="gho" onClick={() => toChat('Continue my ' + CONTINUE.course + ' lesson')}>Continue in Chat</button>
        </div>
      </div>
      {/* Mirror + nudge. */}
      <div className="card">
        <div className="wt"><Icon name="zap" /><span>Eumae noticed</span></div>
        <div className="s" style={{ marginTop: 4 }}><b>Mirror:</b> lessons stick when they are under ten minutes. <b>Nudge:</b> Lesson 5 is eight minutes - do it before training?</div>
      </div>
      <h3 className="sec">Courses</h3>
      {COURSE_ORDER.filter((n) => n !== CONTINUE.course).map((n) => (
        <CourseCard key={n} name={n} sub={courseSub(n)} onOpen={() => onCourse(n)} />
      ))}
      <h3 className="sec">Training</h3>
      {toYou.length ? toYou.map((a) => (
        <div key={a.t} className="cxcard">
          <div className="row"><div className="g"><b>{a.t}</b><div className="xs m">Training · assigned to you · {a.pct}%</div></div></div>
          <div className="bar"><i style={{ width: a.pct + '%' }} /></div>
          <div className="btns">
            <button className="pri" onClick={() => notify('Training ' + a.t + ' opens here once its course ships.')}>Resume training</button>
          </div>
        </div>
      )) : <div className="s m">Nothing assigned to you.</div>}
      <h3 className="sec">Digest</h3>
      {DIGEST.map((d) => (
        <DigestRow key={d.t} title={d.t} kind={d.k} detail={d.d} />
      ))}
      <h3 className="sec">App tutorials</h3>
      <div className="card cardPad">
        {['Using Chat', 'Using Studio', 'Using Guild'].map((t) => (
          <div key={t} className="li">
            <div className="g s">{t}</div>
            <button className="fb" onClick={() => onTutorial(t)}>Open</button>
          </div>
        ))}
      </div>
      <div className="btns">
        {SECTION_ORDER.map((s) => (
          <button key={s} className="gho" onClick={() => onSection(s)}>{s}</button>
        ))}
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
    <div className="cxcard">
      <div className="row"><div className="g"><b>{name}</b><div className="xs m">{sub}</div></div><span className="tag">{p}%</span></div>
      <div className="bar"><i style={{ width: p + '%' }} /></div>
      <div className="btns">
        <button className="pri" onClick={onOpen}>Open course</button>
      </div>
    </div>
  );
}

function DigestRow({ title, kind, detail }: { title: string; kind: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cxcard">
      <div className="row">
        <div className="fi">{kind}</div>
        <div className="g"><div>{title}</div><div className="xs m">{detail}</div></div>
        <button className="fb" onClick={() => setOpen((v) => !v)}>Distill</button>
      </div>
      {open ? (
        <div className="s" style={{ marginTop: 8 }}>
          <b>Distilled:</b>
          <ul className="st">
            <li>Main argument in one line</li>
            <li>Two tactics worth stealing</li>
            <li>One thing to ignore</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CourseView({ name, onBack, notify, toChat, refresh }: {
  name: string; onBack: () => void;
  notify: (m: string) => void; toChat: (brief: string) => void; refresh: () => void;
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
            <button
              key={l.t}
              className="sr"
              onClick={() => { markLessonDone(name, l.t); refresh(); }}
            >
              <span className="g">{l.t}</span>
              {done ? <span className="v">done</span> : null}
              <span className="ch">›</span>
            </button>
          );
        })}
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
      <div className="btns">
        <button className="gho" onClick={() => toChat('Continue my ' + name + ' lesson')}>Continue in Chat</button>
      </div>
    </div>
  );
}

function TutorialView({ name, onBack, toChat }: {
  name: string; onBack: () => void; toChat: (brief: string) => void;
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
      <div className="btns">
        <button className="pri" onClick={() => toChat('Teach me: ' + name)}>Learn it in Chat</button>
      </div>
    </div>
  );
}

function SectionView({ name, onBack, onOpenCourse, onOpenTutorial, notify, toChat }: {
  name: string; onBack: () => void;
  onOpenCourse: (n: string) => void; onOpenTutorial: (n: string) => void;
  notify: (m: string) => void; toChat: (brief: string) => void;
}) {
  const sec = SECTIONS[name];
  const [distilled, setDistilled] = useState(false);
  if (!sec) { onBack(); return null; }
  const openRow = (row: string) => {
    if (name === 'Courses') {
      const hit = COURSE_ORDER.find((c) => row.startsWith(c));
      if (hit) { onOpenCourse(hit); return; }
    }
    if (name === 'App tutorials') { onOpenTutorial(row); return; }
    if (name === 'Training') { notify('Assigning happens in Guild.'); return; }
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
        <div className="card">
          <input placeholder="Paste a link, or upload a video or book" aria-label="Paste a link, or upload a video or book" />
          <div className="btns">
            <button className="pri" onClick={() => setDistilled(true)}>Distill</button>
          </div>
          {distilled ? (
            <div style={{ marginTop: 10 }}>
              <b>Distilled:</b>
              <ul className="st">
                <li>Main argument in one line</li>
                <li>Two tactics worth stealing</li>
                <li>One thing to ignore</li>
              </ul>
              <div className="btns">
                <button className="gho" onClick={() => notify('Saved to Digest')}>Save</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <h3 className="sec">Yours</h3>
      {sec.yours.map((row) => (
        <div key={row} className="cxcard">
          <div className="row">
            <div className="g"><b>{row}</b></div>
            <button className="fb" onClick={() => openRow(row)}>Open</button>
          </div>
        </div>
      ))}
      {sec.discover.length ? (
        <>
          <h3 className="sec">Discover</h3>
          {sec.discover.map((row) => (
            <div key={row} className="cxcard">
              <div className="row">
                <div className="g"><b>{row}</b></div>
                <button className="fb" onClick={() => openRow(row)}>Open</button>
              </div>
            </div>
          ))}
        </>
      ) : null}
      {sec.create ? (
        <div className="btns">
          <button className="gho" onClick={() => notify(sec.create + ' starts in Studio. Only drafts exist there so far.')}>{sec.create}</button>
        </div>
      ) : null}
    </div>
  );
}
