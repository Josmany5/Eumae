# VISION.md — what Eumae is, how it works, what we build

Read this before the docs. This is product truth: what Eumae is, how it
works, and what we keep vs cut. Engineering truth lives in `AGENTS.md`.
The idea queue lives in `IDEAS.md`. Quick start lives in `README.md`.

## 0. How to read this

Three sources, three jobs:

- **Mockup = look.** `~/Desktop/eumae-mockup-wove-branch.html` (289K, Oct 5,
  v12, 1909 lines) is visual guide only, not law. It is mobile-first
  (520px), dark/light tokens, bottom tabbar, drawer, composer. Steal feel
  (colors, radius, spacing, tone), not layout. Desktop reuses the same kit
  in three columns. Never revert repo to match mockup.
- **Repo = truth.** `~/Desktop/eumae` (~7,871 lines). Six tabs: Chat,
  Console, Studio, Library, Classroom, Guild. Chat + Library + Notes are
  half-real. Console / Studio / Classroom / Guild render `Empty` today.
  If VISION says it and repo does not do it, repo wins and VISION is ahead.
- **Docs = history.** The four big docs (master MVP 8,386 lines, full
  build, build phases 316 lines, blueprint 24) are aspirational and partly
  stale. Five-tab shell, Clarity/Wove names, 18 opcodes day-one,
  marketplace near MVP, teams/sync/sandbox month-one — all dead or parked.
  This file distills what survives.

One sentence for the whole build:

> **Mission control behind, living surface in front. You talk, it
> structures, checks, does, shows receipt, files, remembers, nudges once.**

## 1. Pitch

**One line:** Eumae (pronounced "yoo-MAY", nickname "Mae") is the AI that
knows you — a life-management system, not a productivity app, not a chatbot.

**30 seconds (demo):**
> One window, six views. You talk, it builds and files. Chat works today
> with voice + photos + streamed answers. Library + Notes work. Studio is
> next — describe it, get the file. Look is locked from our v12 mockup,
> desktop + mobile share one kit.

**60 seconds (investor):**
> Agents take orders. Eumae takes initiative.
> ChatGPT remembers nothing. Notion needs an hour tutorial. ClickUp is
> work-only. Eumae is the home AI output was supposed to have.
> The moat is not the model — models are rented. The moat is the organized
> life + judgment over memory + trust machinery. The longer you use it, the
> more expensive leaving becomes, because no competitor inherits the
> relationship.
> Go-to-market is me. I run my company on Eumae with no team. If it handles
> my follow-ups, prospects, metrics and briefs — with receipts — I can sell
> it to every founder. Founder's OS, proven by the founder.
> Business: subscription for the app + cut of the template marketplace
> where experts sell thinking as question-sets. Never sell the user, never
> train on their content.

What to show: live Chat send + photo survives reload + Library filter +
Notes. Then mockup for Studio vision. Never show fake data — honesty is
the house rule and investors notice.

What not to claim as built: harness, memory system, Console / Classroom /
Guild content, sync, marketplace, native app, browser actions, video-gen.

## 2. What it is / what it is not

**Is:**
- One window, six views: **Chat, Console, Studio, Library, Classroom,
  Guild** — plus Settings, right panel (Context / Activity / Studio),
  desktop rail. Phone = stacked + tabbar + drawer. Desktop = rail + main
  + panel. Same code, two layouts.
- Stage pre-alpha 0.1. Shell, nav, Settings (22 rows), composer + `+`
  window, refs, panel, theme, activity log, chat sender (real stream via
  `/api/ai`), voice typing + read aloud, Supabase sign-in, threads in
  localStorage, uploads in IndexedDB with Library list, notes list +
  detail, photo-pointers (no base64 in threads), CI + checks green, error
  boundary.
- You talk. It organizes, builds, files, reminds. A secretary writes it
  down. A partner does it.

**Is not (CUT, do not build):**
- Chatbot bolted onto docs. Sixteen apps in a trenchcoat. Autonomous
  agent that lives its own life. Cute planner. In-app social network.
  Blockchain history. Kanban/Gantt parity (ClickUp won). Full gamification
  for V1. Marker/secret-code parsing. Beam hardware/deep-web. Video-gen.
  Browser actions (expensive). Eisenhower matrix.
