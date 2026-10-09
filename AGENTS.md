# AGENTS.md — handoff for the next agent

Read this before touching anything. It is the state of the world: what exists,
what is verified, what is decided and why, what is deliberately *not* built yet,
and what to do next.

Repo: `github.com/Josmany5/Eumae` — a solo project. The owner is a designer and
product thinker, not a career engineer: explain trade-offs in plain language,
skip jargon, and never state something as working unless you actually ran it.

---

## 1. What this is

Eumae is one window with six views — **Chat, Console, Studio, Library, Classroom,
Guild** — plus Settings, a right-hand panel, and a desktop rail carrying each
tab's second level of navigation. It is a React 19 + Vite 6 + TypeScript front
end, one server file (`api/ai.ts`, a Vercel function), and a Supabase client
dependency for accounts.

**Stage: pre-alpha (0.1).**

- **Real:** the shell, navigation (rail / drawer / tab bar / pages), Settings (22
  rows, 23 panes), the composer, the `+` menu, the right panel, the theme, and the
  activity log behind Settings → Logs.
- **Not real:** AI answers, accounts, chat persistence, Studio artifacts, any test
  suite, any CI. `src/store/store.tsx`'s `EumaeState` is still an empty interface.

### The culture of this codebase — match it

1. **Comments explain *why*, never *what*.** Read half a dozen before writing new
   ones. The house style is prose that names the bug, the mockup line, or the
   reasoning that produced the decision.
2. **One door per room.** One file input (`App.tsx`), one log writer
   (`src/log.ts`; everything else calls `logEv`), one reader per storage key.
   Twice now a control grew a second way to do the same thing, and that *was* the
   bug. Prefer shared context over a second path.
