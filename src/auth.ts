import { useEffect, useSyncExternalStore } from 'react';
import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';

/* Who is signed in, and the token the server checks.
 *
 *  There is no design source for this and the file says so instead of citing a
 *  line: the mockup has no sign-in anywhere. Its Security page invents a
 *  password, a passkey and two active sessions (line 1039), which the honesty
 *  pass already replaced with "This device". What exists instead is a server
 *  that refuses to work without a caller — `api/ai.ts:158`, "The lock: every
 *  action requires a signed-in caller" — so a person has to be able to become
 *  that caller.
 *
 *  Supabase rather than anything hand-rolled, because the check is already
 *  Supabase's: the server reads `Authorization: Bearer <token>` and calls
 *  `supabase.auth.getUser(token)` (ai.ts:39-45), taking the user id out of it.
 *  The browser's half is the same library — `@supabase/supabase-js` was already
 *  a dependency for the function — asked to sign someone in and to keep the
 *  session's token fresh.
 *
 *  Three things about the shape, all of them load-bearing:
 *
 *  - The variables are `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, the same
 *    project as the server's pair. `.env.example` deliberately left them out
 *    until now, on the grounds that a file naming a variable no code reads is a
 *    file that lies. This file reads them, so they are named there today.
 *  - A session is not an `eumae:` key and is not ours to store: the library keeps
 *    it under its own name in localStorage, which means Export and Delete
 *    everything do not touch it. That is why Delete everything now signs out and
 *    says so — "everything" has to mean everything.
 *  - The state is module scope with one subscription, like the log, because there
 *    are three readers (the account card, the Security pane, the voice layer's
 *    token) and no single parent of all three.
 *  - The library is fetched, not imported: `@supabase/supabase-js` is about 228kB
 *    of built JavaScript, and a static import put it in the app's own bundle —
 *    510kB in one file, which is where Vite starts warning about the chunk. On a
 *    dynamic import it is a second file, fetched when a token is first needed or
 *    when the screen that asks about the session mounts: the app's own chunk stays
 *    at 284kB. Settings mounts with the shell, so the fetch does happen shortly
 *    after a page loads rather than only at a sign-in — what the split buys is
 *    that the *first paint* never waits for 228kB of auth library to be parsed,
 *    and that a failure to fetch it is handled rather than fatal (`auth` below).
 *    The `import type` at the top is erased at build time and costs nothing.
 */

/** What the app can be told about who is using it.
 *
 *  `unconfigured` is a state, not an error: those two variables are inlined at
 *  build time, so a deployment built without them cannot sign anyone in whatever
 *  they type — and the screen says exactly that rather than failing obscurely.
 *  `checking` is the honest name for the moment before the stored session has
 *  been read. */
export type AuthStatus = 'unconfigured' | 'checking' | 'signed-out' | 'signed-in';

export interface AuthState {
  status: AuthStatus;
  email: string | null;
}

/* Read once at module load: Vite replaces these with string literals when it
 * builds, so there is nothing to re-read later. */
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(URL_ && KEY);

let state: AuthState = configured
  ? { status: 'checking', email: null }
  : { status: 'unconfigured', email: null };

const listeners = new Set<() => void>();
let loading: Promise<SupabaseClient | null> | null = null;
let started = false;

function snapshot(): AuthState {
  return state;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function set(next: AuthState): void {
  state = next;
  listeners.forEach((fn) => fn());
}

/** Settle the state from a session, or from the absence of one.
 *
 *  `unconfigured` is never overwritten: with no project to sign in to,
 *  "signed out" would be a wrong answer to the question being asked. */
function apply(session: Session | null): void {
  if (!configured) return;
  const email = session?.user?.email ?? null;
  set(email ? { status: 'signed-in', email } : { status: 'signed-out', email: null });
}

/** The one client, made on first use rather than at import — a server render
 *  imports this module (§5) and there is no `localStorage` there — and fetched
 *  rather than linked, so the library is not in the bundle everyone downloads.
 *
 *  `detectSessionInUrl` is what makes an emailed link work: Supabase returns the
 *  person to this page with the session in the URL, and the library has to be
 *  allowed to read it. `autoRefreshToken` is what stops a long-lived session
 *  from quietly starting to 401. */
async function auth(): Promise<SupabaseClient | null> {
  if (!configured) return null;
  if (!loading) {
    loading = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        const client = createClient(URL_ as string, KEY as string, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        /* One subscription, made with the client: a background refresh or an
           expiry is news the screen needs, and neither goes through this file's
           own actions. */
        client.auth.onAuthStateChange((_event, session) => apply(session));
        return client;
      })
      .catch(() => {
        /* The library could not be fetched — an offline first load, most likely.
           No client means no session, which is a state this file already has a
           name for. */
        return null;
      });
  }
  return loading;
}

