/* Classroom section — the SectionView extracted to PAGES (arg = section
 * name): CX8 blurb + Digest distill card + yours/discover rows + create
 * CTA. Row routing follows the mockup's CXROW12. */

import { useState } from 'react';
import { useNav } from '../nav';
import { SECTIONS, COURSE_ORDER } from '../classroom';
import { queueBrief } from '../studio';
import { Icon } from '../components/shell/icons';
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
      {sec.create ? (
        <div className="card cardPad">
          <button className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => toChat(`${sec.create}: `)}>
            <span className="g s">{sec.create}</span>
            <span className="ch">›</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
