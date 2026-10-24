/* Eumae's tool forms: one tiny schema language, used three ways.
 *
 *  1. Sent to Gemini as each tool's `parameters` (the OpenAPI subset Gemini
 *     reads: type, description, enum, items, properties, required).
 *  2. Checked against every call the model makes, all the way down — a list
 *     of five tasks is five checked tasks, not one checked list. Wove's
 *     checker stopped at the top level, which is how bad rows got through.
 *  3. Shown to the person: nothing here is, but every rule that fails turns
 *     into a plain sentence Eumae gets back and can fix.
 *
 *  Formats are ours, not Gemini's: `date` is YYYY-MM-DD and must be a real
 *  calendar day, `time` is HH:MM on a 24-hour clock. */

export type Param =
  | { type: 'string'; description?: string; enum?: readonly string[]; format?: 'date' | 'time'; max?: number }
  | { type: 'number'; description?: string; min?: number; max?: number; integer?: boolean }
  | { type: 'boolean'; description?: string }
  | { type: 'array'; description?: string; items: Param; minItems?: number; maxItems?: number }
  | { type: 'object'; description?: string; properties: Record<string, Param>; required?: readonly string[] };

export type ObjectParam = Extract<Param, { type: 'object' }>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isRealDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isTime(s: string): boolean {
  return TIME.test(s);
}

/** First problem found, as a sentence naming where it is (`tasks[2].due`), or
 *  null when the value fits. Unknown keys are refused too: a model that
 *  invents a field is a model that thinks the field does something. */
export function check(p: Param, v: unknown, at = 'args'): string | null {
  if (v === undefined || v === null) return null;
  switch (p.type) {
    case 'string': {
      if (typeof v !== 'string') return `${at} must be text.`;
      if (p.enum && !p.enum.includes(v)) return `${at} must be one of: ${p.enum.join(', ')}.`;
      if (p.format === 'date' && v !== '' && !isRealDate(v)) return `${at} must be a real date as YYYY-MM-DD.`;
      if (p.format === 'time' && v !== '' && !isTime(v)) return `${at} must be a time as HH:MM, 24-hour.`;
      if (p.max && v.length > p.max) return `${at} is too long (max ${p.max} characters).`;
      return null;
    }
    case 'number': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return `${at} must be a number.`;
      if (p.integer && !Number.isInteger(v)) return `${at} must be a whole number.`;
      if (p.min !== undefined && v < p.min) return `${at} must be at least ${p.min}.`;
      if (p.max !== undefined && v > p.max) return `${at} must be at most ${p.max}.`;
      return null;
    }
    case 'boolean':
      return typeof v === 'boolean' ? null : `${at} must be true or false.`;
    case 'array': {
      if (!Array.isArray(v)) return `${at} must be a list.`;
      if (p.minItems !== undefined && v.length < p.minItems) return `${at} needs at least ${p.minItems} item(s).`;
      if (p.maxItems !== undefined && v.length > p.maxItems) return `${at} can hold at most ${p.maxItems} items.`;
      for (let i = 0; i < v.length; i++) {
        if (v[i] === undefined || v[i] === null) return `${at}[${i}] is empty.`;
        const e = check(p.items, v[i], `${at}[${i}]`);
        if (e) return e;
      }
      return null;
    }
    case 'object': {
      if (typeof v !== 'object' || Array.isArray(v)) return `${at} must be an object.`;
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        if (!(k in p.properties)) return `${at}.${k} is not a field here. Allowed: ${Object.keys(p.properties).join(', ')}.`;
      }
      for (const k of p.required ?? []) {
        const x = o[k];
        if (x === undefined || x === null) return `${at}.${k} is required.`;
        if (typeof x === 'string' && !x.trim()) return `${at}.${k} must not be empty.`;
      }
      for (const [k, sub] of Object.entries(p.properties)) {
        const e = check(sub, o[k], `${at}.${k}`);
        if (e) return e;
      }
      return null;
    }
  }
}

/** The same form, in the shape Gemini's function declarations take. Our own
 *  keys (format, min, max, integer, minItems) are folded into the
 *  description, because Gemini drops what it does not know and the model
 *  should still read the rule. */
export function toGemini(p: Param): Record<string, unknown> {
  const note: string[] = [];
  const out: Record<string, unknown> = {};
  switch (p.type) {
    case 'string':
      out.type = 'STRING';
      if (p.enum) out.enum = [...p.enum];
      if (p.format === 'date') note.push("A day in the person's own words ('tomorrow', 'friday', 'in 3 weeks', 'Nov 14', 'the second Friday of November') or YYYY-MM-DD. The app works out the date; never count days yourself.");
      if (p.format === 'time') note.push("A time like '7 pm', '7:30 am', 'noon', or HH:MM on a 24-hour clock.");
      break;
    case 'number':
      out.type = p.integer ? 'INTEGER' : 'NUMBER';
      break;
    case 'boolean':
      out.type = 'BOOLEAN';
      break;
    case 'array':
      out.type = 'ARRAY';
      out.items = toGemini(p.items);
      if (p.minItems) note.push(`At least ${p.minItems}.`);
      break;
    case 'object':
      out.type = 'OBJECT';
      out.properties = Object.fromEntries(Object.entries(p.properties).map(([k, v]) => [k, toGemini(v)]));
      if (p.required?.length) out.required = [...p.required];
      break;
  }
  const desc = [p.description, ...note].filter(Boolean).join(' ');
  if (desc) out.description = desc;
  return out;
}
