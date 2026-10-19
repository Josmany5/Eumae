/* Mae's plan card: what she'll make or change, waiting for the person's tap.
 *
 *  Pending: one flat row per change (kind · what · details), Approve and
 *  Cancel. Nothing has happened yet, and the card says so.
 *  Done: the receipt — what was made, each tappable to open — and Undo,
 *  which puts every store back to before the plan ran.
 *  Failed: why, and that nothing changed (a plan never lands half-done). */

import { executePlan, undoPlan, canUndo, type Plan } from '../mae/dispatcher';
import type { MaeStep } from '../mae/loop';
import { dataChanged, setFocus } from '../focus';
import { logEv } from '../log';
import type { NotifyOpts } from '../nav';

type Notify = (message: string, opts?: NotifyOpts) => void;

export function MaeSteps({ steps }: { steps?: MaeStep[] }) {
  if (!steps || !steps.length) return null;
  return (
    <div className="maeSteps">
      {steps.map((s, i) => (
        <div key={i} className={`maeStep${s.ok ? '' : ' bad'}`}>
          {s.label}
        </div>
      ))}
    </div>
  );
}

export function PlanCard({ plan, onChange, notify, area = 'Chat' }: { plan: Plan; onChange: (p: Plan) => void; notify: Notify; area?: 'Chat' | 'Console' | 'Studio' | 'Library' | 'Classroom' | 'Guild' }) {
  const lines = plan.steps.flatMap((s) => s.lines.map((l) => ({ ...l, danger: s.danger })));
  const count = lines.length;

  const undo = (p: Plan) => {
    const back = undoPlan(p);
    if (back === p) return;
    onChange(back);
    dataChanged();
    logEv({ area, text: 'Undid Mae\'s plan' });
  };

  const approve = () => {
    const ran = executePlan(plan);
    onChange(ran);
    dataChanged();
    if (ran.status === 'done') {
      const msg = ran.receipt?.map((r) => r.summary).join('. ') || 'Done';
      logEv({ area, text: `Mae: ${msg}` });
      notify(`${msg}.`, { undo: () => undo(ran) });
    } else {
      logEv({ area, text: `Mae's plan failed: ${ran.error}`, status: 'bad' });
      notify('That plan didn\'t go through. Nothing changed.');
    }
  };

  if (plan.status === 'pending') {
    return (
      <div className="needs maePlan">
        <div className="flbl">Plan · {count} {count === 1 ? 'change' : 'changes'}</div>
        {lines.map((l, i) => (
          <div key={i} className="maeLine">
            <span className={`maeKind${l.verb === 'Delete' || l.verb === 'Skip' ? ' danger' : ''}`}>
              {l.verb} {l.kind.toLowerCase()}
            </span>
            <span className="maeTxt">
              {l.text}
              {l.detail ? <span className="fp">{l.detail}</span> : null}
            </span>
          </div>
        ))}
        <div className="btns">
          <button className="pri" onClick={approve}>
            Approve
          </button>
          <button
            onClick={() => {
              onChange({ ...plan, status: 'cancelled' });
              logEv({ area, text: 'Cancelled Mae\'s plan' });
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (plan.status === 'done') {
    const openable = (plan.touched ?? []).filter((t) => t.kind === 'task' || t.kind === 'event' || t.kind === 'goal');
    return (
      <div className="rcpt maePlan">
        {(plan.receipt ?? []).map((r, i) => (
          <div key={i} className="maeDone">
            {r.summary}
          </div>
        ))}
        {openable.length ? (
          <div className="maeOpen">
            {openable.slice(0, 12).map((t) => (
              <button key={t.kind + t.id} className="chip" onClick={() => setFocus({ k: t.kind as 'task' | 'event' | 'goal', id: t.id })}>
                {t.title}
              </button>
            ))}
          </div>
        ) : null}
        {canUndo(plan.id) ? (
          <button className="gho maeUndo" onClick={() => undo(plan)}>
            Undo
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rcpt maePlan">
      <div className={plan.status === 'failed' ? 'danger' : 'fsub'}>
        {plan.status === 'failed' ? plan.error : plan.status === 'undone' ? 'Undone. Nothing from this plan remains.' : plan.status === 'cancelled' ? 'Cancelled. Nothing was changed.' : 'Working…'}
      </div>
    </div>
  );
}