- Parked for later, not now: deep integrations before internal loop works,
  teams, multi-device sync, sandbox, App Store, trained models,
  marketplace near MVP, old Pro $10 tiers, Clarity/Wove names, five-tab
  Dash/AI/Create/Library/Workspace doc.

## 3. Mission control (how it works, behind the screen)

One line flows through all of it:

> you say -> compile to opcode -> check gate -> run tools -> verify ->
> receipt -> file -> remember

- **Front door.** Chat, voice, photo, file, link — one door. Repo today:
  `Composer.tsx` + `App.tsx` one file input. Later: WhatsApp / email /
  share-sheet knock on the same door. Same rules no matter which door.
- **Compiler.** Words become structure. "Every morning, brief me" always
  becomes `STANDING_JOB + when + what`. AI at the edge, deterministic
  core. Why: "understands X" means the same thing every time — no improv.
- **Bouncer + grants.** Before anything runs or saves: who is this for, is
  there a slip, harmless or consequential? Harmless (read, draft, organize,
  remind) can happen if worth attention. Consequential (send, delete, spend,
  act outside) always asks. No card, no action. Revoke a grant and all that
  depended on it stops.
- **Dispatcher + tools + skills.** Dispatcher is the CPU — runs, never
  thinks. Tool = one atomic action with schema + risk tier + live/draft.
  Skill = playbook (prompt + allowed tools + budget, versioned). Opcode
  calls a skill, skill runs tools. Model picks and fills blanks; code runs.
  AI may draft; only you promote. Never grants itself permission.
- **Checker.** Did the world really change? If it cannot prove it, says
  `not_checked` — never fakes. Failures return a repair hint.
- **Filing.** Journal first (crash loses nothing) -> router decides home ->
  raw saved once -> index mentions. AI proposes where; the Librarian (your
  name) is the sole writer. Nothing drifts in chat. Nothing in two places.
- **Memory.** After reply is sent (you never wait): capture -> triage hard
  rule vs soft preference -> store readable markdown stamped
  `said / inferred / observed` -> next turn retrieves compressed summary.
  Sunday distill. You see, edit, delete all. Undo on every claim.
- **Scheduler + watcher + teller.** Scheduler fires standing jobs. Watcher
  scans quietly (rescheduled 3x, blew estimate 1.5x, goal untouched 14 days).
  Mostly answers "nothing." When true + new + actionable + worth
  interrupting, teller gives one observation + one question. MUTE honored.
- **Ledger.** Postgres: `things` (one type), `standing_jobs`, `grants`,
  `action_runs` (receipts), `memories/rules`, `tools/skills`, token ledger.

OS mapping (your words): dispatcher = CPU, registry = instruction set,
skills = programs, **chat = programming language**, widgets = apps,
memory = disk, watcher = daemons, triggers = interrupts.


## 4. Living surface (what you touch)

Backend is invisible. This is what you see and tap. Living = assembles
from live objects. The page is the interface, objects are the truth.

- **Chat — the programming language.** Talk and command. Starter sentences
  (Q151, §10): "brief me", "remember X", "make a PDF/doc", "plan my day",
  "find Y". Shows: bubbles, plan card before acting, live steps while it
  works, receipt after with undo. That live-steps UI is the turn loop
  reporting. Repo today: real stream, threads, photo-pointers, copy /
  read-aloud / edit, voice typing. Missing: plan card, steps, markdown
  render fix, stop/retry.
- **Console — your day in one place.** Tasks, calendar, picture of life.
  Where scheduler + watcher + briefs land. Repo today: Empty. Full: Daily
  Brief first, focus timer, "moved this 4 times, rethink it?"
- **Studio — make the thing.** Describe it, get the file. V1: Game, PDF,
  Doc, Slides — flawless. Preview before forge (real renderer), edit before
  forge, file lands in Library and opens. Repo today: Empty. This makes Chat
  valuable — Chat creates 80%, hands finish 20%.
- **Library — everything filed.** Filterable, openable, searchable.
  Nothing homeless. Repo today: uploads list + preview + delete works.
  Full: forged files, notes, transcripts — filing made visible.
- **Classroom — learn it.** Courses, plans, review, progress. Repo today:
  Empty. Full: templates as expertise-as-questions + struggle + tips at
  field level + lessons in drawer, pace projections, honest history.
- **Guild — share the work.** Messages, requests, people, shared work. Repo
  today: Empty. Full: in-app requests first (prove with mom, link later),
  teams much later, marketplace last (shared tools = attack vector).
