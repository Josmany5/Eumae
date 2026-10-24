/* The guess detector (his call, Oct 19, 9:47 PM). When Eumae stages something,
 * code compares each detail with what the person actually typed in this
 * thread. A detail they never said (60 minutes, urgent, a due date) goes back
 * to her in the tool result with a nudge to SAY it and why, in her own words,
 * so the person can change it before approving. No label on the card: she
 * speaks, he decides.
 *
 * Words-based and deliberately forgiving: a detail counts as theirs when the
 * phrase Eumae passed appears in what they said, or when they said anything of
 * that kind (a duration, a time, an urgency word). False "theirs" are cheap
 * (she just doesn't mention it); false "guesses" make her chatty, so the bar
 * for flagging is "nothing of this kind was said at all". */

type Args = Record<string, any>;

const DATE_WORDS = /\b(today|tonight|tomorrow|tmrw|yesterday|mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?|weekend|week|month|year|jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?|\d{1,2}(st|nd|rd|th)|\d{1,2}\/\d{1,2}|in \d+ days?|deadline|due)\b/;
const TIME_WORDS = /(\b\d{1,2}(:\d\d)?\s?(am|pm|a\.m\.|p\.m\.)|\bnoon\b|\bmidnight\b|\b\d{1,2}:\d\d\b|o'?clock|\bmorning\b|\bafternoon\b|\bevening\b|\btonight\b|\bat \d{1,2}\b)/;
const DURATION = /(\b\d+\s?(m|min|mins|minutes?|h|hrs?|hours?)\b|\b(an?|one|two|three|half an?|couple of) (hour|minute)s?\b|\bhour\b|\ball day\b)/;
const URGENCY = /\b(urgent|asap|important|priority|critical|high|low|top|first thing|right away|soon|whenever|no rush)\b/;
const REPEAT = /\b(every|daily|weekly|monthly|yearly|each|repeat|recurring|weekdays|on (mon|tue|wed|thu|fri|sat|sun)days)\b/;
const STEPS = /\b(steps?|subtasks?|break (it|this|that)? ?(down|up|into)|checklist|first .* then)\b/;
const PACE = /\b(per|a|each|every) (week|month|day)\b|\/(week|month|wk|mo)\b/;
const MILESTONE = /\b(milestones?|checkpoints?|phases?|stages?)\b/;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const said = (heard: string, v: unknown) => typeof v === 'string' && v.trim().length > 1 && heard.includes(norm(v));

function fmtMin(n: number): string {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} hour${h === 1 ? '' : 's'}`;
}

/** What Eumae added to one item that the person didn't say, in plain words. */
function addedTo(kind: 'task' | 'event' | 'goal', x: Args, raw: Args, heard: string): string[] {
  const out: string[] = [];
  const dateField = (f: string, word: string) => {
    if (x[f] === undefined || x[f] === '') return;
    if (said(heard, raw[f]) || DATE_WORDS.test(heard)) return;
    out.push(word);
  };
  const timeField = (f: string, word: string) => {
    if (x[f] === undefined || x[f] === '') return;
    if (said(heard, raw[f]) || TIME_WORDS.test(heard)) return;
    out.push(word);
  };
  if (kind === 'task') {
    dateField('due', 'a due date');
    timeField('time', 'a deadline time');
    if (x.estimate && !DURATION.test(heard)) out.push(`about ${fmtMin(Number(x.estimate))}`);
    if (x.priority && x.priority !== 'none' && !URGENCY.test(heard)) out.push(`${x.priority} priority`);
    if (x.repeat && x.repeat !== 'none' && !REPEAT.test(heard)) out.push(`repeats ${x.repeat}`);
    if (Array.isArray(x.subtasks) && x.subtasks.length && !STEPS.test(heard) && !x.subtasks.every((s: unknown) => said(heard, s))) out.push(`${x.subtasks.length} steps`);
  }
  if (kind === 'event') {
    dateField('date', 'the day');
    timeField('start', 'a start time');
    if (x.end && !said(heard, raw.end) && !DURATION.test(heard) && !/\b(to|until|till|-)\s?\d/.test(heard)) out.push('an end time');
    if (x.location && !said(heard, x.location)) out.push(`the place (${x.location})`);
    if (x.repeat && x.repeat !== 'none' && !REPEAT.test(heard)) out.push(`repeats ${x.repeat}`);
  }
  if (kind === 'goal') {
    dateField('target_date', 'a target date');
    if (x.target !== undefined && !heard.includes(String(x.target))) out.push(`a target of ${x.target}${x.unit ? ' ' + x.unit : ''}`);
    if (x.pace !== undefined && !PACE.test(heard)) out.push(`a pace of ${x.pace} per ${x.pace_per ?? 'week'}`);
    if (Array.isArray(x.milestones) && x.milestones.length && !MILESTONE.test(heard)) out.push(`${x.milestones.length} milestones`);
  }
  // Whatever she owned up to herself counts too.
  if (Array.isArray(x.guessed)) {
    for (const f of x.guessed) {
      if (typeof f !== 'string' || x[f] === undefined) continue;
      const w = f.replace(/_/g, ' ');
      if (!out.some((o) => o.includes(w))) out.push(w);
    }
  }
  return out;
}

const KIND_OF: Record<string, { list: string; kind: 'task' | 'event' | 'goal' }> = {
  create_tasks: { list: 'tasks', kind: 'task' },
  create_events: { list: 'events', kind: 'event' },
  create_goals: { list: 'goals', kind: 'goal' },
};

/** One line per item with added details: "Finish the pitch deck: about 60 min, high priority". */
export function guessesIn(name: string, args: Args, raw: Args, heardRaw: string): string[] {
  const k = KIND_OF[name];
  if (!k || !Array.isArray(args[k.list])) return [];
  const heard = norm(heardRaw);
  const rawList: Args[] = Array.isArray(raw?.[k.list]) ? raw[k.list] : [];
  return args[k.list]
    .map((x: Args, i: number) => {
      const added = addedTo(k.kind, x, rawList[i] ?? x, heard);
      return added.length ? `${String(x.title ?? '').trim()}: ${added.join(', ')}` : '';
    })
    .filter(Boolean);
}