3. **Never invent data.** Where the mockup shows a fake password, a session list,
   a spend figure or fake log rows, this codebase shows the true state ("Local
   only", "Nothing logged here yet", "No charge today") and names the gap out
   loud. This is deliberate and repeated. Do **not** fill a screen with plausible
   mock data to make it look finished.
4. **Verify before claiming.** `npm run build` must be green (it type-gates).
   Behaviour claims were checked against the **built** `dist/index.html`, not only
   the dev server. Typechecking is not working.
5. **Announce the gaps.** Anything unfinished, unverified or assumed gets said
   plainly rather than glossed over.

---

## 2. Ground truth

### Code map (4036 lines across src/ + api/)

That number is `find src api -type f | xargs wc -l | tail -1` — every TS, TSX and
CSS line under the two directories, counted rather than remembered. It was 3935
before the AI-layer commits, which added 101 lines to `api/ai.ts` and no net lines
anywhere else (`src/request.ts`'s citations were re-pointed in place, which is 14
changed lines and 0 of them new).

| File | Lines | Role |
| --- | --- | --- |
| `src/components/settings/Settings.tsx` | 686 | the whole Settings overlay; also owns `useStored`, export/wipe |
| `api/ai.ts` | 602 | the only server code; Vercel handler |
| `src/App.tsx` | 277 | the shell: tab + page stack + panel + drawers + file input |
| `src/components/shell/AddSheet.tsx` | 323 | the composer's `+` window — the five turn settings, rail + pane |
| `src/request.ts` | 221 | the request `/api/ai` will be handed — the turn as prose, the model as a key |
| `src/components/shell/RightPanel.tsx` | 218 | the right panel (Context / Activity / Studio) |
| `src/useMedia.ts` | 21 | the `(min-width:900px)` hook both overlays read |
| `src/nav.ts` | 135 | `NavContext`: go/back, goTab, panel, `turn`, `refs`, pickFile |
| `src/components/shell/Composer.tsx` | 129 | input row, the chip pills, `+`, paperclip, mic, send |
| `src/components/shell/pageMenu.ts` | 128 | `PAGE_MENU` — each tab's rail rows |
| `src/components/shell/Sidebar.tsx` | 89 | desktop rail |
| `src/log.ts` | 78 | the activity log: `LOG_AREAS`, the one writer, the read |
| `src/pages/SearchPage.tsx` | 70 | the only real sub-page |
| `src/screens/ChatScreen.tsx` | 97 | the only real tab screen; builds each message's request |
| `src/components/shell/icons.tsx` | 73 | the icon registry |
| `src/components/shell/Drawer.tsx` | 65 | phone drawer |
| `src/components/shell/Header.tsx` | 37 | title, hamburger, activity, back |
| `src/components/shell/TabBar.tsx` | 33 | phone tab bar + `TABS` |
| `src/screens/index.tsx` | 28 | `SCREENS` + `LABELS`: TabId → screen |
| `src/pages/index.tsx` | 24 | `PAGES`: name → page + title |
| `src/store/store.tsx` | 23 | context skeleton; `EumaeState` is empty |
| `src/main.tsx` | 17 | mount |
| `src/components/shell/Toast.tsx` | 16 | transient message |
| `src/screens/Empty.tsx` | 15 | shared empty-state block |
| `src/store/types.ts` | 15 | `Actor`, `ActionStamp`, `SavedItem` |
| `src/screens/{Console,Studio,Library,Classroom,Guild}Screen.tsx` | 11 each | stubs rendering `Empty` |
| `src/styles/tokens.css` | — | tokens + all component styles |
| `AGENTS.md` | — | the handoff: state, locked decisions, gotchas, the next steps |
| `IDEAS.md` | — | the owner's idea queue — tracked here, committed nowhere |
| `src/pages/index.tsx`, `src/screens/index.tsx` | — | the two maps that make a new screen/page one row |

### Branches

- **Default branch: `stage/0-foundation`.** There is **no `main`** in this repo.
  The owner thinks of the default branch as "main", so when he asks for work to
  land on main, he means this one.
- **One branch, and it is that one.** `feat/web-shell` mirrored it — a clean
  fast-forward, nothing diverged, nothing to force — until 2026-10-06, when both
  names pointed at the same commit and it was retired, local and `origin`. Push
  to `stage/0-foundation` and nowhere else.
- `backup/pre-rewrite` is **local-only** and stays that way: it is the way back
  from the identity rewrite, so every commit on it predates that rewrite. Never
  push it, and delete it once the scrub is confirmed good.
- The work landed as one commit (`6cb3f4d`) because `tokens.css`, `index.html` and
  `Settings.tsx` each carried two phases of change, so splitting would have left
  commits that don't build.

### Design source — and the trap

```
~/Desktop/eumae-mockup-wove-branch.html    authoritative · 1909 lines · newer (Oct 5 22:01)
~/Desktop/eumae-v12-mockup.html            older snapshot · 1621 lines · (Oct 5 19:42)
```

- Both files carry identical line numbers for every anchor the code cites
  (`PGF.settings` at 1035 / 1210 / 1436; `pD` at 847 / 1112 / 1197 / 1296 / 1446 /
  1515), so `wove-branch` reads as a superset. **`pageMenu.ts` names
  `wove-branch` explicitly** — treat that one as the reference.
- Both live **outside the repo and are untracked.** So cite the file name *and*
  line number in any comment you write, exactly as the existing code does.
- **The trap, already paid for twice:** these files redefine the same functions
  many times and **only the last definition is live**. `PGF.settings` appears 3×
  and `pD` 6×. The project lost time reading the dead `pD` at line 242 ("Pinned
  project", "Customize") while the live one is at 1515. Before trusting any
  function, `grep -n` for *every* definition and take the last occurrence.
- Open questions for the owner: whether to copy `wove-branch` into the repo (e.g.
  `design/`) so it is versioned — note it contains his real name and email, so that
  depends on whether the repo is public.

### Environment

- Node 24.x (`engines`), Vite 6, TypeScript 5.8 with `strict` plus
  `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` — an
  unused import is a build failure. React 19.
- `npm run build` = `tsc --noEmit && vite build`. Types gate the build.
- `npm run dev` does **not** serve `api/ai.ts`; that needs `vercel dev` or Vercel.
- No test runner, no ESLint/Prettier, no CI. Verification is manual today (§5),
  with two exceptions that are real files: `.env.example` names the four keys the
  server reads, and `npm run check:models:selftest` runs one committed check with
  no key and no network.
- Verified good at `6cb3f4d`: 53 modules, 3.54s, `dist/index.html` 1.65 kB,
  CSS 22.95 kB, JS 269.63 kB (82 kB gzipped).
- The build regularly exceeds a 30-second tool timeout in-session: launch it with
  `nohup npm run build > /tmp/eumae-build.log 2>&1 &` and poll the log.

### Git conventions

- Subjects are descriptive prose, not Conventional Commits. Real examples:
  `Shell: web app layout (rail + content), tighten scale, router renders screens into #mn`
  and `Revert desktop docked-sidebar experiment: back to the original 520px column…`.
  Lead with the area, then say what changed.
- Long commit bodies are welcome and were used for the big landing commit.
- History is worth preserving with intent: rewriting the default branch is fine
  when asked, but always say what it will do *before* doing it.
- The remote redirects `eumae` → `Eumae` (capitalisation); harmless.
- Commits use the GitHub **noreply** identity — `Josmany5 <189303011+Josmany5@users.noreply.github.com>`
  — set in this repo's local `.git/config`. A clone on another machine must set it
  again before committing: the repo is public, so never commit from a personal address.
- History was rewritten once, to strip the owner's real email. The details are in the
  note at the end of this file; the short version is that hashes from before that day
  are dead.

---

## 3. What exists today, piece by piece

### Shell — `src/App.tsx` (277), `src/nav.ts` (133)

`App` owns: the active tab, the page stack, rail-collapsed, drawer-open,
settings-open, the toast, the panel (open + view), `refs` (attached items), the
add sheet, `turn`, and the single `<input type="file">`.

`nav.ts` is the app-wide context reached by `useNav()`:
`go/back/depth/goTab/openSettings`, `panelOpen/panelView/togglePanel/openPanel/closePanel`,
`openAdd`, `refs/detach`, `turn/setTurn`, `pickFile`. `PanelView = 'context' |
'activity' | 'studio'`. `Turn = {mode, role, skill, thinking, model}` with the
mockup's opening values in `DEFAULT_TURN`, and `Ref = {label, icon, url?}` — moved
here from `RightPanel` in Phase 3, because the panel is no longer the only reader
of that list: the send path is one too (§3, *the request*), and a prop cannot
reach it.

**Fixed in Phase 4:** `App.tsx:219` — the header's activity button called
`openPanel('context')` while meaning *activity*. It opens the panel's Activity
reading now, and its `aria-label` in `Header.tsx` changed from "Context" to
"Activity" with it, because a label that names the wrong room is its own defect.

### Screens — `src/screens/`

- `ChatScreen.tsx` (93) is the only real one: a local `msgs` array, four greeting
  chips, and `send()` that appends a **user** bubble. There is no assistant reply
  and no backend. It also infers the mode from the prompt text (two regexes,
  mockup line 878): "make/build/create/draft/write me/design" → Build,
  "learn/teach me/explain/how does/what is a" → Learn. An ordinary ask leaves the
  mode alone. Since Phase 3 each message also carries the **request** it was sent
  with — `buildRequest(turn, refs, text)`, from `src/request.ts` — composed after
  the mode moved, so the turn, the attachments and the text are frozen together
  at the moment of sending.
- Console / Studio / Library / Classroom / Guild are 11-line stubs rendering
  `Empty` (eyebrow / title / note). Placeholders, not designs.
- `index.tsx` holds `SCREENS` and `LABELS` — the only place a tab learns what it
  renders.

### Pages — `src/pages/`

- `PAGES` has exactly one entry: `search`. `pageTitle()` derives the header title.
- The page stack, the desktop back bar and the mobile back button are real and
  working — there is just nothing much to navigate to yet.
- `SearchPage.tsx` (70) searches the app's **genuine** destinations (the six tabs
  + Settings), filters by name, and opens them; it grows for free as tabs and
  pages land. It is the model for what a page looks like.

### The log — `src/log.ts` (78)

One module, one writer. `LOG_AREAS` (the `All` view plus the six tabs, Library
included), `LogEntry` (`{ id, area, text, ts, status }` — the id is the writer's
counter, so a list has a stable key), `logEv(draft)` as the *only* thing that
appends, `logAll()`, and `useLog(area)` over `useSyncExternalStore`. No provider:
the log sits at module scope because its readers are not each other's parents.
`status` is the mockup's dot (CSS 115–116) re-named for what it claims — green
happened, amber waiting, red failed.

Who writes today: a message sent (`ChatScreen`), a file attached or detached
(`App`), a pick in the `+` menu ("Set mode to Build"). Opening a page is
deliberately *not* logged, and that writer was removed rather than patched: the
only page that exists is opened by the shell, so filing it under the current tab
wrote a row about a tab that did nothing (§1.3). It is memory only, and the pane
says that out loud.

### The request — `src/request.ts` (220)

The turn's five settings are written by the `+` menu and read back by the chip.
This file is the other half of that contract: what they *become* when a message is
sent. It is new in Phase 3, and it exists because both ends had already decided
the shape without either one saying it out loud.

- The mockup builds the request at line 1872:
  `{action:"chatStream",data:{systemPrompt:PROMPT+directives(),conversationHistory:hist,message:apiMsg,functionDeclarations:TOOLS}}`.
  So the settings do **not** travel as five fields: `directives()` (1644-1661)
  turns them into a prose block appended to the system prompt — the mode's own
  clause, the role, the skill, and the one thinking line that asks for brevity or
  care (Balanced asks for neither, which is what makes it the default rather than
  a third instruction).
- The server reads `{ action, data }` (ai.ts:178) and, for `chatStream`, exactly
  `systemPrompt / conversationHistory / message / attachments /
  functionDeclarations / model` — and nothing else, *silently*.
- Which is what made writing it down worth doing: `model` is the trap. The chip
  shows `Fast`/`Best`, the server's table (ai.ts:62) is keyed `lite`/`best`, and an
  unrecognised key is not an error there — it is the default. `modelKey` is the
  only place that translation happens, and `Auto` sends no key at all (the mockup
  does the same, 1874): with two entries in the table, Auto and Fast resolve to
  the same model today, so "The router picks" is still a promise and the file
  says so.
- Our two role names must not travel either. The server maps everything that is
  not exactly `user` to `model` (ai.ts:77) — so `historyOf` translates `you` and
  `eumae`, or the person's own sentences come back to the model as Eumae's.
- `BASE_PROMPT` is written fresh instead of copied: the mockup's paragraph (1626)
  names the owner, and this repo carries no real name (§3). Same job, nobody's
  name in it, same admission that the thread cannot yet act inside the app.
- `refsToAttachments` sends only what has bytes — a data URL, which today means a
  photo. A PDF ref is a label and an icon (`App.tsx:96` stops at
  `!file.type.startsWith('image/')`), so it is skipped rather than sent empty; the
  mockup's "What is in this document?" path waits for the file work in Phase 6.
- `buildRequest` snapshots rather than points (`refs` is copied), and
  `ChatScreen.send` then calls `toApiBody` on it and keeps the **body** on the
  message, so a later pick in `+` cannot rewrite how an earlier message was asked.
  That is also why the module is not a dead letter: built-but-uncalled it was
  tree-shaken out of `dist` completely — `grep -c 'CHAT SETTINGS' dist/assets/*.js`
  returned **0** — and with the body built on every send it is in the bundle,
  exercised on the real turn, the real refs and the real thread. Its two
  deliberate absences are visible in that same grep: no `gemini-*` id (the client
  sends a *key*, the server maps it) and no "What is in this document?" (the
  attach-only branch we do not need yet).
- **Still unwired, deliberately:** nothing *posts* the body. The fetch, the SSE
  reader and the auth screen are Phase 6 (§7). §5 check 6 is what keeps the
  mapping correct in the meantime.

### Settings — `src/components/settings/Settings.tsx` (696)

An overlay (`open` / `onClose` / `notify` props): a rail of rows in five groups
(Eumae, App, Account, Data, Support), 22 rows → 23 titles → 23 panes. The extra
title is `main`, the mobile root list (account card plus the same rows), which no
rail row points at because on desktop the rail sits beside the pane. The titles
map is at line 19. The Logs areas are not kept here — `LOG_AREAS` lives in
`src/log.ts` (see the log subsection above), which is the point of it.

It also owns storage: `useStored` (line 56), `exportData` (writes one JSON file of
every `eumae:` key) and `wipeData` (deletes them). Keys in use: `mems`, `grants`,
`autos`, `theme`, `voice`, `notif`, `skill-websearch`, `personalization`, `a11y`.

Added in the phase just landed: **language, accessibility, billing, security,
logs, legal, about** — that phase also gave export its own pane, which was folded
back into Data controls afterwards (§4.11).

What is real versus named-out-loud-gap:

| Pane | Behaviour |
| --- | --- |
| Appearance, Voice, Notifications, Language, Accessibility, Personalization | genuinely write state |
| Billing | "No charge today"; Model spend lives in Usage, shown never blocking |
| Security | "Signed in as: This device", "Local only", "there is no password to leak" |
| Data controls | really downloads the JSON as one file (Export my data); Restore notifies "arrives in a later stage"; Delete everything wipes and reloads |
| **Logs** | real: the seven `LOG_AREAS` pills filter `src/log.ts`, newest first. Each row is a status dot, the sentence, then `area · time`. Empty until something happens, and the pane says so in its own words |
| Legal | three rows, each notifying "publishes with the first release" |
| About | Version / Stage / Your data |

**Personal data:** the two account cards (desktop rail, phone) render an `ACCOUNT`
constant at the top of the file — a placeholder, because there are no accounts yet,
and the avatar is derived from `ACCOUNT.name` so the two cards cannot drift. The
owner's real name and email used to be hardcoded here; they were removed once the
repo turned out to be **public** and the app deployed. Never write a real name or
address into this file again.

### Right panel — `src/components/shell/RightPanel.tsx` (181)

One panel, three readings — Context / Activity / Studio — behind a `TABS` row in
`.pHead`, a body per reading, a corner `.pHandle` button when closed and a
`.pscrim` when open. `refs` and `detach` come from `useNav()` as of Phase 3 (they
were props): this panel is one of two readers of that list, and the other one is
the send path, which no prop can reach.

- **Context** lists real `refs` (from the paperclip) and then a **static**
  "Always in context" list (Your projects / Today & this week / Recent
  conversations) — that second list is furniture, not data, and should be driven
  or labelled.
- **Activity** is the log's second reader: `useLog()` with no area, so these are
  the same rows Settings → Logs filters by pill, drawn with the same `.hi`/`.dt`
  classes, because two drawings of one log is how the two drift. The header's
  clock button opens the panel straight onto it.
- **Studio** is one honest empty ("Nothing built yet") rather than two. It absorbed
  the old Code and Preview readings, which held two versions of nothing with no
  artifact between them; the single reading now names the sandbox Studio produces
  into.

Phase 4 rebuilt this file — the readings changed, the pill row survived.

### The rest of the shell

- `Composer.tsx` (129): the chip row — **one pill per setting that is not at its
  default** (Phase 5; mode is always there), every pill read-only and opening the
  `+` window — then `+` (openAdd), the auto-growing textarea, the paperclip
  (`pickFile`), **the mic (inert — no handler)**, send. A lone `/`
  opens the window (mockup line 1278). Enter sends, Shift+Enter newlines.
- `AddSheet.tsx` (322): the composer's `+` **window** — the five sections that
  decide *how* Eumae answers (Mode, Role, Skill, Thinking, Model) and nothing else
  since Phase 5 (§4.13). A phone gets a full sheet listing them, each row carrying
  its live value; a desktop gets a scrim + modal built from Settings' own skeleton,
  whose rail *is* that list. Picking closes the window.
  `ROLES = ['Default','Coach','Teacher','Sparring partner']` are the mockup's
  ROLEDEF; user-created roles arrive with Studio. It replaced the bottom sheet of
  five stacked sections, and `Sheet.tsx` with it — that window was its only user.
- `Sidebar.tsx` (89): Search, the six tabs, `PAGE_MENU[active]`, Settings at the
  foot. Collapsing is CSS-only.
- `Header.tsx` (37), `TabBar.tsx` (33, also exports `TABS`), `Drawer.tsx` (65),
  `Toast.tsx` (16), `icons.tsx` (73 — six icons came in Phase 1: globe, acc, bill,
  shield, arch, law).
- `useMedia.ts` (21): the `(min-width:900px)` hook, read by Settings and by the `+`
  window so the two overlays cannot disagree about which shape they are in.

### Server — `api/ai.ts` (602)

One default-exported handler: `OPTIONS` → CORS preflight, anything but `POST` →
rejected, and the caller is authenticated (Supabase URL + anon key) *before*
`GEMINI_API_KEY` / `GOOGLE_CLOUD_TTS_KEY` are read. **Nothing in the UI calls it
yet**, and there is no auth screen — so today a real call would be rejected by
design.

- **A failure answers as a failure.** Five endings used to fail and still answer
  `200` as though they had not — `speak` with no TTS key, a TTS reply carrying no
  audio, a refused TTS request, a refused `chat`, and a stream cut off
  mid-sentence. They are 501/502 with one sentence each (`UPSTREAM_ERROR`,
  `EMPTY_REPLY`, `SPEAK_FAILED` at the top of the file) and **never the provider's
  own words**: Google's error body names endpoints and request ids and is written
  for whoever holds the key, so it goes to the function log and not into the
  reply. A stream that opened and then failed says so *inside* the stream, as an
  `error` event ahead of `done` — a reply that stops mid-sentence must not read as
  a reply that finished.
- **CORS answers own origins only.** `*` beside `Allow-Credentials: true` is
  contradictory and browsers reject the pair outright, and the old header list
  never named `Authorization` — the one header this endpoint exists to receive, so
  cross-origin sign-in could not have worked. An origin is answered when it is
  this host or localhost, with `Vary: Origin`, and the list is
  `Authorization, Content-Type`.
- **The three model IDs are ones Google actually serves**, which they were not:
  `best` was `gemini-2.5-flash`, a model Google limits to accounts that used it
  while it was current, so `Best` would have failed for a new deployment while
  `Auto` and `Fast` worked. `npm run check:models` is what keeps this from
  recurring (§5.8); the table's own comment carries the dates.
- `vercel.json` gives the function `maxDuration: 60`: a stream still being written
  is not a slow request to be cut off.

### Styles — `src/styles/tokens.css`

Design tokens plus every component's styles in one file, class-named per component
(`.sb*`, `.cmp*`, `.p*`, `.ftabs`, `.sg`, …). No CSS-in-JS, no framework.
`html[data-motion="reduce"]` flattens transitions (Accessibility).

---

## 4. Locked decisions (with the reason — don't relitigate without cause)

1. **Library is a log area.** `LOG_AREAS` lives in `src/log.ts`, in tab-bar order,
   with `Library` in it — the mockup's own filter row (line 1434) left that one
   out. Filing and publishing events log to `Library`, which is what makes it the
   most audit-worthy of the six. Settings imports the list instead of keeping a
   copy: a second copy is how a filter starts silently dropping rows.
2. **One activity log, one writer.** `src/log.ts` exists: `logEv({ area, text })` is
   the *only* thing that writes an entry, and it stamps the time and owns the id,
   so no component can invent either. Readers use `useLog(area)`. Two are wired:
   Settings → Logs (filtered by pill) and the panel's Activity reading (the whole
   list, Phase 4). Console's Activity card reads that same list when Console is
   built. Neither gap was faked in the meantime — no component invents its own log.
