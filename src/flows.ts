/* Flows: routines that run themselves. Fields follow the mockup's flow editor
 * (`pgFlowEdit`: id, name, when, kind routine/flow, streak, on, steps,
 * done). Example seeds are the mockup's own two flows, labeled until live
 * data replaces them.
 */

export interface Flow {
  id: string;
  /** Name, e.g. "Morning brief". */
  n: string;
  /** When it runs, e.g. "Weekdays 7:00 AM". */
  w: string;
  kind: 'routine' | 'flow';
  streak: number;
  /** On: 0/1, like the mockup. */
  on: 0 | 1;
  steps: string[];
  done: string[];
  /** True for a labeled example seed. Never synced anywhere. */
  example?: boolean;
  /** ms since epoch. */
  createdAt: number;
}

const KEY = 'eumae:flows';

let cache: Flow[] | null = null;

function load(): Flow[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seeds();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.filter(isFlow) : seeds();
    return cache;
  } catch {
    cache = seeds();
    return cache;
  }
}

/* The mockup's own flows (`pgFlows` defaults). */
function seeds(): Flow[] {
  const now = Date.now();
  return [
    {
      id: 'brief',
      n: 'Morning brief',
      w: 'Weekdays 7:00 AM',
      kind: 'flow',
      streak: 12,
      on: 1,
      steps: ['Gather overnight', 'Carry over', "Rank one focus"],
      done: [],
      example: true,
      createdAt: now,
    },
    {
      id: 'shut',
      n: 'Shutdown ritual',
      w: 'Daily 9:00 PM',
      kind: 'flow',
      streak: 8,
      on: 1,
      steps: ['Review the day', 'File leftovers', "Set tomorrow's one thing"],
      done: [],
      example: true,
      createdAt: now,
    },
  ];
}

function save(flows: Flow[]): void {
  cache = flows;
  try {
    localStorage.setItem(KEY, JSON.stringify(flows));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isFlow(f: unknown): f is Flow {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.n === 'string' &&
    typeof o.w === 'string' &&
    (o.kind === 'routine' || o.kind === 'flow') &&
    typeof o.streak === 'number' &&
    (o.on === 0 || o.on === 1) &&
    Array.isArray(o.steps) &&
    Array.isArray(o.done) &&
    typeof o.createdAt === 'number'
  );
}

export function getFlows(): Flow[] {
  return [...load()];
}

export function saveFlow(flow: Flow): void {
  const flows = load();
  const i = flows.findIndex((f) => f.id === flow.id);
  if (i >= 0) flows[i] = flow;
  else flows.push(flow);
  save(flows);
}

export function createFlow(n: string): Flow {
  const now = Date.now();
  const flow: Flow = {
    id: `f${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    n,
    w: 'Manual',
    kind: 'flow',
    streak: 0,
    on: 1,
    steps: [],
    done: [],
    createdAt: now,
  };
  saveFlow(flow);
  return flow;
}

export function deleteFlow(id: string): void {
  save(load().filter((f) => f.id !== id));
}
