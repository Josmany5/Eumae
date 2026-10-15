/* Today's briefing — the mockup's conBrief sheet as a page: Mirror,
 * Nudge (with the Move-it action), Overnight rows from history.
 */

import { getTasks } from '../tasks';
import { dayEvents } from '../events';
import type { PageProps } from './index';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BriefPage(_props: PageProps) {
  void _props;
  const open = getTasks().filter((t) => !t.d);
  const late = dayEvents(todayStr()).filter((e) => e.tm >= '15:00');

  return (
    <div>
      <div className="card">
        <b>Mirror</b>
        <div className="s" style={{ marginTop: 4 }}>
          You finish work best before 9 AM and slip after 4. Your last three demo tasks all landed on mornings you
          protected.
        </div>
      </div>
      <div className="card">
        <b>Nudge</b>
        <div className="s" style={{ marginTop: 4 }}>
          {late.length === 0
            ? 'Nothing is scheduled after 3 PM — move the demo rehearsal there?'
            : `${late.length} thing${late.length === 1 ? ' is' : 's are'} on after 3 PM — the morning is still protected.`}
        </div>
      </div>
      <div className="card">
        <b>Overnight</b>
        {open.length ? (
          <ul className="st">
            {open.slice(0, 3).map((t) => (
              <li key={t.id}>{t.t}</li>
            ))}
          </ul>
        ) : (
          <div className="s m" style={{ marginTop: 4 }}>
            All clear.
          </div>
        )}
      </div>
    </div>
  );
}
