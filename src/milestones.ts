/* Milestones: dated checkpoints on a goal or a project. They show on the
   calendar as diamonds next to the goal's or project's own deadline. */

export interface Milestone {
  id: string;
  t: string;
  /** YYYY-MM-DD, or '' when undated. */
  d: string;
  done?: boolean;
}

export function newMilestone(t: string, d: string): Milestone {
  return { id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36), t, d };
}

export function cleanMilestones(v: unknown): Milestone[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (m): m is Milestone =>
      !!m && typeof m === 'object' && typeof (m as Milestone).id === 'string' && typeof (m as Milestone).t === 'string' && typeof (m as Milestone).d === 'string',
  );
}

export function sortMilestones(ms: Milestone[]): Milestone[] {
  return [...ms].sort((a, b) => (a.d || '9999') .localeCompare(b.d || '9999'));
}

/** The next open milestone with a date, if any. */
export function nextMilestone(ms: Milestone[] | undefined): Milestone | undefined {
  return sortMilestones(ms ?? []).find((m) => !m.done && m.d);
}

/** The phase you're on: the first unfinished one in the order the page shows
   (dated first, then undated), dated or not. */
export function currentPhase(ms: Milestone[] | undefined): Milestone | undefined {
  return sortMilestones(ms ?? []).find((m) => !m.done);
}
