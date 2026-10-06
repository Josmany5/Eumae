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

### Code map (2919 lines across src/ + api/)

| File | Lines | Role |
| --- | --- | --- |
| `src/components/settings/Settings.tsx` | 696 | the whole Settings overlay; also owns `useStored`, export/wipe |
| `api/ai.ts` | 501 | the only server code; Vercel handler |
| `src/App.tsx` | 276 | the shell: tab + page stack + panel + drawers + file input |
| `src/components/shell/AddSheet.tsx` | 179 | the composer's `+` menu ("Add to this chat") |
| `src/components/shell/RightPanel.tsx` | 188 | the right panel (Context / Activity / Studio) |
| `src/components/shell/pageMenu.ts` | 125 | `PAGE_MENU` — each tab's rail rows |
| `src/components/shell/Composer.tsx` | 107 | input row, chip, `+`, paperclip, mic, send |
| `src/nav.ts` | 110 | `NavContext`: go/back, goTab, panel, turn, pickFile |
| `src/components/shell/Sidebar.tsx` | 89 | desktop rail |
| `src/log.ts` | 78 | the activity log: `LOG_AREAS`, the one writer, the read |
| `src/pages/SearchPage.tsx` | 70 | the only real sub-page |
| `src/screens/ChatScreen.tsx` | 75 | the only real tab screen |
| `src/components/shell/icons.tsx` | 73 | the icon registry |
| `src/components/shell/Drawer.tsx` | 65 | phone drawer |
| `src/components/shell/Header.tsx` | 37 | title, hamburger, activity, back |
| `src/components/shell/TabBar.tsx` | 33 | phone tab bar + `TABS` |
| `src/screens/index.tsx` | 28 | `SCREENS` + `LABELS`: TabId → screen |
| `src/pages/index.tsx` | 24 | `PAGES`: name → page + title |
| `src/components/shell/Sheet.tsx` | 24 | bottom-sheet primitive |
| `src/store/store.tsx` | 23 | context skeleton; `EumaeState` is empty |
| `src/main.tsx` | 17 | mount |
| `src/components/shell/Toast.tsx` | 16 | transient message |
| `src/screens/Empty.tsx` | 15 | shared empty-state block |
| `src/store/types.ts` | 15 | `Actor`, `ActionStamp`, `SavedItem` |
| `src/screens/{Console,Studio,Library,Classroom,Guild}Screen.tsx` | 11 each | stubs rendering `Empty` |
| `src/styles/tokens.css` | — | tokens + all component styles |
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
- No test runner, no ESLint/Prettier, no CI, no `.env.example`. Verification is
  manual today (§5).
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

### Shell — `src/App.tsx` (276), `src/nav.ts` (105)

`App` owns: the active tab, the page stack, rail-collapsed, drawer-open,
settings-open, the toast, the panel (open + view), `refs` (attached items), the
add sheet, `turn`, and the single `<input type="file">`.

`nav.ts` is the app-wide context reached by `useNav()`:
`go/back/depth/goTab/openSettings`, `panelOpen/panelView/togglePanel/openPanel/closePanel`,
`openAdd`, `turn/setTurn`, `pickFile`. `PanelView = 'context' | 'activity' | 'studio'`.
`Turn = {mode, role, skill, thinking, model}` with the mockup's opening values in
`DEFAULT_TURN`.

**Fixed in Phase 4:** `App.tsx:219` — the header's activity button called
`openPanel('context')` while meaning *activity*. It opens the panel's Activity
reading now, and its `aria-label` in `Header.tsx` changed from "Context" to
"Activity" with it, because a label that names the wrong room is its own defect.

### Screens — `src/screens/`

- `ChatScreen.tsx` (75) is the only real one: a local `msgs` array, four greeting
  chips, and `send()` that appends a **user** bubble. There is no assistant reply
  and no backend. It also infers the mode from the prompt text (two regexes,
  mockup line 878): "make/build/create/draft/write me/design" → Build,
  "learn/teach me/explain/how does/what is a" → Learn. An ordinary ask leaves the
  mode alone.
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

### Right panel — `src/components/shell/RightPanel.tsx` (188)

One panel, three readings — Context / Activity / Studio — behind a `TABS` row in
`.pHead`, a body per reading, a corner `.pHandle` button when closed and a
`.pscrim` when open.

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

- `Composer.tsx` (107): chip, `+` (openAdd), auto-growing textarea, paperclip
  (`pickFile`), **mic (inert — no handler)**, send. A lone `/`
  opens the add menu (mockup line 1278). Enter sends, Shift+Enter newlines.
- `AddSheet.tsx` (179): five sections that decide *how* Eumae answers (Mode, Role,
  Skill, Thinking, Model) plus the Context rows. Picking closes the sheet.
  `ROLES = ['Default','Coach','Teacher','Sparring partner']` are the mockup's
  ROLEDEF; user-created roles arrive with Studio.
- `Sidebar.tsx` (89): Search, the six tabs, `PAGE_MENU[active]`, Settings at the
  foot. Collapsing is CSS-only.
- `Header.tsx` (37), `TabBar.tsx` (33, also exports `TABS`), `Drawer.tsx` (65),
  `Sheet.tsx` (24), `Toast.tsx` (16), `icons.tsx` (69 — six icons were added last
  phase: globe, acc, bill, shield, arch, law).

### Server — `api/ai.ts` (501)

