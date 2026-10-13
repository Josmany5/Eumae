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
  get/save seams. Nothing memorized before I24–I25 hold.
- **Touches:** memory store, context builder, notes/threads/uploads seams.
- **Open:** store shape; what earns semantic promotion.

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
