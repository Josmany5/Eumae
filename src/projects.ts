import type { Milestone } from './milestones';

/* Projects: work with a shape. Fields follow the mockup's SEED
 * (`projs:[{id,n,d,ts,dn}]` — id, name, desc, total steps, done steps).
 * Example seeds are the mockup's own rows, labeled until live data
 * replaces them. `pin` (the Console's pinned project) lives here, not in a
 * sixth key: one reader per store.
 */

export interface Project {
  id: string;
  /** Name. */
  n: string;
  /** One-line description. */
  d: string;
  /** Total steps. */
  ts: number;
  /** Done steps. */
  dn: number;
  /** Deadline, YYYY-MM-DD. Empty or missing means none. */
  due?: string;
  /** Dated checkpoints on the way. */
  ms?: Milestone[];
  /** True for a labeled example seed. Never synced anywhere. */
  example?: boolean;
  /** ms since epoch. */
  createdAt: number;
}

const KEY = 'eumae:projects';
const PIN_KEY = 'eumae:pinnedProject';

let cache: Project[] | null = null;

function load(): Project[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seeds();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.filter(isProject) : seeds();
    return cache;
  } catch {
    cache = seeds();
    return cache;
  }
}

/* The mockup's own rows. */
function seeds(): Project[] {
  const now = Date.now();
  return [
    { id: 'w1', n: 'Eumae', d: 'The personal AI. Demo Nov 2.', ts: 5, dn: 3, due: '2026-11-02', example: true, createdAt: now },
    { id: 'w2', n: 'Uptown Web Design', d: 'Terravita pitch in progress.', ts: 4, dn: 1, example: true, createdAt: now },
  ];
}

function save(projects: Project[]): void {
  cache = projects;
  try {
    localStorage.setItem(KEY, JSON.stringify(projects));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isProject(p: unknown): p is Project {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.n === 'string' &&
    typeof o.d === 'string' &&
    typeof o.ts === 'number' &&
    typeof o.dn === 'number' &&
    typeof o.createdAt === 'number'
  );
}

export function getProjects(): Project[] {
  return [...load()];
}

/* Status is derived, not stored — the mockup's pSt: done when every step
   is done (and there is at least one), active otherwise. */
export function projectStatus(p: Project): 'active' | 'done' {
  return p.ts > 0 && p.dn >= p.ts ? 'done' : 'active';
}

export function projectPercent(p: Project): number {
  return p.ts ? Math.round((p.dn / p.ts) * 100) : 0;
}

export function getProject(id: string): Project | undefined {
  return load().find((p) => p.id === id);
}

export function saveProject(project: Project): void {
  const projects = load();
  const i = projects.findIndex((p) => p.id === project.id);
  if (i >= 0) projects[i] = project;
  else projects.push(project);
  save(projects);
}

export function createProject(n: string): Project {
  const now = Date.now();
  const project: Project = {
    id: `w${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    n,
    d: '',
    ts: 0,
    dn: 0,
    createdAt: now,
  };
  saveProject(project);
  return project;
}

export function deleteProject(id: string): void {
  save(load().filter((p) => p.id !== id));
  if (getPinnedProjectId() === id) setPinnedProjectId(null);
}

/* The Console's pinned project: an id or null. Seeded to the mockup's own
   pin (`pin:"w1"`). */
export function getPinnedProjectId(): string | null {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}

export function setPinnedProjectId(id: string | null): void {
  try {
    if (id) localStorage.setItem(PIN_KEY, id);
    else localStorage.removeItem(PIN_KEY);
  } catch {
    /* Non-fatal. */
  }
}

export function getPinnedProject(): Project | undefined {
  const id = getPinnedProjectId() ?? 'w1';
  return getProject(id) ?? load()[0];
}
