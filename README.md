# Eumae

One window, six views — **Chat, Console, Studio, Library, Classroom, Guild** — plus Settings, a
right-hand panel, and a desktop rail that carries each tab's own menu.

**Status: pre-alpha (0.1).** The shell, the navigation, Settings, the composer's
`+` window and the activity log are real and verified. The AI, accounts and storage
are not wired yet: sending a message appends a local bubble, and the only thing that
survives a reload is what Settings writes to `localStorage`. There is no test suite,
no linter and no CI — see *What's missing* at the bottom.

## Quick start

Needs Node 24.x (pinned in `package.json` → `engines`) and npm.

```bash
npm install
npm run dev        # vite dev server on http://localhost:5173
npm run build      # tsc --noEmit && vite build  ->  dist/
npm run preview    # serve the built dist/
npm run typecheck  # types only
npm run check:models:selftest   # the model IDs in api/ai.ts — no key, no network
```

`build` gates on types: `tsc --noEmit` runs first, so a type error fails the build
instead of shipping. `check:models` is the one check that talks to Google — it asks
whether the model IDs in `api/ai.ts` are still ones it serves, exits 2 without a
`GEMINI_API_KEY` and 1 if an ID cannot answer; the selftest above covers its logic
with neither key nor network.

No environment variables are needed to run the UI. `api/ai.ts` reads four — and
`vite dev` does **not** serve that file, so the AI path currently runs only under
`vercel dev` or on Vercel. The browser reads two more of its own, for signing in.
`.env.example` names all six; copy it to `.env.local` (git-ignored) or let
`vercel env pull .env.local` write it.

| Variable | Used for |
| --- | --- |
| `GEMINI_API_KEY` | model calls |
| `GOOGLE_CLOUD_TTS_KEY` | voice |
| `SUPABASE_URL` | session / account lookup |
| `SUPABASE_ANON_KEY` | the same, as the client key |
| `VITE_SUPABASE_URL` | the same project again, for the sign-in screen |
| `VITE_SUPABASE_ANON_KEY` | the same, as the browser key |

Every action in `api/ai.ts` requires a signed-in caller *before* the API key is
ever touched. The `VITE_` pair is what lets a person become one — and because Vite
inlines that prefix into the built JavaScript, a deployment needs both as its own
Vercel variables. A build made without them says so on its sign-in screen rather
than failing obscurely, and nothing secret may ever carry that prefix.

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
src/voice.ts               the voice layer — voice typing in, read aloud out, both
                           from the mockup: no SDK, no live session, no dependency
src/auth.ts                who is signed in, and the token /api/ai checks (Supabase)
src/vite-env.d.ts          the two VITE_SUPABASE_* variables, typed
src/useMedia.ts            the (min-width:900px) hook Settings and the `+` window share
src/store/store.tsx        state skeleton (EumaeState is still empty)
src/store/types.ts         Actor / ActionStamp / SavedItem
src/screens/               one component per tab; index.tsx maps TabId -> screen
src/pages/                 sub-pages pushed onto a tab; index.tsx maps name -> page
src/components/shell/      Header, TabBar, Sidebar (desktop rail), Drawer (phone),
                           Composer, AddSheet (the `+` window), RightPanel,
                           Toast, icons
