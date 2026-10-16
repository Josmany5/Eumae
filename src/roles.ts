/* Custom roles: how Eumae shows up for a chat — tone, style, purpose.
 *
 * The mockup's S.roles9 + ROLE9: roles are saved, the active one is the
 * turn's `role`, and request.ts renders the active custom role into the
 * prompt (directives()). Built-ins (Default/Coach/Teacher/Sparring
 * partner) need no row — only custom ones live here.
 *
 * Migration note (AGENTS 4.16): localStorage-only like every other store;
 * Supabase sync later, same pattern as threads/notes.
 */

export interface CustomRole {
  n: string;
  tone: string;
  style: string;
  purpose: string;
}

const KEY = 'eumae:roles';

let cache: CustomRole[] | null = null;

function load(): CustomRole[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.filter(isRole) : [];
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

function save(roles: CustomRole[]): void {
  cache = roles;
  try {
    localStorage.setItem(KEY, JSON.stringify(roles));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isRole(r: unknown): r is CustomRole {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.n === 'string' &&
    typeof o.tone === 'string' &&
    typeof o.style === 'string' &&
    typeof o.purpose === 'string'
  );
}

export function getRoles(): CustomRole[] {
  return load().map((r) => ({ ...r }));
}

export function findRole(name: string): CustomRole | undefined {
  return load().find((r) => r.n === name);
}

/* Save (or replace by name) — the mockup's svRole9. Returns the name,
 * defaulting like the mockup does. */
export function saveRole(role: CustomRole): string {
  const n = role.n.trim() || 'Custom role';
  const next = { n, tone: role.tone, style: role.style, purpose: role.purpose };
  const roles = load().filter((r) => r.n !== n);
  save([...roles, next]);
  return n;
}

export function deleteRole(name: string): void {
  save(load().filter((r) => r.n !== name));
}

/* Undo: the whole list before a delete, put back as it was. */
export function snapshotRoles(): CustomRole[] {
  return getRoles();
}

export function restoreRoles(roles: CustomRole[]): void {
  save(roles.map((r) => ({ ...r })));
}