3. **Two doors, two jobs** (a bug forced this rule): `+` sets the chat up
   (Mode/Role/Skill/Thinking/Model + Context) and never attaches; the paperclip
   attaches a photo or PDF into this message. The composer's third door, `ctx`,
   was retired to match the mockup's row, so what's attached is read back in the
   panel — which the rail header and the phone header open. Attaching must not
   open the panel: that was the bug when two controls shared one room.
   **Amended 2026-10-06, landed in Phase 5 (§4.13):** the Context half of `+` is
   retired — attaching is the paperclip's job (and the rail's "Attach an item" row,
   which opens the same input), and a project scope has a door of its own again
   (§4.7) — so this now reads "`+` sets how Eumae answers" and nothing else.
4. **One file input.** `App.tsx` renders the only `<input type="file">` and
   `pickFile()` in the nav context opens it. Never add a second picker.
5. **Theme lives in the `eumae:` namespace and boots pre-paint.** `main.tsx` has no
   `initTheme` any more; the inline script in `index.html` is the only reader and
   Settings the only writer, through `useStored('theme', …)`. Accepted
   consequence: "Delete everything" clears the theme, so a reload falls back to
   the OS preference.
6. **Honest empties over plausible fakes.** §1 rule 3. The pattern is already in
   the code in a dozen places — keep adding to it, don't break it.