- **Shell.** Rail (desktop) / tabbar + drawer (mobile), header, right panel
  (Context = focus, Activity = receipts, Studio = readings), composer with
  `+` (behavior) vs Context (focus) — `+` writes behavior, Context writes
  focus, chip + panel read both back. Refs chips, toast, Settings (22 rows)
  + Logs. Glass box: anything it knows appears somewhere; anything it does
  leaves a receipt.


## 5. Opcodes, tools, skills — plain

- **Opcode = what you meant, in system language.** 18 fixed verbs:
  STANDING_JOB, TRIGGER, MEMORY_WRITE, BUILD, DEADLINE_WATCH, EVENT_LISTEN,
  POLL, MACRO_REPLAY, PERMISSION_RULE, DEFAULT_CONFIG, PRIORITY_FILTER,
  ALIAS, AUTONOMY_THRESHOLD, TRACE, FILTERED_VIEW, LIST_PROGRAMS,
  UPDATE_PROGRAM, DELETE_PROGRAM. Never touches outside world. Only job:
  make meaning stable. "Brief me every morning" always = STANDING_JOB +
  when + what. Small, stable. New opcode = new capability = platform
  release. Your line: "x86 has MOV/ADD/JMP, Eumae has STANDING_JOB..."
- **Tool call = the thing done about it.** Many, growable: create_task,
  send_email, query_DB, generate_image, save_note, search_library. Atomic
  action dispatcher runs. Has schema, risk tier, live/draft. The morning
  STANDING_JOB above runs 3 tool calls: query tasks + pull calendar +
  assemble brief.
- **Skill = playbook between them.** Prompt + allowed tools + budget,
  versioned. "Morning brief v3" runs tools in order. Your killer line: in
  Eumae, using the app IS writing the skill — running invoices 3x is the
  authoring; the skill is the compiled version. Widget = face (tappable),
  skill = hands (agent runs). Builder view: just "I built the thing that
  runs my shit". "Skills is basically a widget" — siblings, not twins.

Chain: you say -> compiler parses to opcode -> dispatcher maps opcode to
skill -> skill runs tools -> receipt -> file.

## 6. Crew, harness, memory, proactivity — one page

- **Crew.** Nine small machines, one door in/out, event handoffs, never
  reach inside each other. Compiler hears, dispatcher runs, bouncer checks,
  checker verifies, scheduler fires, filing journals + routes + stores,
  Librarian solely writes + distills weekly, watcher scans, teller tells
  once. Build order: dispatcher+bouncer first, then compiler, then rest
  (blueprint §5: 11 steps).
- **Harness.** Locked thesis: model is not product, harness is. Six layers:
  1 memory, 2 working contract (9 laws: plan-first, expand-before-filing,
  "I like that" != decision, plain words, verbatim filing, closed contract,
  transcribe-first, check-before-claim, glass box), 3 tools+dispatcher,
  4 verification (typecheck + phone test, no victory declaring),
  5 output contract (short when short, deep when needs it, markdown must
  render), 6 proactivity. Schemas are the UI the model reads. Retrieval not
  stuffing (800-token cap). Per-message classifier: new intent vs follow-up
  vs correction vs question-about-screen; assemble brief to match.
- **Memory.** Markdown docs canonical, human-readable (2026-09-26 verdict).
  Capture after reply so you never wait. Triage hard rule vs soft pref with
  action pattern. Said = you stated (verbatim, highest trust). Inferred =
  guess (flagged, confirms by repetition or decays). Observed = code counted
  (no model). Retrieve compressed summary. Sunday librarian distills 100+
  mentions into knowledge. See / edit / delete all. Undo on every claim.
- **Proactivity.** Watcher asks hourly: anything worth telling him? Mostly
  nothing. Gate = attention economics (true + new + actionable + worth it
  or silence). Permissions = consequence economics (harmless auto,
  consequential asks). Split fixes cold start — fully capable day one at
  harmless. Handoff = context + directives + past + Things. Suggestions =
  teller outputs. Next steps = plan cards with tap to start.


## 7. Hard answers (one line each)

- **Sandbox last.** Hardest ability, deliberately last. Start: preview
  before forge rendered by real renderer, edit-before-forge, iframe sealed
  even after publish so bad widget cannot kill app. Widget bridge = scoped
  data + tool invokes via dispatcher, bouncer approves at Publish. Publish
  IS the permission moment with manifest.
