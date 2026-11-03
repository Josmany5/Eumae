/* Classroom tutorial — the TutorialView extracted to PAGES (arg = tutorial
 * name): TUT12 steps, read in class. */

import { TUTORIALS } from '../classroom';
import type { PageProps } from './index';

export default function TutorialPage({ arg }: PageProps) {
  const name = typeof arg === 'string' ? arg : '';
  const steps = TUTORIALS[name] || [
    'Open it from the Classroom tab.',
    'Everything here is reference — no progress, no pressure.',
  ];
  if (!name) return <div className="empty">No tutorial here.</div>;
  return (
    <div>
      <div className="card">
        <b>{name}</b>
        {steps.map((s, i) => (
          <div key={s} className="hi" style={{ marginTop: 10 }}>
            <span className="dt ok" />
            <div className="s">
              <b>Step {i + 1}.</b> {s}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