7. **`PAGE_MENU` comes from the last `pD`.** "Scope to a project" was dropped
   deliberately (it only ever called `goPage('projects')` and scoped nothing);
   Console's menu is "Full pages"; "New chat" is chat-scoped, not global; the
   Events row was added on purpose.
   **Amended 2026-10-06, landed in Phase 5:** that reason expired under §4.13 —
   the row was dropped *because* the `+` menu held it, and `+` lost it — so the
   rail's Context group is `Attach an item · Scope to a project` again. Until a
   project is real the second row still scopes nothing and toasts like the other
   ~40 unbuilt rows, because a labelled row beats no door.
8. **About and Legal are real pages.** The mockup left About as a
   `toast('Eumae 0.8')`; the rail row exists, so it opens a page.
9. **Mode is inferred from the prompt** (two regexes in `ChatScreen.send`) until a
   router exists — the mockup does the same at line 878, and the chip has to keep
   up with what the mode actually is.
10. **Onboarding/`+` choices are made, not stored per-chat.** `turn` is one piece
    of state in the nav context: the `+` window is its only writer, and the chip
    row and the panel's Context reading both read it back, so the ends cannot
    disagree (§4.13 — this is the "one writer each" rule in miniature).
11. **Data controls is the one data room** (merged after Phase 1). The mockup's
    Account row "Export and backup" and its Data row "Data controls" both call
    `goPage('sDat')` — one pane behind two doors
    (`eumae-mockup-wove-branch.html:1436`, the live settings list; the pane it
    lands on is `pgSDat` at 696). This codebase keeps one door: the second rail row
    is gone, and the backup card that used to sit behind it lives in Data controls
    beside the export action it described. Putting the alias back is §9's
    double-writer bug, in the rail.
12. **The request shape is written down once, and a model label is not a model
    key.** `src/request.ts` owns what a sent message becomes, because two facts
    had been settled by two different ends without either saying so: the settings
    travel as *prose* inside `systemPrompt` (`directives()`, mockup 1644-1661,
    composed at 1872) rather than as five fields; and the chip's `Fast`/`Best` are
    not the server's keys (`lite`/`best`, `api/ai.ts:62`) — an unrecognised key
    there is not an error but a silent fallback to the default, so sending our
    labels would quietly hand you a different model than the one you picked.
    `Auto` sends no key at all. §5 check 6 scans the server for its own table and
    its own read list, so the two ends cannot drift apart unnoticed. `Ref` moved
    into `nav.ts` in the same phase, because `refs` gained a reader — the send
    path — that props cannot reach; the panel reads it from `useNav()` now.
