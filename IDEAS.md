# IDEAS.md — the owner's ideas, tracked

The owner's own list of things he wants, written down as he says them. It exists
for two reasons: an idea said out loud in a chat is one forgetful session away
from being lost, and several of these cut across phases that are already written.

**Nothing here is a commitment.** An entry becomes work when it lands in
`AGENTS.md` §6 as a phase; at that point the entry is **struck through** here
rather than deleted, so the reasoning — and any change of mind — stays visible.
The phases are the plan; this file is the queue behind them.

**No real names or email addresses in this file**, same rule as the rest of the
repo: it ships, and the repo is public (`AGENTS.md` §7).

Each entry says: **where it came from · what it says · what it would touch · what
is still open.** "Owner, 2026-10-06" means he raised it in conversation; a mockup
line number means the design source already implies it.

---

## The split most of these follow

The owner's words: *"the context panel is where the context picker lives, the
attach-a-thing stuff — not AI behavior but AI focus; the plus is its behavior."*

- **`+` is behavior.** Mode, Role, Skill, Thinking and Model — how Eumae
  answers. It is the only *writer* of those five.
- **The Context reading is focus.** What Eumae is looking at — attachments, a
  project scope, what is always in context. It is the only writer of those.
- **The chip and the panel both read behavior back.** The chip is the glanceable
  read-out; the panel states it in full. Neither writes it.

That is §1's "one door per room" applied at the feature level, and it is what
settles the ask that looked self-contradictory: everything the picker sets shows
as chips *and* in the panel, while the panel's attach controls leave the picker
entirely. Locked as §4.13.

## ~~I1 — `+` becomes a window, like Settings~~ ✅ Phase 5

