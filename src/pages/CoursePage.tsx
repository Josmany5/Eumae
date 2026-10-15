/* Classroom course — the CourseView extracted to PAGES so rail rows can
 * push it (arg = course name). Lessons tap-to-done, Quick-check quiz,
 * Continue-in-Chat via brief queue. */

import { useState } from 'react';
import { useNav } from '../nav';
import { COURSES, courseProgress, isLessonDone, markLessonDone, quizRight } from '../classroom';
import { queueBrief } from '../studio';
import { Icon } from '../components/shell/icons';
import type { PageProps } from './index';

export default function CoursePage({ arg }: PageProps) {
  const { notify } = useNav();
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
      <h3 className="sec">Lessons</h3>
      <div className="card cardPad">
        {c.les.map((l) => {
          const done = isLessonDone(name, l.t);
          return (
            <button
              key={l.t}
              className="sr"
              onClick={() => {
                markLessonDone(name, l.t);
                refresh();
              }}
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
            queueBrief(`Continue my ${name} lesson`);
            notify('Continuing in Chat.');
          }}
        >
          Continue in Chat
        </button>
      </div>
    </div>
  );
}

export function CourseBackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="backbar">
      <button className="hb" onClick={onBack} aria-label="Back">
        <Icon name="bk" />
      </button>
      <div className="tt" />
    </div>
  );
}