13. **Behavior vs focus — one writer each** (the owner's split, 2026-10-06).
    `+` sets *how* Eumae answers (Mode/Role/Skill/Thinking/Model) and is the only
    writer of those five; the panel's Context reading holds *what Eumae is looking
    at* (attachments, a project scope, what is always in context) and is the only
    writer of those. (Where a scope is *chosen* is the rail row §4.7 revived; it is
    inert until a project screen exists, and it must not become a second writer.)
    The chip and the panel both **read** the five back — the chip as the glance, the
    panel in full — and neither writes them. This is §1 rule 2 at the feature level,
    and it is why the ask that sounded contradictory is not:
    everything the picker sets shows as chips *and* in the panel, while the panel's
    attach controls leave the picker entirely. It **amended §4.3** (the `+` menu's
    Context half is retired) and **revived the rail row §4.7 dropped** — both in
    Phase 5, which is where the five became one window with a rail, the chip row
    grew past mode · role · skill, and the panel gained its read-only block. The
    same axis is what the log's facets will name — you × Eumae, thinking × doing —
    so both ends of a turn can say who acted instead of assuming it. Full queue,
    with what is still open on each, in `IDEAS.md`.

---

## 5. How to verify (do it this way)

**Primary gate:** `npm run build` — types, then bundle. Green looks like
55 modules transformed and `dist/index.html` + `dist/assets/index-*.css|js`.
Background it (`nohup … &`) and poll; it often exceeds a 30-second tool timeout.

Checks 1-3 were used for the phase that landed before Phase 2, and checks 4-8 for
the work since. Checks 1-7 were hand-run scratch scripts and are **gone** — for
those this is the recipe to rebuild them, and the strongest argument for a test
suite. Check 8 is the exception: it was worth keeping, so it is in the repo.

1. **Rail ↔ title ↔ pane integrity.** 22 rail rows ↔ 22 of the 23 titles in the
   titles map ↔ 23 `view === '…'` panes (the extra title and pane are `main`).
   Express as a unit test over the row data plus a source scan; it is the check
   that would have caught a drift the moment it happened.
2. **Theme boot, nine cases**, run against the **built** `dist/index.html`:
   `eumae:theme` = `"light"` / `"dark"`, a bare unquoted `light` (pre-JSON values),
   `null`, garbage, a value containing a `"`, and no OS preference at all —
   asserting `document.documentElement.dataset.theme` each time. Rationale: the
   boot script is the only thing that runs before React, so it needs its own tests
   and its own test *method*.
3. **SSR render check.** `renderToStaticMarkup` from `react-dom/server` over the
   settings overlay to assert the boot value reaches the Appearance row with no
   browser involved. `useLog` passes `logAll` as its server snapshot so this keeps
   working now that the Logs pane reads the log.
4. **One log writer** (added in Phase 2). `grep -rn 'logEv(' src` should show the
   definition plus one call site per event and nothing else, and `entries =`
   should appear only inside `src/log.ts`. Same shape as check 1: a source scan for
   the rule this codebase keeps re-learning (§9).
5. **The panel's three readings** (added in Phase 4). Render `RightPanel` through
   `renderToStaticMarkup` once per reading and assert: the three tabs, `Activity`
   selected, the activity rows newest-first carrying their dot and `area · time`,
   Studio's empty state naming the sandbox, and Context still listing real refs.
   Run it twice — with rows and with an empty log, because the empty branch is the
   one a fresh session hits. Since Phase 3 `refs` and `detach` arrive through
   `NavContext`, not props, so wrap the render in `NavContext.Provider` with a
   stand-in `Nav` (refs, a no-op `detach`, `DEFAULT_TURN`) — otherwise you render
   the default context, where the list is always empty and the check quietly
   proves nothing. `useLog` passes `logAll` as its server snapshot, so
   this needs no browser. Bundle the scratch file with the repo's own esbuild
   (`node_modules/.bin/esbuild … --bundle --platform=node --jsx=automatic`) and
   `node` the output; `tsx` is not a dependency.
6. **The request's shape** (added in Phase 3). `src/request.ts` imports only
   types, so it bundles by itself and needs no DOM:
   `./node_modules/.bin/esbuild src/request.ts --bundle --format=esm --outfile=/tmp/req.mjs`,
   then `node` a scratch `.mjs` importing `/tmp/req.mjs`. 45 assertions ran; the
   two that matter most are source scans of `api/ai.ts` **itself**, which is what
   stops them passing vacuously — every key `modelKey` can produce must appear in
   the server's `MODEL_IDS` literal, and every key `toApiBody` can emit must
   appear in the server's `chatStream` read list (extract it by slicing from
   `action === 'chatStream'` to `action === 'speak'` and collecting the
   destructuring on the left of `= data as {`, plus `model`). The rest pin: the
   mockup's wording (three mode clauses, the `CHAT SETTINGS` header, the always-on
   visual line, Balanced adding nothing, `role: ''` adding no Role line, a set role
   or skill adding one), `you`/`eumae` → `user`/`model`, the 24-turn window and its
   ordering, omit-don't-null for `model` / `attachments` / `functionDeclarations`,
   `Auto` sending no key while `Fast`/`Best` send `lite`/`best`, a data-URL ref
   becoming `{mimeType,data}` while a url-less PDF ref is skipped, `buildRequest`
   copying `refs` instead of referencing them, and `BASE_PROMPT` carrying no real
   name. One thing it proves cheaply *because* `ChatScreen.send` calls
   `toApiBody`: `grep -c 'CHAT SETTINGS' dist/assets/*.js` is at least 1. It was
   **0** while the module existed but was uncalled — tree-shaking, not a bug — so
   that grep is also the fastest way to notice the module has gone unreachable
   again.
7. **The turn window and the chip row** (added in Phase 5). Bundle a scratch TSX
   with `./node_modules/.bin/esbuild <file> --bundle --platform=node --jsx=automatic
   --outfile=/tmp/x.cjs` (`--format=esm` fails: `react-dom/server` is CJS and its
   `require('util')` has no ESM shim), stub `window.matchMedia` to answer for the
   width you are testing, and render `AddSheet`, `Composer` and `RightPanel`
   through `renderToStaticMarkup` inside a `NavContext.Provider` with a stand-in
   `Nav`. 28 assertions ran, 0 failures. It pins: the desktop window renders
   Settings' own skeleton (`.stabs` + a pane) with five rail rows carrying
   Ask / Default / Balanced / Auto and opens on Mode; the phone window renders the
   list of five instead, with no rail, and keeps its title and tip; no row attaches
   or scopes any more; the chip row is one pill at the defaults and four when four
   are set, with Thinking and Model appearing for the first time; and the panel's
   Context reading carries five `.kv` lines and a block with no `<button>` in it —
   read-only — plus an empty state that names the paperclip rather than `+`. One
   assertion earned its keep: the first run failed on "opens on Mode", a real
   one-frame empty pane on desktop, fixed by seeding the view state from the width
   instead of from `'main'`. Then the built output, as a second opinion:
   `grep -c` in `dist/assets/index-*.js` finds `addWin`, `How Eumae answers` and
   `Scope to a project` once each and `Attach a file` zero times, and the CSS file
   carries `.addWin` with no `.shGroup`/`.sheetBody` left.