**Landed 2026-10-07.** `AddSheet.tsx` is a full sheet on a phone and a scrim +
modal at desktop width, built from Settings' own `.smodal/.stabs/.spanel/.shead/
.sbody` skeleton rather than a copy of it; the breakpoint moved into
`src/useMedia.ts` so both overlays read one of them. The old shape went, and
`Sheet.tsx` with it. The open question is answered **yes**: each rail row carries
that setting's live value (Ask / Default / — / Balanced / Auto), which is what kept
the window one screen tall.

- **From:** owner, 2026-10-06 — "converts the plus menu to a pop up window like
  settings".
- **Says:** `+` should open the way Settings opens — a full sheet on a phone, a
  scrim + modal with its own rail at desktop width (`Settings.tsx:187`,
  `useMedia('(min-width:900px)')`) — instead of the bottom sheet of five stacked
  sections it is today (`.sheet`, `tokens.css:199`; `AddSheet.tsx`).
- **Touches:** `AddSheet.tsx`, `Sheet.tsx`, `tokens.css`.
- **Open:** whether each rail row carries that setting's live value the way
  Settings' rows carry "Free" / "Dark" / "$0.00" (Mode · Ask, Thinking ·
  Balanced). That is what would make the rail the read-out and keep the window
  one screen tall, and it is what makes I4's chip affordable.

## ~~I2 — `+` stops attaching~~ ✅ Phase 5

**Landed 2026-10-07.** The Context section is gone, "Attach a file…" with it, and
"Scope to a project" is back in the rail's Context group — so the window is
behavior only and scoping has a door again. "Attach an item" now opens the one file
input (`pickFile`, §4.4) instead of a window that can no longer attach anything, and
`App.tsx`'s `openAddPage('projects')` branch was deleted rather than left
unreachable. The open question is **still open**: the rail row scopes nothing until
a project screen exists, so where a scope is chosen is deferred, not settled.

- **From:** owner, 2026-10-06 — and the file already argues for it:
  `AddSheet.tsx:9-14` says setting the chat up is the whole job of `+`, while its
  Context section (155-175) does the opposite.
- **Says:** the Context section goes; `+` is behavior only, and attaching stays
  the paperclip's job.
- **Touches:** `AddSheet.tsx`; **`pageMenu.ts:31-37`**, because "Scope to a
  project" was dropped from the rail *because* the `+` menu held it — that row
  has to come back or scoping has no door; `AGENTS.md` §4.3 and §4.7 both change
  with it.
- **Open:** where a project scope is chosen once the window is behavioral only —
  the rail row, the panel, or both. Both would be two doors to one room (§1 rule
  2).

## ~~I3 — The Context reading becomes the focus surface~~ ✅ Phase 5 (in part)

**Landed 2026-10-07, partly.** The reading gained a read-only "How Eumae answers"
block (Mode / Role / Skill / Thinking / Model) and lost its false sentence — the
empty state names the paperclip now, which is what actually attaches. What is *not*
built is attaching from the panel: the paperclip owns attaching (§4.3), and the
panel reads what it produced. I8 is untouched, so this entry is not finished.

- **From:** owner, 2026-10-06.
- **Says:** the panel's Context reading is where the context picker lives —
  attach a thing, scope to a project, always-in-context — plus a read-only
  statement of how Eumae answers.
- **Touches:** `RightPanel.tsx` — its empty state (`:114`) says "Use the **+** on
  the composer to bring in a file or an item", which is false the moment I2
  lands — and `nav.ts`.
- **Open:** whether the always-in-context list is driven by real data or labelled
  as the standing rule it currently is (I8).

## ~~I4 — The chip carries everything the picker sets~~ ✅ Phase 5

**Landed 2026-10-07.** `Composer` draws one chip per setting that is not at its
default — Mode always, then Role / Skill / Thinking / Model — with the defaults read
off `DEFAULT_TURN`, so Thinking and Model reach the chip for the first time. The
open question is answered: the row **wraps** on a phone (`.modeBar` already did). No
chip clears itself, unlike the mockup's own later draft (`chips10HTML`, 1341), whose
× would have made the chip a second writer of the five (§4.13).

- **From:** owner, 2026-10-06. It reverses his own line from earlier the same day
  — see *Reversals* below.
- **Says:** one chip per setting, with the ones sitting at their default hidden.
  Be exact about what the mockup does here, because it is not four hidden chips
  plus a mode: `chipsHTML` (line 1270) **always** shows `MODE`, adds the role only
  when it isn't `Default`, and the skill only when one is set — Thinking and Model
  never appear at all, because there is no chip for them. Extending that same rule
  to the two that were never drawn is the whole ask.
- **Touches:** `Composer.tsx:43` (`live` is mode · role · skill today, so
  Thinking and Model never appear), §4.10.
- **Open:** with five possible chips the row gets long — does it wrap or scroll
  on a phone? `.modeBar` wraps today (`tokens.css:319`).

## I5 — The log's rows grow facets: who × phase × type

- **From:** owner, 2026-10-06 — the log has "two layers": Eumae's own actions,
  both while thinking and while doing, and his actions in the app.
- **Says:** a row should know its actor (you / Eumae), its phase (thinking /
  doing) and what it was about (widget, doc, page, task…), stamped by the writer
  the way `ts` and the dot already are.
- **Touches:** `src/log.ts` (`LogEntry`), the four writers (`App.tsx:75,82`,
  `ChatScreen.tsx:61`, `AddSheet.tsx:80`).
- **Open:** `type` has nothing to fill it until Studio artifacts exist, so it
  would be declared now and written later — the same shape as `src/request.ts`
  in Phase 3. Ordered *before* the lens (I6/I7, Phase 7), because a filter over
  one dimension is just the pill row again.

## I6 — The deep dive lives in Settings → Logs; the panel stays a glance

- **From:** owner, 2026-10-06 — "the activity panel might not need anything; if
  people want a deep dive they can go to settings instead".
- **Says:** the panel's Activity reading stays newest-first with no controls;
  Settings → Logs gets the drill-down and the search.
- **Touches:** `Settings.tsx:640-663` (the logs pane; the area pill row is the
  `.ftabs` at 642), `RightPanel.tsx:138-165`.
- **Open:** the filter should be one object (`{ who?, phase?, type?, area?, q? }`)
  read by one `useLog`, with the pills demoted to presets — otherwise "rich
  filter" means a second filtering mechanism beside the first, which is §9's
  double-reader bug.

## I7 — The views are facet combinations, not tabs

- **From:** owner, 2026-10-06 — "a filter with tabs is so clunky… maybe a popdown
  to select further distillations, like a drill down".
- **Says:** "only my widgets", "only docs", "task history", "classroom",
  "digests" are all `area` + `type` (and who/phase) — so they need facets and a
  picker, not one pill per question. The mockup already does two levels: Library's
  "By type" adds a second `.ftabs` row under the first (931/936).
- **Touches:** `src/log.ts`, Settings → Logs.
- **Open:** search box (sets `q`) alongside the picker (sets the facets). He asked
  for both; the honest split is one control for *facts* and one for *words*.

## I8 — "Always in context" is driven or labelled

- **From:** the open item Phase 4 handed on.
- **Says:** `RightPanel.tsx:119-136` renders three rows nothing feeds. Drive it
  from real data (projects, today, recent conversations) or say plainly that it
  is the standing rule and not a list.
- **Open:** which of the three is worth making real first.

## I9 — The mic

- **From:** `Composer.tsx:98` — drawn, inert.
- **Says:** wire it or hide it.
- **Open:** voice needs a reply to speak, so this sits after Phase 6. The repo's
  honesty rule already forbids shipping a button that does nothing.

---

## Future chat work (owner, 2026-10-11 — queued, not building yet)

Saved from the chat-improvements talk so nothing is lost. Each says where it
came from, what it would touch, what is still open.

## I10 — Content auto-titles

- **From:** owner, 2026-10-11 — "make chat titles auto title based on users
  ask or content".
- **Says:** title the thread from what was asked / what it is about, not
  just the first 40 chars. Floor (shipped): `titleFor` cuts at a whole word.
- **Touches:** `src/threads.ts` (`titleFor`), thread rename on first send.
- **Open:** whether content-titling needs the reply shape or first message
  is enough.

## I11 — Thread window (last 100 + down arrow)

- **From:** owner, 2026-10-11 — yes to 100, "no jump just a down arrow when
  scrolled up".
- **Says:** past 100 messages, paint the last 100 only. A down-arrow appears
  when scrolled up; no "jump to latest" pill.
- **Touches:** `ChatScreen.tsx` thread list, scroller.
- **Open:** nothing — spec is locked, just not built.

## I12 — Day lines (Today / Yesterday)

- **From:** owner, 2026-10-11 — "where is the today yesterday - ok".
- **Says:** one divider per day (Today / Yesterday / date), time stays under
  bubbles. Grouping only, no server clock yet.
- **Touches:** `ChatScreen.tsx` render, `tokens.css`.
- **Open:** relative ("2m ago") under an hour — keep or clock only.

## I13 — Sources upgrade (title + domain)

- **From:** owner, 2026-10-11 — "fix sources - tap already opens link".
- **Says:** show the page title + small domain (keep same-site dedup into one
  row). Tap opens out — already works, keep it. Links blue, no underline.
- **Touches:** `src/chat.ts` (`extractSources`), `ChatScreen.tsx`
  (`SourcesPill`), `tokens.css`.
- **Open:** whether the title is worth the extra wire weight vs domain-only.

## I14 — Smart welcome from your stuff

- **From:** owner, 2026-10-11 — "update welcome buttons and logic".
- **Says:** 4 buttons chosen from time-of-day + last thread + recent upload,
  not the same static 4. Morning = plan day, stuck project = unblock it,
  fresh upload = turn into tasks. Desktop 4-in-row, phone 2x2, same logic.
- **Touches:** `ChatScreen.tsx` (`SUGGESTIONS`), threads/uploads/notes reads.
- **Open:** exact rules per signal; memory-smart later.

## I15 — Regen icon only

- **From:** owner, 2026-10-11 — "regen maybe as a icon", no stop/retry/continue.
- **Says:** one small regen icon under AI replies. Nothing else.
- **Touches:** `ChatScreen.tsx` message row.
- **Open:** icon choice; placement beside copy/speaker.

## I16 — Real slash palette, with harness

- **From:** owner, 2026-10-11 — "/" should not open the menu; slash as
  attachment / plugin / edit action like ChatGPT, "maybe save for later".
- **Says:** a lone "/" is just a "/" again (hijack removed). The real palette
  (`/attach /imagine /edit /action` that actually runs things) waits for
  dispatcher + bouncer — every button real, none fake.
- **Touches:** `Composer.tsx`, future dispatcher/tools.
- **Open:** which commands ship first (needs Q151 starter set).

## I17 — Image gen with Studio-lite

- **From:** owner, 2026-10-11 — "ai to be able to generate images".
- **Says:** "Draw me…" → plan card → forge → Library + chat shows it. Parked
  until prompt + plan card + receipt exist. `functionCall` already carried in
  `chat.ts` — the seam is ready.
- **Touches:** future tools registry, Studio, Library.
- **Open:** which 4 forge types first (Game / PDF / Doc / Slides per VISION).

## I18 — Prompt rewrite, standalone

- **From:** owner, 2026-10-11 — "ai doesnt have the right prompt", "save prompt
  rewrite as its own thing after the other fixes".
- **Says:** Layer 1 (tiny identity + honesty + reply shape) + Layer 2 (mode
  only) + Layer 3 (`+` settings only when changed, defaults send zero words).
  Voice-short line. Lives in `src/request.ts`, not wove.
- **Touches:** `src/request.ts` (`BASE_PROMPT`, `MODE_CLAUSE`, `directives`).
- **Open:** exact Layer 1 wording; token-count check.

## I19 — Plan card glass box

- **From:** owner, 2026-10-11 — "ok plan card glass box".
- **Says:** "Here's what I'll make, tap to start / change" for the 5 starter
  sentences, live steps UI, receipt + undo in Activity. Phone stacks, desktop
  can sit in right panel.
- **Touches:** `ChatScreen.tsx`, `RightPanel.tsx`, future compiler-lite.
- **Open:** Q151 starter set; C66 worker-vs-chat (hybrid proposed).

## I20 — Saved links (sources + uploads, file for later)

- **From:** owner, 2026-10-11 — rarest-insect moment: 9 sources each discussing
  it, "can i save the links? for later read".
- **Says:** per-chip "save" + per-reply "save all" into a new `eumae:saved`
  store (`{uri, title, domain, savedAt, fromThread}`); Library gains a Saved
  filter beside uploads; dedup by URI. Uploads join the same shelf.
- **Touches:** new `src/saved.ts`, `ChatScreen.tsx` chips, `LibraryScreen.tsx`.
- **Open:** none — file by derived topic tags, folders only when earned (I23).

## I21 — Distill (9 pages into one note)

- **From:** owner, 2026-10-11 — "can it distill info on the pages i am asking
  about", note/doc/slide anything.
- **Says:** "Distill these" on a sourced reply sends the URIs back through the
  model (URL context tool) with a distill prompt (facts, agreements,
  disagreements, one line each + cited); output lands as a Note titled from
  the thread, sources attached as saved links. Note first (Notes exists);
  Doc/Slide later.
- **Touches:** `api/ai.ts` (distill action), `ChatScreen.tsx`, `notes.ts`.
- **Open:** exact distill prompt wording (needs I18).

## I22 — Waiter behavior (read back, propose, follow up)

- **From:** owner, 2026-10-11 — "like a waiter who reads back your order",
  plan approve/edit/add, follow-ups that share what it can do + ask to learn
  you, "save ideas for later phase in plan glass box".
- **Says:** multi-step asks end with a one-line read-back + approve/edit
  (C68/C69 propose-and-approve, C07 harmless-auto/consequential-asks live);
  after actions, one tied follow-up (deeper / organize / save) with examples
  of possible directions. Lives in the prompt (I18), rendered by the plan
  card (I19).
- **Touches:** `src/request.ts` (I18 layers), plan card (I19).
- **Open:** Q151 starter sentences; exact Layer 1 waiter wording.

## I23 — Filing rule (derive, don't invent; folders when earned)

- **From:** owner, 2026-10-11 — "how to file and how the app titles new
  folders".
- **Says:** no folders yet — saved links file by derived topic tags (domain +
  thread title at save time), filterable in Library. Titles come from the
  page, never invented. Folders only when 50+ saved makes tags feel thin,
  same derive-don't-invent rule.
- **Touches:** `src/saved.ts`, `LibraryScreen.tsx`.
- **Open:** tag derivation exact rules.

## I24 — Foreground/background working set (last message is king)

- **From:** owner, 2026-10-13 — the widget-v2 bug: ask for a widget, then plain
  sentences on other subjects keep producing new code versions.
- **Says:** every turn splits into BACKGROUND (compacted history; old code
  travels as one-line outcomes with file ids, never full text) + CURRENT
  REQUEST (the last message alone — the sole source of intent). Continuation
  rule with teeth: only iterate the artifact on explicit reference — name,
  pronoun, or build verb. A question, comment, or new topic is never a
  rebuild; unsure → answer in words + one line ("Still on the widget, or
  dropping it?").
- **Touches:** `src/request.ts` (I18 layers), thread window/compaction.
- **Open:** exact continuation wording; what the compactor keeps per outcome.

## I25 — Turn verdict + focus ledger (meta harness, lite)

- **From:** owner, 2026-10-13 — "it can't differentiate between what I asked
  before and what I'm saying now"; manual Context toggles shouldn't be the
  system.
- **Says:** the meta harness classifies each turn — continue / new / resume /
  meta-talk — and keeps a focus ledger with heat: referenced stays hot,
  ignored cools, an unbridged new topic parks the old focus as a one-line
  outcome. The `+` settings and Context panel become overrides on the
  automatic system, read back in the chip ("on: widget v1 · Build") — pin or
  drop, never hand-manage attention every turn.
- **Touches:** new focus module, request builder, chip.
- **Open:** classifier as heuristics-first vs cheap model call; heat half-life
  in turns.

## I26 — Clarify like the best, never like a form (anti-annoyance rule)

- **From:** owner, 2026-10-13 — glass-box plan + clarity confirmations wanted,
  "but could get annoying if it doesn't just get it like frontier models do";
  the goal is replacing frontier models on smarts + usefulness.
- **Says:** default is commit-and-receipt, not interrogation. Single clear
  commands execute; multi-step ends in the glass-box plan card (I19) with
  approve/edit, then receipt + undo. Clarify only on genuine ambiguity — one
  line, once per turn, never re-ask what focus already answers. Frontier "just
  gets it" by committing with an undo nearby; we match that, with the waiter
  (I22) reserved for the truly ambiguous.
- **Touches:** `src/request.ts` (I18), plan card (I19).
- **Open:** Q151 starter sentences (each maps to exactly one behavior); exact
  Layer-1 waiter wording.

## I27 — Artifact pinning + Build's exit rule

- **From:** owner, 2026-10-13 — code in the transcript pulls continuation;
  "back to the widget" should resume it, silence about it should end it.
- **Says:** built things live as versioned objects behind ids (Studio), not as
  chat text; the transcript carries outcomes. The Build harness pins artifact
  + version, with one exit rule: stop iterating the moment the person stops
  referring to it. "Back to X" reloads it as the working object; a new topic
  parks it with its state in one line.
- **Touches:** Studio/artifact store, `src/request.ts`, focus ledger (I25).
- **Open:** artifact store shape; version-list UI.

## I28 — Frontier catch-up list (their intelligent UI, distilled to ours)

- **From:** owner, 2026-10-13 — "chatgpt dropped intelligent ui features so i
  have to catch up"; goal is replacing frontier models.
- **Says:** the catch-up set, each mapped to ours: artifact/canvas pane →
  I27 + Studio; memory that holds ("remember X") → I30; projects holding files
  + chats → scope revival (I8 open); scheduled nudges → automations (I29,
  nudge-once); a voice that talks → voice-mode prompt rules (I18);
  deep-research → Distill (I21); share/export → already exists (drawer export,
  note share). Builds in harness order (I24–I27 first) — no feature lands that
  reintroduces the bleed.
- **Touches:** roadmap order more than files.
- **Open:** which catch-up item earns its build first after the harness slice.

## I29 — Vertical harnesses: opcode → skill → tool, agents, automations

- **From:** owner, 2026-10-13 — "meta harness versus the vertical harnesses";
  agents, automations, skill files, opcodes.
- **Says:** each job gets a vertical pack — entry verbs (Q151), narrow opcodes,
  its skills, its tools — loaded only while active, unloaded on topic change
  so the model can't keep building what was dropped. An agent is a vertical
  harness with a budget (N steps, Y minutes) + receipt obligation; an
  automation is trigger + harness + nudge-once (C66 worker-vs-chat). First
  vertical: Build with the I27 exit rule. First tool on the loop: save_link
  (I20, harmless, no approval). First gated action: plan approve/edit
  (I19 + I22).
- **Touches:** harness modules, `api/ai.ts` dispatcher, `src/request.ts`
  declarations.
- **Open:** C66, C68/C69, C07 (95/5 stands); the Q151 verb list.

## I30 — Memory tiers feeding focus (after focus works)

- **From:** owner, 2026-10-13 — memory + actions + briefing loops; memory
  without focus is just more clutter in the prompt.
- **Says:** four tiers — working (this focus, hot), episodic (parked focuses
  with outcomes), semantic (durable facts, said/inferred/observed tagged),
  procedural (skills + opcodes themselves). Retrieval keyed on focus entities,
  never dumped whole; local stores first, Supabase sync later behind the same
  get/save seams. Nothing memorized before I24–I25 hold. *When* each tier
  loads is I32.
- **Touches:** memory store, context builder, notes/threads/uploads seams.
- **Open:** store shape; what earns semantic promotion.

## I31 — Intent translator (understand-before-act)

- **From:** owner, 2026-10-13 — "can i build translator that parses what the
  message says and makes what i say more robust, clear, described, like label
  indicators"; is the translator deterministic code or an AI that reshapes
  mine before the main AI; who is being trained when every call is fresh.
- **Says:** two AI calls in a chain, not one prompt doing both jobs. Call 1
  (small/fast/cheap, ~80 JSON tokens, 2s timeout, deterministic-heuristic
  fallback so it can never block the reply) parses each message into
  `{intent, focus, mode, action, targets, ambiguity, rewritten}` — the
  rewritten request becomes CURRENT REQUEST for Call 2 (big/smart), which acts
  on it. One parse per turn, never chained translators; the translator
  clarifies intent, never rewords personality, and its JSON renders as the
  glass-box chip (`on: widget v1 · Build`) — tap-to-correct, and every
  correction saves `{raw, translator said, you meant}` as the eval set that
  trains the layer (prompts, heuristics, future classifier), never the
  weights. Splitting forces understand-before-act: acting can't win over
  understanding when the verdict must exist first.
- **Touches:** new translator module, `src/request.ts` (I18 builds on it), chip.
- **Open:** translator prompt wording; v0 heuristic list vs v1 model; chip
  correction UI.

## I32 — Memory load policy (when each tier loads, not just what they are)

- **From:** owner, 2026-10-13 — "do I have to read preferences + memory files
  every turn, or only for briefings / proactive / agents?"
- **Says:** every turn carries only the ID card (~60–100 tokens, stable,
  cached: name, tone, standing prefs, timezone) — continuity comes from the
  ledger, not re-reading. Per turn loads top 3–5 focus-relevant hits only,
  keyed on translator output; states ride the focus block and decay, prefs
  load only when this turn touches them. Full sweep once per session / on
  "brief me" (durable prefs + ~10 recent outcomes + open loops). Proactive and
  agents get mission briefs — the narrowest context that lets them succeed,
  no transcript. Wide raw files every turn is banned: it dilutes attention
  and busts the cache.
- **Touches:** `src/request.ts` context builder, I30 store, translator (I31).
- **Open:** ID card exact contents; retrieval scoring; session-sweep trigger.

---

## What the last round of fixes turned up (filed 2026-10-29 — none agreed yet)

Read out of the code while fixing read-aloud and the Studio flow, and checked
against the owner's PDF of the same day (*Eumae: Everything Left to Build*), so
nothing here repeats it. Each entry carries the PDF's own three words —
**Agreed**, **Idea**, **Open** — so the two lists read alike: **Idea** is
something only talked about, **Open** is a decision of his that is pending.
Nothing in this block is a commitment until he says a word and it lands in
`AGENTS.md` §6. His own list — the twelve sections of that PDF — is transcribed
in the section below it, because most of it had no entry here at all.

## I33 — One id maker (Idea)

- **From:** Cline, 2026-10-29 — a Studio item's id was `'sc' + Date.now()`, so
  two items made in the same millisecond got one id, and `saveSession` deletes
  by id before writing: the second silently erased the first. A message id
  already carried a counter for the same reason (`ChatScreen.tsx:146` says so in
  a comment) and Settings invents a third shape (`Settings.tsx:493`, time plus
  `Math.random()`).
- **Says:** ids come from one place — `newId(prefix)` in a new `src/ids.ts`,
  time plus a module counter, no randomness — used by threads, messages, Studio
  sessions and items, saved links and log rows. A check makes ten thousand in a
  loop and asserts they are all different, and greps the tree for `Date.now()`
  used as a key.
- **Touches:** `src/studioChat.ts`, `src/screens/ChatScreen.tsx`,
  `src/threads.ts`, `src/components/settings/Settings.tsx`, new `src/ids.ts`,
  `checks/`.
- **Open:** nothing — the prefixes stay, so ids already in a browser keep
  reading the same.

## I34 — The Studio brief is written four times (Open)

- **From:** Cline, 2026-10-29, reading `src/studioChat.ts` to fix a change
  request that got answered in prose instead of obeyed.
- **Says:** one question is declared in four places — the `StepId` union
  (`studioGuide.ts:26`), `stepsFor` (`:391`), `questionsFor`
  (`studioChat.ts:140`, rebuilt from `stepsFor` by hand in its `add` list), and
  its Skip label in a ternary inside `skip()` (`:268`). Adding a question means
  four edits and three of them fail silently: the pill shows, Skip leaves a blank
  heading in the brief, the spec loses a line. One table of question objects,
  read by all four, ends the class.
- **Touches:** `src/studioGuide.ts`, `src/studioChat.ts`;
  `checks/studiochat.mjs`, which now covers the flow end to end, so the
  refactor has a net under it.
- **Open:** whether the table is one array with `StepId` derived from it, or the
  order stays in `stepsFor` and only ids and labels move.

## I35 — Change an answer without starting over (Idea)

- **From:** the owner's still-open decision "Brief card or one question at a
  time", plus today's read: `ask()` only ever moves forward.
- **Says:** every answered question is already in `spec`, so make each step
  tappable while the flow waits — reopening one re-asks that question alone,
  keeps everything else and re-derives the brief. The step pills should also
  survive while she answers; today they leave the screen with the reply.
- **Touches:** `src/components/StudioChat.tsx`, `src/studioChat.ts` (`ask`,
  `push`, `spec`).
- **Open:** whether reopening a question invalidates the ones that depended on
  it (kind decides length) or only rewrites its own line.

## I36 — One way to fail (Idea)

- **From:** Cline, 2026-10-29 — an empty piece of text reached `/api/ai`, Google
  answered 400, and the refusal path stopped the entire read-aloud with "Read
  aloud failed. Try again."
- **Says:** every async path fails in the same shape: what happened, what was
  kept, and a retry that retries only the part that broke. "Try again." alone is
  the shape to avoid — it names neither cause nor scope, so the only thing a
  person can do is guess. The three refusals already sit together
  (`api/ai.ts:20-22`); this makes them honest about scope, not more numerous.
- **Touches:** `api/ai.ts`, `src/voice.ts` (`speak`'s refusal path),
  `ChatScreen.tsx`.
- **Open:** whether a failed step joins the plan card's receipt, so half a job
  is visibly half a job.

## I37 — Speed is a number, not a feeling (Idea)

- **From:** Cline, 2026-10-29 — `api/ai.ts:712` measures `serverMs` and
  `googleMs` for every spoken sentence and returns them; nothing in `src/` reads
  them (`grep -rn timing src/` comes back with one unrelated word in
  `studioGuide.ts`).
- **Says:** log them with the turn (first token, first sound, total), show the
  median in Settings → Logs beside the rows that are already there, and hold a
  budget in a check so a slow path is caught by a number instead of by the owner
  noticing. Today nothing in this repo can answer "did it get slower".
- **Touches:** `api/ai.ts`, `src/voice.ts` (`fetchClip`), `src/log.ts`,
  `Settings.tsx`.
- **Open:** what the budget is (first sound under 1.5s is the guess), and whether
  the number is his alone or shown to everyone.

## I38 — Every reply remembers how it was made (Idea)

- **From:** Cline, 2026-10-29 — "which prompt produced that?" is unanswerable
  from a stored message; `Msg` carries no stamp (`threads.ts:7`).
- **Says:** stamp each AI message with `{ promptVersion, model, mode, role,
  skill, thinking, voiceLocale }` at the one place `buildRequest` already knows
  all of it. Bumping the prompt becomes a version bump, and a screenshot becomes
  evidence.
- **Touches:** `src/threads.ts` (`Msg`), `src/request.ts`, `ChatScreen.tsx`.
- **Open:** whether the stamp is visible under a reply or debug-only. Showing it
  is not the fake-control problem — it is a read-out.

## I39 — Read out what changed, not the page (Idea)

- **From:** the owner's question today — "what happens if she says more after a
  code block?" — and the shape of a rebuild: the page changes and the voice has
  nothing worth saying about it.
- **Says:** after a make or a change, one spoken sentence per change ("moved the
  header up, cards are two across, the blue is darker") instead of reading the
  page or describing it. On any reply over ~150 words, read the first three lines
  and offer the rest ("want the details?").
- **Touches:** `src/voice.ts`, `src/studioChat.ts`, `src/request.ts` (the reply
  shape the model is asked for).
- **Open:** whether the change list is the model's own one-line summary or a diff
  computed here — the diff is honest, the summary is cheaper.

## I40 — The voice says when it can't speak your language (Open)

- **From:** Cline, 2026-10-29 — `api/ai.ts:638` reads
  `CHIRP_LOCALES.has(lang) ? lang : 'en-US'`, so a reply in a language with no
  Chirp voice is read aloud in English and nobody is told.
- **Says:** either map a fallback voice per language (the table belongs beside
  `voices.ts`) or say it plainly in Settings: "your language has no spoken voice
  yet; English will read it". Silently switching languages is the one outcome
  that reads as a bug to the person hearing it.
- **Touches:** `api/ai.ts`, `src/voiceLang.ts`, `src/voices.ts`, `Settings.tsx`.
- **Open:** one setting drives three things — what the recogniser hears, what the
  voice speaks, what language she replies in — so whether "how I talk" and "how I
  sound" should become two rows in Settings is his call.

## I41 — Quiet read-aloud is a rule, not an accident (Idea)

- **From:** Cline, 2026-10-29 — a page is no longer read aloud, but only because
  of a fence rule inside `splitStream`; nothing states the policy, so the next
  person to touch it can undo it by accident.
- **Says:** three written rules in place of one: prose yes; code, tables and URLs
  no; a long reply reads short. A long-press on the speaker button offers "read
  everything" for the times he does want the whole thing.
- **Touches:** `src/voice.ts` (`splitStream`, `chunks`), the speaker button in
  `ChatScreen.tsx`.
- **Open:** the word count that makes a reply "long", and whether the override is
  per reply or a setting.

## I42 — The thread paints one row, not every row (Idea)

- **From:** `ChatScreen.tsx:588` — every streamed chunk runs
  `setMsgs(m => m.map(...))` across the whole thread.
- **Says:** stream into the streaming row alone. Measure a 100-message thread on
  a phone before and after, so the change has a number to beat rather than a
  feeling to win.
- **Touches:** `ChatScreen.tsx`.
- **Open:** the before number.

## I43 — A bug report in one tap (Idea)

- **From:** the owner's testing loop — a deploy, a screenshot, a message; the
  evidence for one bug lives in three places and half of it is gone by the time
  he writes it down.
- **Says:** "Copy what happened" in Settings → Logs and in a reply's menu: the
  last N log rows, the turn stamp (I38), the message text and the settings that
  were on — as plain markdown, no real names (the §7 rule), ready to paste into a
  chat. No account, no upload.
- **Touches:** `src/log.ts`, `Settings.tsx`, `ChatScreen.tsx`.
- **Open:** what belongs in it; whether it also opens a prefilled issue.

## The owner's list, transcribed (his PDF, 2026-10-29)

The twelve sections of `Eumae-Left-to-Build.pdf`, filed as he wrote them and in
his order — "roughly in the order I'd build it", his words, and built things left
out. His legend has three states — **Agreed** (he said yes), **Idea** (only talked
about), **Open** (a decision of his is pending) — and he marks them inline where
they matter; where an item carries no mark it is left unmarked here rather than
guessed at. Nothing added, nothing re-worded into a claim he did not make. These
are the candidates for `AGENTS.md` §8's phases, behind the queue above.

## I44 — The pages Eumae cannot act on (his §1, tools)

- **From:** PDF §1 — "Eumae can do everything you can" (unmarked in the PDF).
- **Says:** his count, 57 actions exist today — tasks, events, goals, projects,
  notes, lists, subtasks, chats and the whole Library, all through the plan card
  with Undo. Still to add — and the app already supports these, Eumae just cannot
  reach them yet — page by page: **Flows** (create, edit steps, check off a step,
  mark done today, turn on or off, delete, add a starter flow, show a streak);
  **Console layout** (add, remove, move and resize a widget; add, rename and
  remove a page; make a project its own page); **Studio** (start a make, answer
  the brief, skip a question, make it, ask for a change, open a draft);
  **Classroom** (mark a lesson done, show course progress, check a quiz answer);
  **Guild** (assign, reassign, rename and delete work; message a person or group,
  draft first; answer a request; share and unshare with permissions; create or
  leave a group; remove a person); **Settings and getting around** (save or delete
  a role, turn Home or Desk on and off, change voice, speed or reply language, go
  to any screen or tab, undo the last change).
- **Touches:** the action registry under `src/eumae/`, the plan card and its Undo
  rows, and one tool group per screen.
- **Open:** none from him — except that "start a new chat" is skipped on purpose
  and uploading stays paperclip-only.

## I45 — The backend he has to switch on (his §2)

- **From:** PDF §2, "the big one" — the section that is as much his move as a
  build.
- **Says:** the tables are written (`001_core.sql`) — **Open:** he runs it, then I
  hook it up. Sign-in required once data is saved per person (**Open**, he is
  recommended yes). Works offline, then syncs across devices, moving everything
  off the browser's storage. Back up and restore everything; export all his data.
  Invite a tester or teammate. Housekeeping: make the repo private and move the AI
  prompts to the server (**Open**), stop saving big images inside chats.
- **Touches:** `api/ai.ts`, `src/auth.ts`, what `src/store/` reads and writes, the
  export and wipe paths in `Settings.tsx`, `.env.example`.
- **Open:** four of these are his call, not work — the script, sign-in, repo
  private with prompts on the server, and how far "export all your data" goes.
- **Note:** the pieces that are mine are already queued — I33's ids matter once
  rows come out of a server, and the "big images" half is the body cap
  `STANDARD.md` already enforces. What is new is offline-then-sync,
  backup/restore, and a tester account.

## I46 — The harness, in his words (his §3)

- **From:** PDF §3, "Eumae's brain".
- **Says:** a router that decides each turn whether you are talking, asking or
  making something (**Agreed in talk, not built**) — it is what stops an unrelated
  message turning into "page v2". A per-turn ticket: what you are looking at,
  recent messages and a summary, so it stops dumping the whole page every turn.
  Tools limited to the screen you are on, then a plan, a check after it acts, and
  a trace of what it did. Test sets ("golden evals") so changes do not break it.
  Per-action switches — "always ask" or "just do it" (Logbook, Permissions). A
  "Thinking" label, "Thought for Xs", and a steps trace.
- **Touches:** `api/ai.ts` (the turn), `src/eumae/` (tool scoping and the check),
  `Settings.tsx` (the switches), the chip row (the Thinking label and its
  seconds).
- **Open:** none stated — the router is the one item in this list he has already
  said yes to.
- **Note:** this is I24, I25 and I29 in his words. The router is I25's verdict,
  the ticket is the compaction I29 assumes, the switches are I29's C07. What is
  genuinely new is **golden evals** as a standing set — I37 measures one reply,
  not a suite — and the **Thinking label** with elapsed seconds, which nothing on
  screen shows today.

## I47 — Memory, as he describes it (his §4)

- **From:** PDF §4.
- **Says:** remember something, edit it, forget it, show what Eumae knows. Memory
  kept as readable documents, with "Keep this?" cards. Search by meaning across
  memory and items. A behavior profile learned with his OK — three to five starter
  questions, resettable.
- **Touches:** the Memory screen and its store, `api/ai.ts` for the profile turn.
- **Open:** none stated.
- **Note:** I30 and I32 decide where memory lives and what loads; this decides
  what he sees and can correct. The resettable profile is what keeps this inside
  his §7 privacy rule — that should be written as a rule, not left as a feature.

## I48 — Desk and the engine (his §5)

- **From:** PDF §5, "Eumae takes initiative".
- **Says:** Desk: post a suggestion, accept or dismiss it, search the Logbook. A
  server timer and jobs, so Eumae can work while the app is closed. Watcher:
  notices things and sends proposals to the Desk. A morning plan ("Today we're
  doing this") and change updates. A weekly receipt: loops closed, time saved,
  money recovered. Push notifications. Automations: "when this, do that",
  reminders at a time, checks on a schedule, with pause, run now and history.
  Nightly scorecards so it learns what he ignores.
- **Touches:** a job runner in `api/`, the Desk screen, `src/log.ts` (proposals
  and their dismissal), `vercel.json` (`maxDuration` is already 60).
- **Open:** none stated — but this is the largest block in his list and none of it
  exists: the Desk is a screen with no engine behind it.
- **Note:** `VISION.md:124` and `:220` already describe the watcher → gate →
  teller chain in prose, and `STANDARD.md:585` parks push with the later
  integrations. The design was written down; the queue entry was not.

## I49 — The Closer (his §6)

- **From:** PDF §6 — the section that had no entry in this file at all until now.
- **Says:** a promise tracker — who, reference number, deadline, follow-up when
  late. Dread kits: a script, the questions to ask, his info, a two-minute start,
  an outcome log. Prep cards for errands only a person can do. A fresh-start
  button. A queue that runs when the app opens.
- **Touches:** a new screen plus the tasks/projects the rest of the app already
  has; the queue-on-open is `src/log.ts` plus a boot hook.
- **Open:** none stated. Where it lives — its own screen or a widget on Home — is
  a question he has not been asked.

## I50 — Studio makes real files (his §7)

- **From:** PDF §7 — the second section that had no entry here at all.
- **Says:** style thumbnails and color swatches in the guided steps. A brief card
  instead of one question at a time (**Idea, not approved**). Eumae's own skill
  per kind — document, slides, sheet. Real exports: PowerPoint, Word, Excel and
  PDF. Generate images, SVG logos and icons. Forms, widgets and apps built from
  blocks; games and webpages as HTML. Video, album and agent kinds as backend jobs
  (shown as Soon today). A skill library in Library: edit, versions, his
  preferences, one starter skill per category. A Studio lookbook: real examples
  per style, Use this, Clone. Save any command as a recipe, schedule or button.
- **Touches:** `src/studioChat.ts` and `studioGuide.ts` (the steps and the brief),
  the export path (new — nothing writes `.pptx`/`.docx`/`.xlsx` today), Library's
  version store, `src/eumae/` for recipe-as-command.
- **Open:** **the brief card is his decision** — one card or one question at a
  time, which is the same fork the Studio flow already stands on (I34's missing
  single table is what makes either cheap). "Real exports" also needs a decision
  about what a `.pptx` is allowed to look like when we generate it with no
  template.
- **Note:** I17 covers image generation and I18/I19 cover the prompt and the card,
  so only those overlap; the exports, the skill library, the lookbook and recipes
  are all new. But the exports are not a surprise: `STANDARD.md` Part 6 ("Not
  now, on purpose", lines 585–587) already parks "the PDF/Doc/Slides forge"
  there — this section is what would move it out.

## I51 — Documents and viewers (his §8)

- **From:** PDF §8.
- **Says:** one rich doc editor everywhere — page view, outline, word count,
  versions, PDF and Word export. A viewer per file type: PDF with pages and zoom,
  images, webpages, links, routine, course and digest cards. "Ask Eumae to
  summarize" on any file; share to Guild. A Notes upgrade: search, pins, date
  groups, @links, photos, voice, brain-dump mode, spotting action items (**Idea;
  the toolbar shipped**).
- **Touches:** the doc and note editors, the Library preview, `api/ai.ts` for the
  summarize call.
- **Open:** none stated. The Notes upgrade is the one item he marks as Idea while
  saying the toolbar half is already live.

## I52 — Home and custom apps (his §9)

- **From:** PDF §9.
- **Says:** the phone opens on Eumae's own apps home (**Idea, after YC**, his call
  Oct 23). Add, remove, move and resize Home widgets; add, remove and reorder app
  tiles; new Home pages; wallpaper and theme. Eumae rebuilds Home for a job ("set
  me up for exam week") and tidies it, with his approval. Apps made in Studio:
  install to Home, update, remove, keep their own data, publish or share. Split
  Office in apps mode — Desk and Memory tiles, a chat per app, a preview sheet
  when a task is tapped (**Idea**). Small laptops: the app fills the screen,
  slimmer icons, a dock that hides, a sidebar that shrinks to icons (**Open**).
  Hosted pages with one safe bridge, publish permissions and a kill switch. A
  self-improving harness: proposals with evidence, approve, snapshot, rollback.
- **Touches:** the Home screen and Console layout, Studio's output kinds, the rail
  and tabbar (small laptops), `src/` auth and permissions for hosted pages.
- **Open:** three, all his: apps-home after YC, the Office split, and the
  small-laptop layout. The last one is already on §8's decision list.
- **Note:** hosted pages and the self-improving harness are the two items with
  real security weight — both want a rule in `STANDARD.md` before code, the way
  the §7 privacy rule was written first.

## I53 — Outside Eumae, with Eumae as the go-between (his §10)

- **From:** PDF §10.
- **Says:** search the web and read pages. Email: read once connected, send with a
  draft first. Sync an outside calendar (Calendar, then Gmail, Drive, Slack). Bank
  data, read-only through Plaid. Capture from anywhere: share sheet, forwarded
  email, screenshot, voice note. Website errands in a cloud browser.
- **Touches:** `api/` integrations and their keys, the share sheet (a mobile
  target that does not exist yet), `.env.example`.
- **Open:** none stated, but the order matters and he gave it: web and email
  first, calendar next, bank last. Each one is a credential question before it is
  a code question.
- **Note:** the share sheet is already parked in `STANDARD.md` Part 6 with push
  and the forge (lines 585–587), and `src/` has no mobile target to hang one on —
  so "capture from anywhere" is a build, not a setting.

## I54 — Guild and teams (his §11)

- **From:** PDF §11.
- **Says:** pick members when making a group. People first: a person page,
  Requests tabs, a shared work list. Teams for family, friends and employers —
  shared projects, requests, hand-offs, roles, caregiving. A systems library:
  share your systems (never your memory), with "life event" starter kits.
- **Touches:** the Guild screen, the person page, sharing and permissions in
  `src/`, the Library's share path.
- **Open:** none stated.
- **Note:** "never your memory" is the same line as the §7 privacy rule and should
  be read as part of it — a systems library that could leak memory would break it.

## I55 — The smaller fixes he is still waiting on (his §12)

- **From:** PDF §12.
- **Says:** tasks and goals have no read-only view yet (a tap opens the form). The
  person page's "Linked" still shows the first three files. Some old 12px text
  left in places. The phone's ⋮ menu in the Drawer is untested. QuickAdd "More" on
  iPhone closes before the tap lands. Phases shown like the Timeline spine on a
  project (**Idea**). Marking an event attended before it ends (**Idea**). A
  widget size picker S/M/L/XL with even grid spacing; a "+ New page" sheet with
  starter templates. Classroom's create sheet (title, type, source, audience).
  Dead code cleanup — about 18 unused bits.
- **Touches:** the task and goal forms, the person page, `QuickAdd.tsx` (285 lines
  today — `AGENTS.md`'s file table still says 466), the Console grid, the Drawer,
  Classroom.
- **Open:** none stated — these are all his observations from using it, which
  makes them the most reliable items in this section.
- **Note:** two are outright bugs rather than ideas (QuickAdd's tap and the
  untested Drawer menu) and belong in `AGENTS.md` §7's known-gaps list when they
  are picked up, not left only here.

## I56 — The seven decisions still waiting on him (his closing list)

- **From:** PDF, "Decisions waiting on you" — his own list, and the gate in front
  of most of the section above.
- **Says:** (1) run the database script so the backend can start; (2) is sign-in
  required (he is recommended yes); (3) make the repo private and move prompts to
  the server; (4) the wedge — people who outgrew their tools, ADHD-ish, or local
  owners; (5) brief card or one question at a time in Studio; (6) the small-laptop
  layout fix; (7) do AI-only things also get a manual path (a blank course, a
  blank doc)?
- **Open:** all seven, by definition.
- **Note:** **Never, by design** — sign out, deleting an account, payments. He
  closed the list with that line, and it is the most load-bearing sentence in the
  file: three things this app will not grow. It should be quoted in `STANDARD.md`
  as a non-goal so a future reader does not build them for completeness's sake.

---

## Reversals and changes of mind

- **2026-10-06 — the chip.** First: "only mode and role shows as chips". Minutes
  later: "all things in picker should show as chips and in context panel". The
  second is what stands (I4). Recorded because the first is in the transcript and
  a later reader will find it there.

## The order these imply

1. **Docs — ✅** this file, plus the `AGENTS.md` §4.3 / §4.7 amendments and the
   new §4.13.
2. **Phase 5 — I1–I4, one change. ✅** `+` became the window and stopped attaching;
   "Scope to a project" returned to the rail; the chip carries the whole turn; the
   Context reading gained its read-only block and lost its false sentence. Landed
   2026-10-07, written up in `AGENTS.md` §6.
3. **Phase 6 — as already written, plus I5.** Sandbox, artifacts, `/api/ai`; and
   the facets land with it, because that is the phase where Eumae's own rows
   first exist.
4. **Phase 7 — I6 + I7.** The Logs lens in Settings, over one filter object.
5. **Whenever — I8 and I9**, plus the open owner decisions still standing: wire or
   hide the mic (I9); drive or label always-in-context (I8); and where a project
   scope is chosen now that the rail row is back but inert (§4.13).
6. **Harness first — I24 → I25 → I26/I27, then tools, then memory, then
   surface.** Focus and the foreground/background split land before anything
   that adds tokens: pages (Console/Studio/Classroom/Guild content) and crew
   wait until the bleed is dead, because every new source multiplies it until
   then. I20 save_link is the first tool on the loop; I30 memory after; the
   I28 catch-up list orders behind the slice.
7. **What today's fixes turned up — I33–I43 (2026-10-29, none agreed).** I33, I34
   and I42 are cheap and ride along with whichever phase next touches those
   files. I36, I38 and I43 pay for themselves the first time something breaks on
   a deploy he is testing. I35, I39, I40 and I41 wait on a word from him — and
   I40 is the only one of the eleven that is a lie the app tells today: English
   reading a reply that is not in English, with nobody saying so.
8. **His own list — I44–I56, transcribed verbatim (2026-10-29).** Not next: the
   queue behind `AGENTS.md` §8's phases, and §8's order still rules. It argues for
   the backend switch-on early rather than late, because I48's jobs and I52's
   hosted pages are the two items that must run unattended — and unattended work
   needs a deploy that fails loudly, which is §8's error boundary and monitoring.
   I56's seven decisions gate most of the list, and two of the sections he cares
   most about, The Closer (I49) and real exports (I50), are among the cheapest
   things in it.
