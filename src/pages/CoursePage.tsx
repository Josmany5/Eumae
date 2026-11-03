/* Classroom course — the CourseView extracted to PAGES so rail rows can
 * push it (arg = course name). Lessons tap-to-done, Quick-check quiz,
 * Continue-in-Chat via brief queue. */

import { useState } from 'react';
import { useNav } from '../nav';
import { COURSES, courseProgress, isLessonDone, markLessonDone, quizRight } from '../classroom';
import { queueBrief } from '../studio';
import { ItemMenu } from '../components/ItemMenu';
import type { PageProps } from './index';

export default function CoursePage({ arg }: PageProps) {
  const { notify, goTab } = useNav();
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const refresh = () => {
    setTick((t) => t + 1);
    setPicked(null);
  };
  void tick;

  const name = typeof arg === 'string' ? arg : '';
  const c = COURSES[name];
  if (!c) return <div className="empty">No course here.</div>;
  const p = courseProgress(name);
  const answer = (choice: string) => {
    setPicked(choice);
    if (choice === quizRight(name)) notify('Correct');
  };
  return (
    <div>
      <div className="card">
        <div className="row">
          <div className="g">
            <b>{name}</b>
            <div className="xs m">Course · in progress</div>
          </div>
          <span className="tag">{p}%</span>
        </div>
        <div className="bar">
          <i style={{ width: `${p}%` }} />
        </div>
      </div>
      <div className="courseCols">
      <div>
      <h3 className="sec">Lessons</h3>
      <div className="card cardPad">
        {c.les.map((l) => {
          const done = isLessonDone(name, l.t);
          return (
            <div key={l.t} className="li">
              <button
                className={'ck' + (done ? ' d' : '')}
                aria-label={done ? `${l.t} done` : `Mark ${l.t} done`}
                onClick={() => {
                  if (!done) {
                    markLessonDone(name, l.t);
                    refresh();
                  }
                }}
              />
              <button
                className="g"
                style={{ textAlign: 'left' }}
                onClick={() => {
                  queueBrief(`Continue my ${name} lesson: ${l.t}`);
                  goTab('chat');
                }}
              >
                {l.t}
                {done ? <div className="xs m">done</div> : null}
              </button>
              <ItemMenu
                name={l.t}
                open={() => {
                  queueBrief(`Continue my ${name} lesson: ${l.t}`);
                  goTab('chat');
                }}
                extra={done ? undefined : [{ label: 'Mark done', onClick: () => { markLessonDone(name, l.t); refresh(); } }]}
              />
            </div>
          );
        })}
      </div>
      <div className="card cardPad">
        <div className="li">
          <div className="g s">Make a quiz from this course</div>
          <button
            className="fb"
            onClick={() => {
              queueBrief(`Make a quiz from my ${name} course`);
              goTab('chat');
            }}
          >
            Make
          </button>
        </div>
        <div className="li">
          <div className="g s">Make flashcards from this course</div>
          <button
            className="fb"
            onClick={() => {
              queueBrief(`Make a set of flashcards from my ${name} course`);
              goTab('chat');
            }}
          >
            Make
          </button>
        </div>
      </div>
      </div>
      <div>
      <div className="card">
        <b>Quick check</b>
        <div className="qz">
          <div className="s" style={{ margin: '8px 0' }}>
            {c.q.q}
          </div>
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
        <button
          className="gho"
          onClick={() => {
            /* Like Distill: hand Chat the real context and go there. */
            const next = c.les.find((l) => !isLessonDone(name, l.t));
            queueBrief(
              `I'm taking the ${name} course in Classroom (${p}% done). ` +
                (next ? `My next lesson is "${next.t}". Teach it to me, one step at a time.` : 'I finished every lesson. Quiz me on the whole course.'),
            );
            goTab('chat');
          }}
        >
          Continue in Chat
        </button>
      </div>
      </div>
      </div>
    </div>
  );
}

