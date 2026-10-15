/* Classroom section — the SectionView extracted to PAGES (arg = section
 * name): CX8 blurb + Digest distill card + yours/discover rows + create
 * CTA. Row routing follows the mockup's CXROW12. */

import { useState } from 'react';
import { useNav } from '../nav';
import { SECTIONS, COURSE_ORDER } from '../classroom';
import { queueBrief } from '../studio';
import { addFile } from '../library';
import type { PageProps } from './index';

export default function CxSectionPage({ arg }: PageProps) {
  const { notify, go, goTab } = useNav();
  const [distilled, setDistilled] = useState(false);
  const [saved, setSaved] = useState(false);

  const name = typeof arg === 'string' ? arg : '';
  const sec = SECTIONS[name];
  if (!sec) return <div className="empty">No section here.</div>;

  const toChat = (brief: string) => {
    queueBrief(brief);
    goTab('chat');
  };

  const openRow = (row: string) => {
    if (name === 'Courses') {
      const hit = COURSE_ORDER.find((c) => row.startsWith(c));
      if (hit) {
        go('course', hit);
        return;
      }
    }
    if (name === 'App tutorials') {
      go('tut', row);
      return;
    }
    if (name === 'Training') {
      const courseHit = COURSE_ORDER.find((c) => row.toLowerCase().includes(c.toLowerCase()));
      if (courseHit) {
        go('course', courseHit);
        return;
      }
      toChat(`Continue my ${row} training`);
      return;
    }
    toChat(`Preview: ${row}`);
  };

  return (
    <div>
      <div className="card">
        <div className="s">{sec.blurb}</div>
      </div>
      {name === 'Digest' ? (
        <div className="card">
          <input placeholder="Paste a link, or upload a video or book" aria-label="Paste a link, or upload a video or book" />
          <div className="btns">
            <button className="pri" onClick={() => setDistilled(true)}>
              Distill
            </button>
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
                <button
                  className="gho"
                  onClick={() => {
                    addFile('Distilled digest', 'DIGEST', 'Documents');
                    setSaved(true);
                    notify('Saved to Digest.');
                  }}
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <h3 className="sec">Yours</h3>
      {sec.yours.map((row) => (
        <div key={row} className="cxcard">
          <div className="row">
            <div className="g">
              <b>{row}</b>
            </div>
            <button className="fb" onClick={() => openRow(row)}>
              Open
            </button>
          </div>
        </div>
      ))}
      {sec.discover.length ? (
        <>
          <h3 className="sec">Discover</h3>
          {sec.discover.map((row) => (
            <div key={row} className="cxcard">
              <div className="row">
                <div className="g">
                  <b>{row}</b>
                </div>
                <button className="fb" onClick={() => openRow(row)}>
                  Open
                </button>
              </div>
            </div>
          ))}
        </>
      ) : null}
      {sec.create ? (
        <div className="btns">
          <button className="gho" onClick={() => toChat(`${sec.create}: `)}>
            {sec.create}
          </button>
        </div>
      ) : null}
    </div>
  );
}
