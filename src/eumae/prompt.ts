/* Eumae's system prompt.
 *
 *  STABLE first (never interpolated, so Gemini's prompt cache can reuse it
 *  turn after turn), then a short CURRENT STATE block built fresh each turn:
 *  where the person is, today's date, and counts. The data itself is NOT
 *  pasted in — Eumae reads what she needs with get_overview / search_items /
 *  read_item. Pasting every store (Wove did) is slow, costly, and gives the
 *  model a haystack to misread. */

import { getTasks } from '../tasks';
import { getEvents, ymd } from '../events';
import { isOverdue, toConfirm } from '../due';
import { getGoals, isActiveGoal } from '../goals';
import { getProjects } from '../projects';
import { getNotes } from '../notes';

/** Fresh every turn, after the stable block. */
export function currentState(where: string): string {
  const now = new Date();
  const t = ymd(now);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });
  const tm = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const tasks = getTasks();
  const open = tasks.filter((x) => !x.d);
  const overdue = open.filter((x) => isOverdue(x, now)).length;
  const unasked = toConfirm(now).length;
  return `

# CURRENT STATE (this turn)
- Today is ${t} (${day}), ${tm}, timezone ${tz}.
- The person is on: ${where}.
- They have ${open.length} open tasks (${overdue} overdue)${unasked ? `, ${unasked} past event${unasked === 1 ? '' : 's'} waiting on "Did you attend?" (never assume they went)` : ''}, ${getEvents().length} events, ${getGoals().filter(isActiveGoal).length} active goals, ${getProjects().length} projects, ${getNotes().length} notes.`;
}