8. **The models are served** (added with the AI layer). The only one of the eight
   that is committed, and the cheapest to run: `checks/models.mjs` reads every
   quoted `gemini-*` ID out of `api/ai.ts` (plus any `models/<id>:generateContent`
   URL), asks Google which of them it serves for `generateContent`, and exits **1**
   if any ID cannot answer, **2** if there is no key to ask with, **0** if all are
   served. `npm run check:models` needs `GEMINI_API_KEY` — either
   `vercel env pull .env.local && set -a && . ./.env.local && set +a` first, or
   export it (the keys live in Vercel; nothing local has them). Without it the run
   still prints the three IDs it *would* have asked about, which is the useful
   half. `npm run check:models:selftest` needs nothing at all: nine cases over the
   two pure parts (`idsIn`, `judge`), including the ones that would have caught the
   real defects — an ID surviving only in a comment, a hard-coded literal beside
   the table, and an ID that is listed but not for `generateContent`. Run it when a
   model is added and after any Google retirement notice; none of the other seven
   checks covers this, and its failure mode is a reply that never arrives.

**Never claim a UI behaviour works because it typechecks.** Build it, and open
`dist/index.html` or `npm run preview` when the claim is visual.

There is no headless-browser dependency in this repo, but Chrome is installed on
this machine, so a visual claim *can* still be checked without a person in the
loop: serve the build (`python3 -m http.server 8099 --directory dist`), start
Chrome with `--headless=new --remote-debugging-port=9222`, and drive it over the
DevTools protocol from a throwaway node script — Node 23 carries `WebSocket`, so
there is nothing to install. `Emulation.setDeviceMetricsOverride` sets the width
(which is what makes `useMedia` switch shapes), `Runtime.evaluate` clicks, and
`Page.captureScreenshot` writes a PNG you can look at. That is how Phase 5's three
surfaces were checked; kill both processes afterwards.

---

## 6. The plan — seven phases, five done

Locked with the owner. The order matters: each phase removes a lie before the next
one adds a feature. Phases 1-5 are landed. Phases 6-7 come from the owner's own
queue, tracked entry by entry in `IDEAS.md`, and are written out here once an
entry became work.

**Phase 1 — Settings caught up to the mockup. ✅ Done.** 24 rows, 8 new panes
(language, accessibility, billing, security, export, logs, legal, about), the
Account group, `LOG_AREAS` including Library, six icons, `.ftabs` and the
reduce-motion rule. The export pane was folded into Data controls afterwards and
its row removed, so the rail is 22 rows today (§4.11).

**Phase 2 — `src/log.ts`. ✅ Done.**