- **Show work = turn-loop stages as UI.** Plan card -> drafting -> preview
  ready -> filed -> receipt + undo in Activity. Thoughts are story, tool
  log is receipt.
- **Guild.** In-app requests first — prove with mom. Link zero-install
  later. Structured inbound lands as task already. Teams, marketplace much
  later.
- **Classroom.** Template = expertise as questions + productive struggle +
  tips at field level + mini-lessons in drawer. AI drafts raw, you edit,
  forge renders real file. Pace projections, honest history.
- **Widgets publishing.** Build-for-self -> package as template -> declare
  wiring -> review -> list. Version never silently reshapes instances.
  Builder *is* skill builder; no separate skills UI.
- **Verticals.** One harness, many costumes. `verticals` table: role,
  skill_set, watcher_config, bouncer_rules, widgets. Classifier + brief
  assume role. Start with you only; personas guide later.
- **Files like desktop.** Unified Thing: one type, one view, parent link,
  provenance. Auto-sort: capture -> classify -> route -> append-first or
  new doc -> file verbatim -> receipt + undo. Project IS dashboard scoped
  to it. Completing task pushes needle, recorded in history.
- **Compete.** Out-remember + out-trust, not out-model. Gbrain at $199/mo
  validates thesis — team-first agnostic vs personal-first with AI inside.
  "They built hands. We build judgment."
- **Cheap API.** Gemini: Flash parses, Pro reasons. No multi-router until
  data says. Every skill carries budget, ledger caps daily, over-budget
  degrades not fails. Stitched voice now, Live API at ~1000 users.
- **Router for user models.** `providers/router.ts` picks cheap vs strong +
  failover. Bring-your-own-key later. Visible picker: "picked best model
  for this job." Never rent moat (harness/memory/filing/bouncer in-house).
- **Privacy.** Keys server-side only, auth before keys, RLS so no leak,
  PII scrubbed at edge (IDs + counts, never raw life), no training on
  content, generative AI never in analytics, export/delete real. Bouncer
  is the security story.
- **Skins.** Tokens schema first: font 1-of-8, background, card/page/accent
  /text, radius 0-24, shadow, density. Three doors same room: presets,
  self picker with live preview, AI picker ("rainy Tokyo cafe" validated
  to schema, tap to apply, reversible). Marketplace last. Must feel
  inevitable, not decorated. Time-aware later.
- **Nav.** Each place one natural nav, exit returns to place, enter leaves
  space, other tabs available (no endless back). Track enters/exits to
  anticipate (morning brief -> training log ready). Manual first, Eumae on
  invitation, never chat-only. Usable without AI.


## 8. MVP vs full build

**MVP — 60-second loop (YC demo).** Stranger in one session: talk -> get
useful reply / real PDF-doc -> open it in Library -> see receipt. No setup.

Keep (built): shell, rail/drawer/tabbar, Settings, composer + `+` window +
refs, right panel, chat stream + threads + photo-pointers, uploads +
Library open/delete, notes list/detail, search, auth + `/api/ai`, CI +
checks green, error boundary.

Next, in order:
1. Studio-lite: Game / PDF / Doc / Slides from chat — preview before
   forge, edit before forge, file lands in Library and opens.
2. Glass-box-lite: plan card -> live steps -> receipt + undo in Activity.
3. Polish: markdown render fix (B19 — bold showed raw on phone),
   stop/retry/regen, timestamps grouped, virtualize past 100, desktop
   parity, phone test green.

Cut from MVP: Console / Classroom / Guild content, memory v1,
watcher/teller, teams, image-gen, sync, sandbox, App Store, billing.

**Full — after MVP (each needs the one above).**
- Phase 0: backend home. Postgres + pgvector, api + worker, auth, Sentry +
  uptime day one, nightly backups + real restore test. Exit: web runs off
  it, one cron fires a week.
- Phase 1b: v1 complete. Six tabs per repo, routines, focus timer, meeting
  minutes, filing, briefs, permissions, settings. Data spine: Things table.
- Phase 2: memory + skills. Capture -> triage -> retrieve, manager UI
  (see/edit/delete all), skills table, propose-and-approve only.
- Phase 3: proactivity moat. Watcher -> gate -> teller, per-topic dial,
  undo toast on every auto-action.
