/* Classroom section — the SectionView extracted to PAGES (arg = section
 * name): CX8 blurb + Digest distill card + yours/discover rows + create
 * CTA. Row routing follows the mockup's CXROW12. */

import { useState } from 'react';
import { useNav } from '../nav';
import { SECTIONS, COURSE_ORDER } from '../classroom';
import { queueBrief } from '../studio';
import type { PageProps } from './index';

export default function CxSectionPage({ arg }: PageProps) {
  const { go, goTab } = useNav();
  const [link, setLink] = useState('');

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
        /* Distill used to print three canned bullets ("Main argument in one
           line") no matter what was pasted, which is invented data. Now it
           hands the real link to Chat, where Mae actually reads it. */
        <div className="card">
          <input
            className="sinput"
            placeholder="Paste a link to distill"
            aria-label="Paste a link to distill"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && link.trim()) toChat(`Distill this into its main argument, the tactics worth stealing, and what to ignore: ${link.trim()}`); }}
          />
          <div className="btns">
            <button className="pri" disabled={!link.trim()} onClick={() => toChat(`Distill this into its main argument, the tactics worth stealing, and what to ignore: ${link.trim()}`)}>Distill in Chat</button>
          </div>
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