- `src/log.ts` (78): `LOG_AREAS`, `LogEntry` (`{ id, area, text, ts, status }` — the
  id is the writer's counter, so a list has a stable key), `logEv(draft)` as the
  single writer, `logAll()`, and `useLog(area)` over `useSyncExternalStore`. No
  provider and no context: the log lives at module scope precisely because its
  readers are not each other's parents, so nothing had to be prop-drilled for it.
- `LOG_AREAS` moved here and `Settings.tsx` imports it — the two copies became one.
- Writers, all of them real events: a message sent (`ChatScreen`), a file attached
  or detached (`App`), and a pick in the `+` menu — "Set mode to Build", same for
  role, thinking and model. **Tab switches are deliberately not logged:** a tab is
  a screen, and five of the six still have nothing to say. Their areas fill in as
  those screens gain behaviour, which is the rule the original phase asked for.
- **A page open is not logged either** — that writer was removed, not patched.
  Its first version filed `Opened ${pageTitle}` under `AREA_OF[tab]`, which was
  wrong for the only page that exists: `search` is opened by the shell, not by a
  tab, so standing on Guild wrote "Guild · Opened Search" about a tab with no
  features. A row for an action that did not happen is the one thing §1.3 forbids.
  `AREA_OF` is deleted with it; both return when a page carries the tab it belongs
  to (then `Record<TabId, LogFiled>` is the right type for the job it did here).
- One of the three readers is wired — Settings → Logs, filtered by the pill you're
  on. The panel's Activity zone waits for Phase 4's rebuild and Console's Activity
  card waits for Console: both read the same `useLog`, so wiring them later is
  reading, not rebuilding. Building them now would have meant designing two
  surfaces this plan already owns.
- **The cost of that, named:** the log is write-mostly and nearly invisible today —
  its rows are readable in one place, three taps into Settings, while the header's
  clock button (the mockup's own way in, line 164) still opens Context. Everything
  it records, it records where nobody is looking. Phase 4's Activity zone is what
  makes the log visible on every screen, and until then this phase is a writer with
  no audience.
- Persistence: memory only, on purpose. Storing it would put a growing list inside
  every export and inside "Delete everything", so the pane says out loud that rows
  live in this session.
- Verified: build green at 54 modules (one more than before — this file), CSS
  23.13 kB, JS 270.15 kB; `dist/assets/*.css` carries `.hi`, `.dt` and the three
  dots; `grep` says `logEv` has one definition and four call sites (the fifth was
  the page-open writer, removed below).

**Phase 3 — the `+` menu's turn window. ✅ Done.**

- The missing half was the contract, not the UI: the five sections and `setTurn`
  already existed, and what they *become* on send lived nowhere.
  **`src/request.ts` (220)** now owns it — `TurnRequest` (the shape this phase
  named), `buildRequest`, `directives()`, `modelKey`, `refsToAttachments`,
  `historyOf`, `toApiBody`.
- Two of its decisions were read off the two ends rather than invented: the
  settings travel as prose inside `systemPrompt` (mockup 1644 composed at 1872,
  not five fields), and the model travels as the server's *key* (`lite`/`best`)
  because its table falls back silently on anything else. Locked in §4.12.
- `BASE_PROMPT` is written fresh: the mockup's own paragraph (1626) names the
  owner, and this repo carries no real name (§3).
- Plumbing the shape required, and nothing beyond it: `Ref` moved from
  `RightPanel` to `nav.ts`, and `refs`/`detach` joined `NavContext`, because the
  send path is a second reader of the attached list and no prop can reach it. The
  panel reads them from `useNav()`; App passes neither any more.
- `ChatScreen` builds the **body** for each message and keeps it on the message,
  composed after the mode moved — so a later pick in `+` cannot rewrite how an
  earlier message was asked. This was not the first shape tried: the module was
  written and left uncalled, and Rollup tree-shook all of it out of `dist`, which
  meant its only proof of life was a scratch script. Building the body on send is
  what makes it real, and the bundle shows it (`CHAT SETTINGS`, `chatStream`).
- Verified: `npm run build` green at **55 modules** (one more — this file), CSS
  23.13 kB unchanged, JS 272.57 kB (its 1.6 kB is the request module's real
  weight, now that it is not tree-shaken); `dist/assets/index-*.js` carries `CHAT
  SETTINGS` and `chatStream` and does **not** carry `gemini-3.5-flash-lite` or
  "What is in this document?" — the two things that belong to the other end; §5
  check 6 ran **45 assertions, 0 failures**, then was deleted. Both anti-drift
  assertions were shown to have teeth: the scans extract `['lite','best']` from
  `MODEL_IDS` and exactly six keys from the `chatStream` branch, so a renamed key
  fails the check instead of passing it.
- **Handed on, not dropped:** nothing posts the body yet (the fetch, the SSE
  reader and the auth screen are Phase 6 — named in §7); and Thinking/Model are
  still invisible on the chip, which is Phase 5's own item.

**Phase 4 — panel rebuild. ✅ Done.**

- `App.tsx:219`: `openPanel('context')` → `'activity'`, and the header button's
  `aria-label` (`Header.tsx`) changed from "Context" to "Activity" with it.
- `PanelView` is `'context' | 'activity' | 'studio'` (`nav.ts`). The owner chose
  **tabs, not one stacked scroll**: the three answers are exclusive, so switching
  beats stacking a growing log under a fixed list — and the mockup, which has no
  panel at all, never tabs one.
- The pill row **stayed**; the readings changed. Code and Preview merged into
  Studio (one honest empty naming the sandbox) instead of the row being deleted:
  two tabs holding two versions of nothing was the defect, not the row. Their
  `code` / `eye` glyphs stay in the registry, drawn and unread, for Phase 6.
- Activity reads `src/log.ts` through `useLog()`, wearing the same `.hi`/`.dt`
  classes as Settings → Logs: one list behind two doors.
- **This closes Phase 2's named cost.** The log had one reader three taps into
  Settings; the clock button now opens it from any screen, and the panel's own
  line says it is this session only and where to filter by area.
- Still open here: "Always in context" is furniture and should be driven or
  labelled; Studio's sandbox is still an empty.
- Verified: build green at 54 modules, CSS 23.13 kB, JS 270.79 kB; a throwaway
  SSR check (15 assertions with rows, 12 against an empty log) rendered all three
  readings and passed, then was deleted.

**Phase 5 — the turn window, and chips that tell the truth. ✅ Done.**
Two halves of one change, from `IDEAS.md` I1-I4, under §4.13.

- **`+` is the window Settings already is.** `useMedia('(min-width:900px)')` — moved
  out of `Settings.tsx` into `src/useMedia.ts` so the two overlays read one
  breakpoint instead of two copies — picks the shape: a full sheet on a phone, which
  lists the five sections; a scrim + modal at desktop width, whose rail *is* that
  list. Only the container is new (`.addWin`, z-49): the rail, head, body and pane
  are Settings' own `.smodal/.stabs/.stab/.spanel/.shead/.sbody` rules, shared on
  purpose rather than copied, so the two overlays cannot drift apart. Each rail row
  carries that setting's live value (Ask / Default / — / Balanced / Auto), which is
  what keeps the window one screen tall. The bottom sheet of five stacked sections
  went, and `Sheet.tsx` with it: `+` was its only user, so it was dead the moment
  the window changed shape.
- **`+` stopped attaching** (§4.3). Its Context section is retired; "Attach a file…"
  went with it, and so did `App.tsx`'s `openAddPage('projects')` branch — the moment
  nothing called it, it was unreachable code. The rail's Context group is
  `Attach an item · Scope to a project` again (§4.7). "Attach an item" now calls
  `pickFile()` — the same one input the paperclip opens (§4.4) — instead of opening
  a window that can no longer attach anything.
- **The chip row tells the truth** (I4). `Composer` draws one read-only pill per
  setting that is not at its default (Mode always, then Role / Skill / Thinking /
  Model) instead of the hardcoded `mode · role · skill`, so Thinking and Model
  surface on the chip for the first time. The defaults are read off `DEFAULT_TURN`,
  so a changed default cannot leave a stale pill. Every pill opens the window and
  none of them writes — the mockup's own later draft (`chips10HTML`, 1341) gave each
  pill an × to clear it, which here would have been a second writer (§4.13).
- **The panel states the five read-only.** Context gained a "How Eumae answers"
  block (Mode / Role / Skill / Thinking / Model) and a line saying where they are
  set; its empty state stopped pointing at `+` to attach and names the paperclip
  (I3). It writes nothing: `+` is the only writer.
- Verified: `npm run build` green at **55 modules** — `Sheet.tsx` out, `useMedia.ts`
  in, so the count is unchanged — CSS **22.66 kB** (down from 23.13: the sheet's
  rules went, the window's container is small) and JS **274.55 kB** (up ~2 kB).
  §5 check 7 ran **28 assertions, 0 failures**; the built `dist` carries `addWin` /
  `How Eumae answers` / `Scope to a project` once each and `Attach a file` not at
  all. The three surfaces were then **looked at in a headless Chrome** against the
  built `dist` (over the DevTools protocol, no new dependency): the desktop window
  as a scrim + rail + Mode pane, the phone window as a full sheet, the panel's
  Context reading with the rail's returned row and the chip row showing `Ask ▾`.
  History: `3735 → 3935` lines across src + api.
- **Handed on, not dropped:** where a project scope is actually *chosen* is still
  the owner's call — the rail row is inert until a project screen exists, and it
  must not become a second writer (§4.13). I3's fuller form (attaching from the
  panel) is not built, because attaching is the paperclip's and the panel reads it
  back. "Always in context" is still furniture (I8) and the mic is still inert (I9).

**Phase 6 — sandbox, artifacts, `/api/ai`.** Studio artifacts and the panel's
Studio reading get something real; the UI finally calls `api/ai.ts`; an auth
screen exists, since the API rejects every unsigned call by design. **The log's
second layer lands here too** (`IDEAS.md` I5): `LogEntry` grows `who`, `phase` and
`type`, and Eumae's own rows appear for the first time — which is also the first
moment anything in the log is not the owner acting.

**Phase 7 — the Logs lens.** The deep dive, in Settings rather than the panel
(`IDEAS.md` I6-I7): one filter object (`{ who?, phase?, type?, area?, q? }`)
behind one `useLog`, the area pills demoted to presets, a picker for the facets
and a box for words. It waits on Phase 6 on purpose — a lens over one dimension
is the pill row again.

---

## 7. Known gaps and deliberately deferred work

- **The owner's open ideas live in `IDEAS.md`.** They are neither defects nor
  commitments: the file says whether each one landed in a phase or is still
  waiting. I1-I4 landed in Phase 5 (2026-10-07, struck through there). Still open:
  **where a project scope is chosen** — the rail row is back but inert, and it must
  not become a second writer (§4.13); the log has one dimension — area — so nothing
  can be filtered by actor (I5); Settings → Logs is still pills-only (I6);
  "Always in context" is still furniture (I8); the mic is still inert (I9).
- **~41 rail rows are inert.** `MenuItem` is only `{label, icon}` (`pageMenu.ts:3-6`).
  Tasks, Events, Calendar, Goals, Projects, Notes, Flows, Favorites, Sources,
  Contacts, Messages, Requests, courses, digests, and "Scope to a project" all
  render, and clicking one only toasts "…arrives with its screen" (`App.tsx:198`).
  To make them real,
  `MenuItem` needs something like `{ page?: string; action?: string; filter?: string }`
  and every row a target; the mockup's last `pD` says which rows belong to which tab.
- **Five tab screens are 11-line stubs** — their real structure has to come from
  the mockup.
- **A page open is not logged.** Removed in Phase 2 rather than patched: the only
  page in `PAGES` is `search`, which the shell opens, so filing it under the current
  tab wrote "Guild · Opened Search" about a tab with no features. It comes back when
  a page carries the tab it belongs to.
- **`EumaeState` is an empty interface** and `StoreProvider` holds nothing.
  `Actor` / `ActionStamp` / `SavedItem` exist unused — a hint at the intended shape
  (every saved item has an owner, timestamps and a history of actions).
- **No chat persistence.** `ChatScreen`'s messages die with the tab.
- **`api/ai.ts` is unreachable from the UI** and requires a signed-in caller; with
  no auth screen, today every real call would be rejected.
- **The request is built but never posted.** `ChatScreen.send` builds the body
  (`toApiBody`, `src/request.ts`) and keeps it on the message, so the mapping runs
  on every send and stays in the bundle; what is missing is the sender — the
  `fetch` to `/api/ai`, the SSE reader for `chatStream`, and the auth screen the
  endpoint requires. Until then §5 check 6 is the other guard on the mapping
  (`modelKey` above all), and a PDF ref (a label with no bytes) still cannot
  become an attachment.
- **The panel's "Always in context" list is static furniture.**
- **Personal data — fixed.** The account cards render an `ACCOUNT` placeholder
  instead of the owner's real name and email. If a profile editor ever lands, keep
  the value out of the source; this file ships to the public.
- **No `.nvmrc`.** This entry used to say there was no `.env.example` and no
  `vercel.json` either; both landed with the AI-layer guardrails (all four
  variables named with no values; `maxDuration: 60`), so what is left is the one
  file. The `VITE_SUPABASE_*` pair is deliberately *not* in `.env.example` until
  browser code reads it — a file naming a variable nothing reads is a file that
  lies.
- **No `main` branch** — the default is `stage/0-foundation`.
- Fixed in `6cb3f4d`, listed so it isn't "fixed" twice: `.gitignore`'s `.DS_Store/`
  had a trailing slash, so it only ever matched a *directory* of that name and the
  file was never ignored.

## 8. Production-readiness gaps (the "enterprise" list)

This was explained to the owner in plain language, and he has not decided to start
it yet. In priority order for a solo pre-alpha project:

**Soon — an afternoon, high payoff**

1. **CI.** `.github/workflows/ci.yml`: checkout, `actions/setup-node` (Node 24 or
   `node-version-file: package.json`), `npm ci`, `npm run build`, `npm run
   check:models:selftest`. Nothing else — the selftest is the one check that needs
   no network, no key and no browser, so it can run there from day one. Its only
   job is to stop the branch rotting and make "it builds" a fact instead of a
   memory.
2. **ESLint + Prettier.** `typescript-eslint` plus `eslint-plugin-react-hooks`
   (`rules-of-hooks` matters: this codebase calls `useStored` inside a component
   body), then Prettier for formatting. Add `npm run lint` and call it from CI.
3. **Tests (vitest).** Promote §5's eight checks (check 8 is already a script in
   `checks/`, and leaves no scratch copy behind, so it is the shape the others
   should land in). Cheapest high-value order: the
   theme boot cases, the settings integrity check, `useStored` round-trip plus the
   export/wipe prefix behaviour, then `logEv` from Phase 2, then check 6 from
   Phase 3 — which is the cheapest of the lot, because `src/request.ts` has no
   runtime imports and its two anti-drift assertions already parse `api/ai.ts`
   from a string. A node environment is enough — only reach for `jsdom` if a test
   needs `localStorage`, and the boot script can be tested by string injection
   instead.

**Later — when it actually deploys**

4. **`.env.example` + boot-time validation** — **mostly landed** with the
   AI-layer guardrails: `.env.example` names all four keys with no values, and each
   one now fails loudly with its own name where it is read (a missing Gemini key is
   a 500 saying so, a missing TTS key a 501 saying so, an unconfigured Supabase a
   500 saying so) instead of a vague 500. What is left is one validation pass over
   all four at boot rather than three checks down inside the handler, and the
   `VITE_*` pair when the auth screen reads it.
5. **An error boundary**: one component around `<App />` with a message and a
   reload button; today a render error is a white screen.
6. **`vercel.json`'s rewrites**: the file itself landed with the AI layer
   (`maxDuration: 60`); what it still needs is the SPA rewrite so a deep link does
   not 404 on Vercel.
7. **Build hygiene**: sourcemaps in production, `manualChunks` to split React out
   (one 270 kB chunk today), and a size ceiling.
8. **Monitoring**: error and performance reporting; matters only once strangers
   use it.

**Whenever**: `.nvmrc`, `CONTRIBUTING.md`, a PR template, and a decision about
license and repo visibility (the repo currently carries a real name and email).

**Not needed at this size** — say so plainly if asked: coverage thresholds,
staging environments, PR review bots, monorepo tooling, Docker, feature flags.

---

## 9. Gotchas

- **`dist/` and `node_modules/` are gitignored.** Never `git add -f` them.
- **`noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` are on**:
  an unused import or variable fails the build, not just the linter.
- **`npm run dev` does not serve `/api`.** Use `vercel dev` for the server path.
- **The build is slow in-session.** Background it and poll the log; don't block.
- **Tool payload limits:** a single file write over ~6k characters is rejected —
  split it into chunks, as this file was.
- **A lone `/` in the composer opens the `+` window** (mockup line 1278). Intentional.
- **`refs` are matched by `label`**, so two files with the same name collide (that
  produces a toast, deliberately).
- **Secrets:** `api/ai.ts` must keep reading `process.env`. There is no `.env` in
  the repo and there must never be one; a hardcoded key would be a public leak.
- **Double writers are this project's recurring bug class.** Before adding a
  control, ask which single thing already owns that state. The latest instance sat
  in the rail itself — two rows opening one pane — merged in §4.11.
- **The mockups are outside the repo.** If the Desktop files move, the line-number
  citations in the comments go stale; that is a known, accepted weakness.

---

*Written in commit `ae1bd6f`, the one that added this file, on `stage/0-foundation`
(the day this work was first pushed to GitHub). The code map in §2 is measured from
the tree as it stands today. If you change a locked decision, change §4 in the same
commit — this file is the handoff, and a stale handoff is worse than none.*

*One history rewrite so far: the owner's real email was stripped from 20 commits and
the real name and address from the file contents of 2 commits, so every hash in older
notes and links is dead. The pre-rewrite tip survives locally as `backup/pre-rewrite`.*
