# Eumae

One window, six views — **Chat, Console, Studio, Library, Classroom, Guild** — plus Settings, a
right-hand panel, and a desktop rail that carries each tab's own menu.

**Status: pre-alpha (0.1).** The shell, the navigation, Settings and the activity
log are real and verified. The AI, accounts and storage are not wired yet: sending
a message appends a local bubble, and the only thing that survives a reload is what
Settings writes to `localStorage`. There is no test suite, no linter and no CI —
see *What's missing* at the bottom.

## Quick start

Needs Node 24.x (pinned in `package.json` → `engines`) and npm.

```bash
npm install
npm run dev        # vite dev server on http://localhost:5173
npm run build      # tsc --noEmit && vite build  ->  dist/
npm run preview    # serve the built dist/
npm run typecheck  # types only
```

`build` gates on types: `tsc --noEmit` runs first, so a type error fails the build
instead of shipping.

No environment variables are needed to run the UI. `api/ai.ts` reads four — and
`vite dev` does **not** serve that file, so the AI path currently runs only under
`vercel dev` or on Vercel.

| Variable | Used for |
| --- | --- |
| `GEMINI_API_KEY` | model calls |
| `GOOGLE_CLOUD_TTS_KEY` | voice |
| `SUPABASE_URL` | session / account lookup |
| `SUPABASE_ANON_KEY` | the same, as the client key |

Every action in `api/ai.ts` requires a signed-in caller *before* the API key is
ever touched.

## Layout

```
api/ai.ts                  the only server code (a Vercel function)
index.html                 shell HTML + the pre-paint theme boot script
src/main.tsx               mounts App
src/App.tsx                the shell: tab, page stack, panel, drawers
src/nav.ts                 NavContext — go/back, goTab, panel, turn, refs, pickFile
src/log.ts                 the activity log — LOG_AREAS, logEv (the one writer), useLog
src/request.ts             the request /api/ai will be handed — the turn as prose,
                           the model as a server key, the thread as its window
src/store/store.tsx        state skeleton (EumaeState is still empty)
src/store/types.ts         Actor / ActionStamp / SavedItem
src/screens/               one component per tab; index.tsx maps TabId -> screen
src/pages/                 sub-pages pushed onto a tab; index.tsx maps name -> page
src/components/shell/      Header, TabBar, Sidebar (desktop rail), Drawer (phone),
                           Composer, AddSheet (the `+` menu), RightPanel, Sheet,
                           Toast, icons
src/components/settings/   Settings.tsx — the whole overlay
src/styles/tokens.css      design tokens + every component's styles
```

## How it fits together

- **Tabs vs pages.** The six tabs are *screens*; switching tab clears the page
  stack, exactly like the mockup's `go()`. Everything else is a *page* pushed on
  top of the current tab (`nav.go` / `nav.back`) and registered in
  `src/pages/index.tsx` — a new page is one row.
- **One shell, two shapes.** The desktop rail (`Sidebar`) and the phone drawer
  render the same two maps — the six tabs and `pageMenu.ts`'s `PAGE_MENU` — so the
  two cannot drift apart.
- **Settings is an overlay, not a page:** 22 rows → 23 titles → 23 panes, across
  five groups (Eumae, App, Account, Data, Support). The extra title is `main`, the
  mobile root list; no rail row points at it.
- **Storage convention.** `useStored(key, initial)` (`Settings.tsx:56`) writes
  `eumae:<key>` as JSON. Export and "Delete everything" both filter on that
  `eumae:` prefix, so the prefix *is* the contract — a preference that skips it
  silently escapes backups.
- **Theme lands before first paint.** `index.html` applies `eumae:theme` from an
  inline script, because the bundle is deferred and a light-theme user would
  otherwise paint the dark default and then flip.
- **Icons** come from one registry (`components/shell/icons.tsx`); a row names an
  icon, and an unknown name renders nothing.
- **One log, one writer.** `src/log.ts` owns the activity log: `logEv` is the only
  thing that appends to it, `useLog(area)` is the only read, and the areas come from
  one list the filter and the writers share. A writer is one explicit line at the
  action itself — the four things the app can do (send, attach, detach, a `+` menu
  pick). Nothing is inferred, so the log can only ever hold what actually happened.
  Settings → Logs (filtered by area) and the panel's Activity reading are both wired;
  Console's Activity card reads the same list when Console is built. That second door
  is what ended the log's near-invisibility — before it, the only reader sat three
  taps into Settings. It is memory-only for now, and the pane says so.
- **One panel, three readings.** `RightPanel` answers Context (what's in play),
  Activity (what happened — the log), and Studio (what came out of it). The header's
  clock button opens it straight on Activity; the corner handle reopens it on
  whatever you read last.
- **The turn becomes a request in one place.** `src/request.ts` is the whole
  contract with `/api/ai`: the five `+` choices don't travel as fields — they
  become a prose settings block inside `systemPrompt` — and the model travels as
  the server's own key (`lite` / `best`), never as the `Fast` / `Best` label the
  chip shows, because the server treats an unknown key as a silent default rather
  than an error. `Auto` sends no key. Each message keeps the body it was sent
  with — built at send, so changing your mind later cannot rewrite how an earlier
  message was asked. Nothing posts it yet; that is Phase 6.
- **Honesty rule.** Where the mockup invents data — a password, active sessions, a
  spend figure, fake log rows — this codebase shows the real state and names the
  gap instead. Keep it that way.

## Design source

The mockups live outside this repo, on the Desktop:

```
~/Desktop/eumae-mockup-wove-branch.html   authoritative · 1909 lines · newer
~/Desktop/eumae-v12-mockup.html           older snapshot · 1621 lines · same core
```

Open the newer one in a browser: it is a single self-contained HTML file and the
reference for every screen. **Read with care** — it redefines `PGF.*` and `pD`
several times and only the *last* definition is live. `AGENTS.md` explains.

## Roadmap

1. ✅ Settings caught up to the mockup — 8 new panes, Account group, real Logs row
2. ✅ One activity log (`src/log.ts`) — one writer, seven areas, read back in Settings → Logs
3. ✅ The request shape — `src/request.ts` defines what a sent turn becomes for `/api/ai`
4. ✅ Panel rebuilt — Context · Activity · Studio readings; the clock button opens Activity
5. ⬜ Chips — read the current turn back above the input
6. ⬜ Sandbox, Studio artifacts, and `/api/ai` wired to the thread

## What's missing

What stands between this and something you could hand to a paying user. None of it
is exotic, and all of it is explained in `AGENTS.md` §8.

- **A CI robot.** Nothing runs the build on push today. About 15 lines of YAML.
- **Tests.** Every check so far was a throwaway script. The ones worth keeping are
  named in `AGENTS.md` §5.
- **A linter / formatter** (ESLint + Prettier), so style stops being something
  anyone thinks about.
- **Persistence.** Messages and the activity log both live in memory: a reload
  forgets them, and neither is in an export.
- **The POST.** `src/request.ts` defines the body `/api/ai` will receive, and
  every message already builds and keeps its own — but nothing sends one yet. The
  fetch, the streaming reader for `chatStream`, and the auth screen the endpoint
  requires are Phase 6.
- **`.env.example`**, and an error that names a missing key instead of a 500.
- **An error boundary**, so a crash is a message and not a white screen.
- **No `main` branch** — the default branch is `stage/0-foundation`.

## Working on this repo

Read **`AGENTS.md`** first: current state, locked decisions, gotchas, the exact
next steps, and the production-readiness list.

