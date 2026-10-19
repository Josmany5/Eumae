/* Time labels, iMessage-style: "Today 6:14 PM", "Yesterday 9:02 AM",
   "Mon 3:10 PM" within the week, "Oct 12, 3:10 PM" before that. */
export function fmtStamp(at: number): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(d)) / 86400000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

/** A label before the first stamped message, then after any gap of an hour or more. */
export function timeLabels(ats: (number | undefined)[]): (string | null)[] {
  let last: number | undefined;
  return ats.map((at) => {
    if (!at) return null;
    const show = last === undefined || at - last > 60 * 60 * 1000;
    last = at;
    return show ? fmtStamp(at) : null;
  });
}

/** Short time for a chat list row: "9:14 PM" today, "Oct 12" before. */
export function fmtListTime(at: number): string {
  const d = new Date(at);
  const n = new Date();
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