- Phase 4: native + channels. iOS/Android, push, share-sheet + Shortcuts,
  email in (easy), WhatsApp middle, SMS never on iOS. Live voice at ~1000.
- Phase 5: scale. Vertical bundles as data, doorbell API, marketplace with
  review layer, per-user metering -> billing.

Standing laws: phone test decides, additive (never rewrite what a phase
proved), commodity rented / moat in-house, no invented words, eval green
or no ship.

## 9. Keep / Distill / Delete

**Keep (locked + repo truth):** six tabs per mockup+repo; honesty never
invent data; one door per room; verify before claiming; phone test decides;
photo-pointers; CI green; harmless vs consequential; said/inferred/
observed; plan + receipt + undo; propose-and-approve + bouncer-guarded;
markdown canonical; no card no action; 95/5 (reversible proceeds,
irreversible 5% asks).

**Distill (compress, build small):** 18 opcodes -> 4-5 starter sentences;
10 personas -> you for MVP; 25 ideas -> Phase 1a only; watcher -> one
hourly check; skills sprawl -> one registry + Create gallery IS the shelf;
10 use cases -> smallest loop (understand -> place -> do -> verify ->
learn).

**Delete/Park:** §2 CUT list + stale names + five-tab doc + 18-opcodes
day-one + watcher complex + marketplace/teams/sync/sandbox/App Store near
MVP + old tiers + marker parsing + video/browser/gamification V1.

## 10. Quotes + open locks

Your lines that drive build:
- "can the AI still have that be on screen with that terminal window thing
  where you're creating on top but AI still there talking?" (split-view)
- "skills is basically a widget" / "using the app IS writing the skill" /
  "the app is the authoring"
- "Eumae is the first computer you program by talking." / "Your phone is a
  computer. Eumae is your computer." / "Unix in the iPhone."
- "the sentences can drive engineering — what happens when user says xyz"
- "Muse makes you productive. Eumae makes you capable."
- "for me it's the process not the destination" / "slow down to connect" /
  "making things honest, real" / "connect to themselves"
- "it doesn't learn your settings, it learns you" / "fills gaps of what I
  forget" / "know me first, then act"
- "bro this is fire" (v1 mockup: visible AI work, swipeable + organizable
  dash)

Open locks (decide to unblock):
- **Q151:** which 4-5 sentences does v1 understand first? Proposal: "brief
  me" / "remember X" / "make a PDF/doc" / "plan my day" / "find Y".
- **C66:** worker-first (upload auto-files + receipt, no chat) vs chat-first
  (waits for message) vs hybrid (harmless auto, consequential waits).
- **C68/C69:** confirm propose-and-approve + bouncer-guarded as working
  rule (build-phases Appendix B agrees).
- **C07:** approval — "nothing without yes" vs "acts then asks" vs 95/5.
  Working: harmless auto if worth attention, consequential always asks.

## Appendix: doc map (which of the 4 docs survives where)

- `24-eumae-master-blueprint.md` (221 lines): §2 diagram + §3 subsystems +
  §4 schema + §5 build order + §6 decisions -> VISION §3 + §8. Detail files
  13/14/17/18/20/22 stay code record; this file is scope.
- `eumae-build-phases.md` (316 lines): Phase 0 -> VISION §8; 1a demo +
  1b v1 -> §8 MVP/full; 2-5 -> §8 full; Appendix A 25 ideas map kept as
  reference; Appendix B gates -> §10 locks; Appendix C CUT -> §2 + §9.
- `eumae-full-build.md` (1,088 lines): shell/loop/Thing/triggers/forge/
  artifacts/hands/permissions/memory -> §3 + §4; deep dives parked unless
  cited above.
- `eumae-master-mvp.md` (8,386 lines): §1 loops (A/B choice) -> §8 MVP
  framing; §2 LOCKED -> §9 keep; §3 later-phase LOCKED -> §8 full; §4
  PROPOSED -> §6-7 where cited, rest parked; §5 CUT -> §2 + §9; §6 build
  orders -> §8 (none chosen alone, phases doc governs); §7 open Q01-Q26
  mostly superseded by §10 four locks; §8 C01-C20 + C48-C69 flagged — only
  C66/C68/C69/C07 + Q151 block v1; §12-16 skills/inbounds/filing-loop/
  programmable-computer -> §5 + §7 + §10.

