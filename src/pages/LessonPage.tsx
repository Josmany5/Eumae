/* Template lesson — the mockup's pgLesson: what makes a good X, the
 * rules, one that works, Make-one-in-Chat (brief queue). */

import { useNav } from '../nav';
import { templateOf } from '../studio';
import { queueBrief } from '../studio';
import type { PageProps } from './index';

export default function LessonPage({ arg }: PageProps) {
  const { goTab } = useNav();
  const name = typeof arg === 'string' ? arg : '';
  const t = templateOf(name) ?? templateOf('From a topic');
  if (!name || !t) return <div className="empty">No lesson here.</div>;
  const example = t.v[0] ?? ['Starter', name];
  return (
    <div>
      <div className="card">
        <b>What makes a good {name.toLowerCase()}</b>
        <div className="s" style={{ marginTop: 6 }}>
          {t.u}
        </div>
      </div>
      <div className="card">
        <b>The rules</b>
        <ul className="st">
          {t.s.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="card">
        <b>One that works</b>
        <div style={{ fontWeight: 700, marginTop: 6 }}>{example[1]}</div>
        {example.slice(2).map((l) => (
          <div key={l} className="s" style={{ marginTop: 3 }}>
            {l}
          </div>
        ))}
      </div>
      <div className="btns">
        <button
          className="pri"
          onClick={() => {
            queueBrief(`Make a ${name}`);
            goTab('chat');
          }}
        >
          Make one in Chat
        </button>
        <button className="gho" onClick={() => goTab('classroom')}>
          More in Classroom
        </button>
      </div>
    </div>
  );
}