/** Read the stored session, once. Called from `useAuth`'s effect, never at
 *  import. */
async function begin(): Promise<void> {
  if (started) return;
  started = true;
  const supabase = await auth();
  if (!supabase) return;
  supabase.auth
    .getSession()
    .then(({ data }) => {
      /* Only if nothing has answered already — a sign-in that happened while
         this was in flight is newer news than what was stored. */
      if (state.status === 'checking') apply(data.session);
    })
    .catch(() => {
      /* The session could not be read at all. That is not a signed-in person. */
      apply(null);
    });
}


/** Supabase's own sentence, passed through.
 *
 *  This is the one place in this codebase where a provider's words reach the
 *  person, and the difference is who wrote them for whom. Google's error body
 *  names endpoints and request ids and is addressed to whoever holds the key, so
 *  it goes to the function log and never into a reply (ai.ts:4-11). An auth
 *  error — "Invalid login credentials", "Email not confirmed", "User already
 *  registered" — is addressed to the person typing, and rewriting it here would
 *  only make a second, worse copy. */
function message(error: AuthError): string {
  /* A network failure is not a wrong password, and the library's own text for it
     — "Failed to fetch" — is the browser's, not something about signing in. This
     case was not guessed: it is what the first configured build showed when the
     form was filled and Sign in was pressed against a project that does not
     exist (see the commit for that run). */
  if (/failed to fetch|network ?error/i.test(error.message)) {
    return 'Could not reach the sign-in service. Check the connection and try again.';
  }
  return error.message || 'That did not work. Try again.';
}

/** Sign in. `null` means it worked; anything else is one sentence for the person,
 *  which is the shape every caller of this file uses. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const supabase = await auth();
  if (!supabase) return 'This build has no sign-in configured.';
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return message(error);
  apply(data.session);
  return null;
}

/** Create an account. With email confirmation on — Supabase's default — this
 *  returns no session, so the honest answer is what to do next rather than a
 *  screen that looks like it worked. */
export async function createAccount(email: string, password: string): Promise<string | null> {
  const supabase = await auth();
  if (!supabase) return 'This build has no sign-in configured.';
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return message(error);
  if (!data.session) return 'Check your email to confirm the address, then sign in.';
  apply(data.session);
  return null;
}

/** Email a sign-in link instead of using a password. The redirect has to be this
 *  page's own address, so it is read from `window` here rather than configured
 *  somewhere else — the link must come back to wherever the app is served. */
export async function emailLink(email: string): Promise<string | null> {
  const supabase = await auth();
  if (!supabase) return 'This build has no sign-in configured.';
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return message(error);
  return null;
}

/** Sign out. Awaited rather than fired and forgotten, because the caller says
 *  what happened next and "signed out" has to be true by then. */
export async function signOutUser(): Promise<void> {
  const supabase = await auth();
  if (supabase) await supabase.auth.signOut();
  apply(null);
}

/** The token `/api/ai` checks — asked for, not remembered.
 *
 *  `getSession` reads the stored session and refreshes an expiring token, and the
 *  library does that in the background too, so a copy kept in this file would be
 *  a copy that goes stale exactly when it matters. */
export async function accessToken(): Promise<string | null> {
  const supabase = await auth();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  apply(data.session);
  return data.session?.access_token ?? null;
}

/** The read. The third argument is the snapshot for a render with no DOM: the §5
 *  server render mounts Settings, which mounts this — the same reason `useLog`
 *  has one. */
export function useAuth(): AuthState {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    void begin();
  }, []);
  return value;
}
