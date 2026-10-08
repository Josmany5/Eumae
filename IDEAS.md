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