One default-exported handler: `OPTIONS` → CORS preflight, anything but `POST` →
rejected, and the caller is authenticated (Supabase URL + anon key) *before*
`GEMINI_API_KEY` / `GOOGLE_CLOUD_TTS_KEY` are read. **Nothing in the UI calls it
yet**, and there is no auth screen — so today a real call would be rejected by
design.

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
8. **About and Legal are real pages.** The mockup left About as a
   `toast('Eumae 0.8')`; the rail row exists, so it opens a page.
9. **Mode is inferred from the prompt** (two regexes in `ChatScreen.send`) until a
   router exists — the mockup does the same at line 878, and the chip has to keep
   up with what the mode actually is.
10. **Onboarding/`+` choices are made, not stored per-chat.** `turn` is one piece
    of state in the nav context, read by the chip and written by the sheet, so the
    two ends cannot disagree.
11. **Data controls is the one data room** (merged after Phase 1). The mockup's
    Account row "Export and backup" and its Data row "Data controls" both call
    `goPage('sDat')` — one pane behind two doors
    (`eumae-mockup-wove-branch.html:1436`, the live settings list; the pane it
    lands on is `pgSDat` at 696). This codebase keeps one door: the second rail row
    is gone, and the backup card that used to sit behind it lives in Data controls
    beside the export action it described. Putting the alias back is §9's
    double-writer bug, in the rail.

---

## 5. How to verify (do it this way)

**Primary gate:** `npm run build` — types, then bundle. Green looks like
53 modules transformed and `dist/index.html` + `dist/assets/index-*.css|js`.
Background it (`nohup … &`) and poll; it often exceeds a 30-second tool timeout.

Three checks were used for the phase that just landed. They were hand-run scratch
scripts and are **gone** — this is the recipe to rebuild them, and the strongest
argument for a test suite:

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
   one a fresh session hits. `useLog` passes `logAll` as its server snapshot, so
   this needs no browser. Bundle the scratch file with the repo's own esbuild
   (`node_modules/.bin/esbuild … --bundle --platform=node --jsx=automatic`) and
   `node` the output; `tsx` is not a dependency.

**Never claim a UI behaviour works because it typechecks.** Build it, and open
`dist/index.html` or `npm run preview` when the claim is visual.

---

## 6. The plan — six phases, one done

Locked with the owner. The order matters: each phase removes a lie before the next
one adds a feature.

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

**Phase 3 — the `+` menu's turn window.** The five sections and `setTurn` exist;
what is missing is the other half of the contract. Decide and write down the
request shape (`{ mode, role, skill, thinking, model, refs, text }`) now, because
`/api/ai` will consume exactly that.

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

**Phase 5 — chips.** The chip already reads `turn` (`Composer.tsx:40-48`). Phase 5
makes each part honest: show nothing when nothing is set, keep the caret that says
it opens, and match the mockup's chip (line 1270).

**Phase 6 — sandbox, artifacts, `/api/ai`.** Studio artifacts and the panel's
Studio reading get something real; the UI finally calls `api/ai.ts`; an auth
screen exists, since the API rejects every unsigned call by design.

---

## 7. Known gaps and deliberately deferred work

- **~40 rail rows are inert.** `MenuItem` is only `{label, icon}` (`pageMenu.ts:3-6`).
  Tasks, Events, Calendar, Goals, Projects, Notes, Flows, Favorites, Sources,
  Contacts, Messages, Requests, courses, digests… all render, and clicking one
  only toasts "…arrives with its screen" (`App.tsx:195`). To make them real,
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
- **The panel's "Always in context" list is static furniture.**
- **Personal data — fixed.** The account cards render an `ACCOUNT` placeholder
  instead of the owner's real name and email. If a profile editor ever lands, keep
  the value out of the source; this file ships to the public.
- **No `.env.example`, no `.nvmrc`, no `vercel.json`.**
- **No `main` branch** — the default is `stage/0-foundation`.
- Fixed in `6cb3f4d`, listed so it isn't "fixed" twice: `.gitignore`'s `.DS_Store/`
  had a trailing slash, so it only ever matched a *directory* of that name and the
  file was never ignored.

## 8. Production-readiness gaps (the "enterprise" list)

This was explained to the owner in plain language, and he has not decided to start
it yet. In priority order for a solo pre-alpha project:

**Soon — an afternoon, high payoff**

1. **CI.** `.github/workflows/ci.yml`: checkout, `actions/setup-node` (Node 24 or
   `node-version-file: package.json`), `npm ci`, `npm run build`. Nothing else. Its
   only job is to stop the branch rotting and make "it builds" a fact instead of a
   memory.
2. **ESLint + Prettier.** `typescript-eslint` plus `eslint-plugin-react-hooks`
   (`rules-of-hooks` matters: this codebase calls `useStored` inside a component
   body), then Prettier for formatting. Add `npm run lint` and call it from CI.
3. **Tests (vitest).** Promote §5's three checks. Cheapest high-value order: the
   theme boot cases, the settings integrity check, `useStored` round-trip plus the
   export/wipe prefix behaviour, then `logEv` from Phase 2. A node environment is
   enough — only reach for `jsdom` if a test needs `localStorage`, and the boot
   script can be tested by string injection instead.

**Later — when it actually deploys**

4. **`.env.example` + boot-time validation**: name the four keys, and make a
   missing key fail loudly with its own name instead of a vague 500.
5. **An error boundary**: one component around `<App />` with a message and a
   reload button; today a render error is a white screen.
6. **`vercel.json`**: build/output config and SPA rewrites so deep links don't 404.
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
- **A lone `/` in the composer opens the add menu** (mockup line 1278). Intentional.
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