src/components/settings/   Settings.tsx — the whole overlay
src/styles/tokens.css      design tokens + every component's styles
checks/models.mjs          are the model IDs still served? (asks Google; needs a key)
checks/models.selftest.mjs nine cases over that check, no key
checks/voice.mjs           do the voice's two pure functions still behave? no key
checks/voice.selftest.mjs  eleven cases over that check, ten deliberate breaks
AGENTS.md                  the handoff — read it first: state, decisions, next steps
IDEAS.md                   the owner's idea queue — tracked, not committed
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
- **Two overlays, one shape.** The composer's `+` window opens the same way
  Settings does — a full sheet on a phone, a scrim + modal with a rail at desktop
  width — and renders the very same `.smodal`/`.stabs`/`.spanel`/`.shead`/`.sbody`
  rules rather than a second copy of them. `useMedia('(min-width:900px)')` in
  `src/useMedia.ts` is the one breakpoint the two agree on. It is also where the
  split lives: `+` sets **how** Eumae answers and is the only writer of those five;
  the panel's Context reading holds **what** it is looking at (the chip and the panel
  read the five back). `AGENTS.md` §4.13.
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
- **One voice layer, two halves.** `src/voice.ts` is the mockup's voice in both
  directions: the mic types what you say into the field (continuous recognition,
  half a second of quiet sends it — mockup 1763-1779), and read aloud asks your
  server for one sentence at a time so the first words arrive quickly (1670, 1677).
  The two interlock: while sound is coming out, the mic neither types nor sends.
  The mic is live today, and read aloud is reachable from Settings → Voice → **Play
  sample** — its other door is a reply to read, and nothing replies yet. Both go
  through `/api/ai`, which answers a signed-in caller and nobody else.
- **Signing in is real, and it is the switch for the AI.** `src/auth.ts` (Supabase)
  plus Settings → Account → Security: email and password, create an account, or an
  emailed link. The pane is the screen — no new rail row — and both account cards
  show the address Supabase holds. What it turns on: read aloud sends the token
  with every request, so a signed-in person hears Google's voice instead of the
  browser's. What it does not: chat still does not post, so no reply is behind any
  of this yet. A deployment needs the `VITE_SUPABASE_*` pair as its own variables,
  or the screen says the build has no sign-in configured (`AGENTS.md` §3, §7).
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
5. ✅ The `+` window — its five choices in a pop-up shaped like Settings, with a rail
   row carrying each live value, and a chip row that shows everything that is set
6. ⬜ Sandbox, Studio artifacts, and `/api/ai` wired to the thread (+ the log's second layer)
   — the **voice layer** (mic + read aloud) and the **sign-in screen** have landed inside this
   item; what the thread still needs is the sender. `AGENTS.md` §3, §6, §7.
7. ⬜ The Logs lens — a drill-down and a search in Settings → Logs, over one filter

Items 5-7 come from the owner's own list in **`IDEAS.md`**, which says where each
idea stands and which phase it landed in.

## What's missing

What stands between this and something you could hand to a paying user. None of it
is exotic, and all of it is explained in `AGENTS.md` §8.

- **A CI robot.** Nothing runs the build on push today. About 15 lines of YAML.
- **Tests.** Nearly every check so far was a throwaway script; the ones worth
  keeping are named in `AGENTS.md` §5, and two are no longer throwaways:
  `npm run check:models:selftest` (nine cases) and `npm run check:voice` with
  `check:voice:selftest` — nine verdicts over the real voice functions, and eleven
  cases proving the check can fail. The last two need no key, no network and no
  browser.
- **A linter / formatter** (ESLint + Prettier), so style stops being something
  anyone thinks about.
- **Persistence.** Messages and the activity log both live in memory: a reload
  forgets them, and neither is in an export.
- **The POST.** `src/request.ts` defines the body `/api/ai` will receive, and
  every message already builds and keeps its own — but nothing sends one yet. What
  is left of Phase 6 is the sender: the `fetch`, the streaming reader for
  `chatStream`, and the assistant turn it produces. Read aloud already posts with a
  real token, so the endpoint is no longer the wall it was — sign in, then
  Settings → Voice → **Play sample** is the one place the cloud path runs today.
- **`.nvmrc`.** `.env.example` and errors that name a missing key landed with the AI
  layer, and so did `vercel.json`; this list is down to the one file.
- **An error boundary**, so a crash is a message and not a white screen.
- **No `main` branch** — the default branch is `stage/0-foundation`.

## Working on this repo

Read **`AGENTS.md`** first: current state, locked decisions, gotchas, the exact
next steps, and the production-readiness list. The owner's unscheduled ideas —
and where each one stands — are in **`IDEAS.md`**.

