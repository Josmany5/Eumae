/* Studio catalog: what Eumae can make, and how a good one is built.
 *
 * TY8 (12 categories with their templates) and TPL8 (per-template explainer
 * + starter variants + build checklist) are the mockup's own copy, verbatim.
 * This module is data only - the screen owns the sCat/stS/sTpl walk, and
 * goBuild8 semantics live here as pure builders on the real stores
 * (projects, flows, library files). Chat handoff is the screen's job.
 */

import type { LibKind } from './library';

export const STUDIO_CATEGORIES: Record<string, string[]> = {
  Document: ["Résumé", "Essay", "Pitch deck", "Report", "Memo"],
  Webpage: ["Landing page", "Portfolio", "Invitation"],
  App: ["Tracker", "Calculator", "Game"],
  Automation: ["Morning brief", "Follow-up flow", "Weekly review"],
  Image: ["Illustration", "Poster", "Logo"],
  Course: ["From a book", "From a topic"],
  Training: ["Onboarding", "Safety basics", "Sales playbook"],
  Widget: ["Dashboard card", "Timer", "Habit tracker"],
  Project: ["Blank project", "From a goal"],
  Flow: ["Checklist flow"],
  Routine: ["Daily routine", "Weekly routine"],
  Chart: ["Tasks chart", "Training chart", "Focus chart"],
  Skill: ["Follow-up writer", "Site teardown", "Morning researcher"],
  Slides: ["Pitch deck", "Lesson deck", "Report deck"],
  PDF: ["Menu", "Rate sheet", "One-pager"],
  Sheet: ["Budget", "Tracker sheet", "Schedule"],
  Form: ["Intake form", "Survey", "Sign-up"],
  Quiz: ["Quick check", "Exam practice"],
  Flashcards: ["Vocabulary", "Formulas"],
  Email: ["Follow-up", "Intro", "Update"],
  Checklist: ["Morning routine", "Launch checklist", "Packing list"],
};

/* What kind of Studio item each category makes. Project/Flow/Routine make
   their own real things instead, so they have no entry. */
const KIND_FOR_CAT: Record<string, LibKind> = {
  Document: 'DOC', Email: 'DOC', Checklist: 'DOC', Skill: 'DOC', Sheet: 'DOC',
  Quiz: 'DOC', Flashcards: 'DOC',
  Webpage: 'WEB', App: 'WEB', Form: 'WEB', Slides: 'WEB',
  Widget: 'WIDGET', Chart: 'WIDGET',
  Image: 'IMG', PDF: 'PDF',
  Course: 'COURSE', Training: 'COURSE',
  Automation: 'ROUTINE',
};

export function kindFor(cat: string, tpl: string): LibKind | null {
  if (cat === 'App' && tpl === 'Game') return 'GAME';
  return KIND_FOR_CAT[cat] ?? null;
}

/* The draft a Studio brief is making. Studio arms it; the first page that
   chat's reply makes takes it (sandbox.addFromReply), so the page and the
   Studio draft are one thing. Expires after 15 minutes so a stale one
   never grabs an unrelated page. */
const DRAFT_KEY = 'eumae:pendingDraft';

export function armDraft(fileId: string): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: fileId, at: Date.now() }));
  } catch {
    /* Non-fatal. */
  }
}

export function takeArmedDraft(): string | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    localStorage.removeItem(DRAFT_KEY);
    const p = JSON.parse(raw);
    if (p && typeof p.id === 'string' && Date.now() - Number(p.at) < 15 * 60 * 1000) return p.id;
  } catch {
    /* Fall through. */
  }
  return null;
}

export const STUDIO_CATEGORY_ORDER = Object.keys(STUDIO_CATEGORIES);

/* Category icons - the mockup's CAI8. All exist in icons.tsx. */
export const STUDIO_CATEGORY_ICONS: Record<string, string> = {
  Document: "doc",
  Webpage: "lnk",
  App: "db",
  Automation: "zap",
  Image: "img",
  Course: "cap",
  Training: "chk",
  Widget: "fol",
  Skill: "zap",
  Slides: "doc",
  PDF: "doc",
  Sheet: "db",
  Form: "chk",
  Quiz: "cap",
  Flashcards: "cap",
  Email: "chat",
  Checklist: "chk",
  Project: "fol",
  Flow: "zap",
  Routine: "clk",
  Chart: "db",
};

export interface StudioTemplate {
  /** What it is - the mockup's T.u. */
  u: string;
  /** How a good one is built - the mockup's T.s. */
  s: string[];
  /** Starter variants: [style, title, ...lines] - the mockup's T.v. */
  v: string[][];
}

export const STUDIO_TEMPLATES: Record<string, StudioTemplate> = {
  "Blank project": { u: "A project is one outcome with tasks under it. Name the outcome, not the activity.",
    s: ["Outcome in the name", "First three tasks written down", "One next action for today"],
    v: [["Starter", "Untitled project", "Outcome:", "First tasks:"]] },
  "From a goal": { u: "Turns a goal you already have into a working project with steps.",
    s: ["Pick the goal it serves", "Break it into first steps", "Open it and start today"],
    v: [["Starter", "Goal project", "Goal:", "First steps:"]] },
  "Checklist flow": { u: "A flow is a checklist you run yourself, on your own schedule. Eumae keeps the checks.",
    s: ["Steps in order, one action each", "Say when it runs", "Keep it under seven steps"],
    v: [["Starter", "New flow", "Steps:", "Runs:"]] },
  "Daily routine": { u: "The same steps, every day. Small enough to never skip.",
    s: ["Three to five steps", "Same time daily", "Check off as you go"],
    v: [["Starter", "Daily routine", "Steps:", "Time:"]] },
  "Weekly routine": { u: "A weekly rhythm - review, plan, reset.",
    s: ["One sitting, same day", "Look back, then ahead", "End with one priority"],
    v: [["Starter", "Weekly routine", "Steps:", "Day:"]] },
  "Tasks chart": { u: "Your tasks, done vs open, across the week. Made from your own data.",
    s: ["One number per day", "Done counts, not intentions"],
    v: [["Bars", "Tasks this week", ""]] },
  "Training chart": { u: "Sessions this week vs your rhythm. Made from your own data.",
    s: ["Sessions per day", "Streak visible"],
    v: [["Bars", "Training this week", ""]] },
  "Focus chart": { u: "Focus minutes per day this week. Made from your own data.",
    s: ["Minutes per day", "Best day marked"],
    v: [["Bars", "Focus this week", ""]] },
  "R\u00e9sum\u00e9": { u: "Get one job. A r\u00e9sum\u00e9 is read in six seconds - the top third decides.",
    s: ["Headline first: the role you want, not your history", "Proof numbers over duty lists", "One page unless the work says otherwise"],
    v: [["Classic", "Josmany Juvier - Web Designer", "Uptown Web Design \u00b7 NYC", "Built 4 client sites, one flat price", "Terravita pitch - live mockup in 48 hours"], ["Bold", "I BUILD SITES THAT ANSWER THE PHONE", "4 launches \u00b7 $400 flat \u00b7 no templates", "Every site ships with call tracking", "uptownwebdesign.com"]] },
  "Essay": { u: "Argue one idea and land it. Essays persuade by structure, not length.",
    s: ["One claim, stated early", "Each paragraph earns the next", "End on the implication, not a summary"],
    v: [["Classic", "Why chat is a command line", "Interfaces hide their power; text doesn't", "Every app you love is a form wearing a costume", "The prompt is the new blank page"], ["Personal", "The year I stopped outsourcing my thinking", "I let tools decide, then I decided to notice", "Systems are just habits with an address", "Build the system, then live in it"]] },
  "Pitch deck": { u: "Raise money or win the client: their problem, your fix, proof, one ask.",
    s: ["Open on the problem in their words", "Show the fix working, not described", "End with a single clear ask"],
    v: [["Classic", "Terravita - one-page rebuild", "Mobile diners bounce in under 4 seconds", "New page: bookings up, every call tracked", "$400 flat \u00b7 live in a week"], ["Bold", "YOUR SITE IS LEAKING DINERS", "78% of restaurant searches are on phones", "We rebuild the page they land on", "One page. One price. This week."]] },
  "Report": { u: "Status someone can act on: what happened, what it means, what's next.",
    s: ["Lead with the conclusion", "Numbers with the 'so what' attached", "Risks named before they surprise"],
    v: [["Weekly", "Eumae - week of Oct 3", "Demo: Chat works end to end", "Blocked: none. Risk: Nov 2 scope creep", "Next: v8 navigation mockup"], ["Status", "Uptown Web Design - October", "Sites live: 4 \u00b7 Leads: 3", "Terravita is the warm one - follow up Monday", "Next: one call, one mockup"]] },
  "Memo": { u: "A short decision document. Reader should finish knowing what you want.",
    s: ["First line: the ask", "Three supporting points, no more", "What happens if we do nothing"],
    v: [["Decision", "Memo: ship v8 before the backend", "Demo needs one honest screen flow", "Backend is five boxes; Nov 2 shows the slice", "Doing nothing costs the YC shot"], ["Update", "Memo: agents get names", "A name is a job title, not a second mind", "Eumae is the intelligence in every seat", "Effective now, everywhere"]] },
  "Landing page": { u: "One page, one action. Everything on it argues for the tap.",
    s: ["Headline = the outcome, not the product", "One call to action, repeated", "Proof near every claim"],
    v: [["Classic", "Uptown Web Design", "A website that answers the phone", "$400 flat \u00b7 live in a week", "See the Terravita mockup"], ["Bold", "YOUR CUSTOMERS ARE GOOGLING YOU RIGHT NOW", "What they find is either a menu or a mess", "Fixed in a week, one flat price", "Get the free mockup"]] },
  "Portfolio": { u: "Show the work, let it talk. Captions carry context, not pride.",
    s: ["Best three pieces first", "Each piece: problem, choice, result", "Contact on every screen"],
    v: [["Grid", "Selected work 2024-26", "Terravita - restaurant rebuild", "Neon Maze - browser game", "Eumae - personal AI, in progress"], ["Story", "How the Terravita page got rebuilt", "The old site hid the phone number", "One page, one button: Call", "Bookings called within the first week"]] },
  "Invitation": { u: "Who, what, when, where - and one button to answer.",
    s: ["The occasion in the first line", "Date and place impossible to miss", "RSVP is one tap"],
    v: [["Classic", "Demo Day - Eumae", "Monday, Nov 2 \u00b7 6 PM", "Live: chat builds a widget in 60 seconds", "Tap to RSVP"], ["Warm", "Friendsgiving at Josmany's", "Saturday \u00b7 4 PM until late", "Bring a side; the turkey's handled", "Tap to RSVP"]] },
  "Tracker": { u: "A small app that watches one number so you don't have to.",
    s: ["One number, big", "Log in under three seconds", "Streaks beat charts"],
    v: [["Kung fu", "Class counter - 94 of 156", "Mon \u00b7 Wed \u00b7 Fri", "Next: Monday, class 94", "94 classes \u00b7 60% there"], ["Money", "Uptown pipeline", "3 leads \u00b7 1 pitch out", "Terravita: follow up Monday", "First $400 closes the loop"]] },
  "Calculator": { u: "Answers one money or time question with your real numbers.",
    s: ["Inputs only you know", "The answer first, math below", "No sign-up wall"],
    v: [["Site ROI", "What a $400 site returns", "10 extra calls a month", "Pays for itself in the first week", "Try your numbers"], ["Freelance rate", "What to charge per project", "Rent $1,500 \u00b7 12 billable days", "Rate: $185 per project-day minimum", "Adjust the inputs"]] },
  "Game": { u: "Thirty seconds to fun, one more round after that.",
    s: ["Playable before any instructions", "Score visible, failure instant", "Restart is one tap"],
    v: [["Neon Maze", "Neon Maze Puzzle", "Reach the exit before the grid folds", "Level 12 \u00b7 best 0:48", "Tap to play"], ["Arcade", "Neon Strikers", "Dodge, shoot, survive the wave", "High score 12,400", "Tap to play"]] },
  "Morning brief": { u: "An automation that reads overnight and hands you one focus by 7 AM.",
    s: ["Runs weekdays at 7:00 AM", "Gathers: inbox, calendar, open tasks", "Ranks one focus - you approve the day"],
    v: [["Standard", "Morning brief", "Overnight: demo outline drafted", "Carried over: call Marcus", "Focus: draft the YC demo script"], ["Short", "7:00 AM brief", "3 new requests in Guild", "Kung fu at 9 - leave by 8:30", "One focus: the demo script"]] },
  "Follow-up flow": { u: "Never let a lead go quiet. Nudges on a schedule until they answer.",
    s: ["Triggers 2 days after a sent pitch", "Two nudges, then it stops", "You approve every message first"],
    v: [["Standard", "Follow-up - Terravita", "Pitch sent Monday", "Nudge 1: Thursday", "Nudge 2: next Tuesday, then done"], ["Gentle", "Follow-up flow", "Day 2: a short check-in", "Day 5: the mockup link again", "Day 9: close the loop politely"]] },
  "Weekly review": { u: "Friday's automation: what got done, what slipped, what's next week.",
    s: ["Runs Fridays at 5 PM", "Compares plan vs actual", "Proposes next week's one focus"],
    v: [["Standard", "Week in review", "Shipped: v6 navigation audit", "Slipped: Terravita follow-up", "Next week: v8 + one sales call"], ["Numbers", "Weekly review - by the numbers", "Tasks closed: 11 \u00b7 Classes: 3", "Deep work: 9.5 hours", "Next: protect the mornings"]] },
  "Illustration": { u: "A drawn image for a post, page or deck - built to your palette.",
    s: ["One subject, readable at thumbnail size", "Two or three colors, used consistently", "Space left for your text"],
    v: [["Flat", "Flat illustration", "Fierce lion, geometric, gold on black", "For the avatar", "1024 x 1024 PNG"], ["Line", "Line illustration", "Single-weight line, no fill", "Climber on a wall, negative space", "For a post header"]] },
  "Poster": { u: "One message readable from across the room.",
    s: ["Five words or fewer, huge", "One image idea", "Details small at the bottom"],
    v: [["Bold", "DEMO DAY", "Eumae - chat builds it live", "Nov 2 \u00b7 6 PM \u00b7 NYC", "Scan to RSVP"], ["Minimal", "Build in public.", "One honest screenshot a day", "Follow along", "Follow along"]] },
  "Logo": { u: "A mark that survives being tiny, black-and-white, and faxed.",
    s: ["Works at 16 pixels", "No gradients doing the talking", "One idea, geometric"],
    v: [["Mark", "Eumae mark", "An open eye that is also a doorway", "Reads at favicon size", "SVG + PNG exports"], ["Wordmark", "UPTOWN", "Heavy grotesk, tight tracking", "Teal on brick, or black on white", "Full lockup + short mark"]] },
  "From a book": { u: "A course built from a book you own: chapters become lessons with checks.",
    s: ["Chapter to lesson to 3 questions", "Your highlights become the examples", "Progress saved in Classroom"],
    v: [["The Design of Everyday Things", "Course from Don Norman", "12 lessons \u00b7 quizzes after each", "Lesson 3: affordances", "Continue where you left off"], ["Working in Public", "Course from Nadia Eghbal", "9 lessons \u00b7 key terms deck", "Lesson 1: platforms and maintainers", "Start lesson 1"]] },
  "From a topic": { u: "Say the subject; Eumae lays out a syllabus and teaches it in order.",
    s: ["Syllabus first - you approve the path", "Each lesson ends with a check", "Difficulty adapts to your answers"],
    v: [["Physics", "OpenStax Physics - your pace", "28 stops \u00b7 Vol 1 first", "Next: Units and standards", "Resume the lesson"], ["Spanish", "Spanish for travel", "12 lessons \u00b7 speaking first", "Lesson 5: the past tense", "Resume lesson 5"]] },
  "Onboarding": { u: "A training that gets a new person useful in week one.",
    s: ["Day-by-day, not a document dump", "Each day ends with one real task", "Manager sees completion in Guild"],
    v: [["Standard", "New hire - week one", "Day 1: tools and introductions", "Day 3: first supervised delivery", "Day 5: solo run, reviewed"], ["Checklist", "Onboarding checklist", "Accounts created \u00b7 buddy assigned", "Shadowing scheduled \u00b7 first task set", "Progress visible to the assigner"]] },
  "Safety basics": { u: "The training nobody reads until it matters. This one gets finished.",
    s: ["Short lessons, plain words", "A check after each one", "Completion logged for the assigner"],
    v: [["Standard", "Safety basics", "Lesson 1: lifting without injury", "Lesson 2: when to stop and call", "4 lessons \u00b7 6 minutes each"], ["Scenario", "Safety scenarios", "The load shifts mid-stairwell", "Pick the right response", "Scored, with explanations"]] },
  "Sales playbook": { u: "Your pitch as a training: what to say, when, and what to send after.",
    s: ["The opener, word for word", "Objection to your real answer", "Follow-up flow attached"],
    v: [["Standard", "Uptown sales playbook", "Open: your site is losing phone diners", "Objection: we get walk-ins", "Sends the follow-up flow after"], ["Cards", "Objection cards", "Too expensive - the math", "My nephew does sites - the mockup", "Swipe through before a call"]] },
  "Dashboard card": { u: "A widget that lives on Console: one glance, always current.",
    s: ["One question per card", "Updates itself from your data", "Tap opens the full page"],
    v: [["Tasks", "Today's tasks - card", "3 open \u00b7 1 done", "Next: draft the YC demo script", "Tap for the full list"], ["Next up", "Next up - card", "9:00 AM Kung fu class", "Then deep work until 1", "Tap for Calendar"]] },
  "Timer": { u: "A focus timer that files what you did when it ends.",
    s: ["25 minutes, one task", "End = a line in your history", "Streaks counted quietly"],
    v: [["Focus", "Focus 25", "Deep work: Eumae demo", "Started 9:02 AM", "Ends with a filed receipt"], ["Sprint", "Sprint 10", "Quick tasks only", "Three in a row counts as a set", "Tap to start"]] },
  "Habit tracker": { u: "Tap the day, keep the chain. Lives on Console as a card.",
    s: ["One tap per day", "The chain is the reward", "Missed days shown, never scolded"],
    v: [["Chain", "Kung fu chain", "Mon \u00b7 Wed \u00b7 Fri - 31 weeks", "Current chain: 6 classes", "Tap today's box"], ["Grid", "Morning grid", "Workout \u00b7 Study \u00b7 Ship", "This week: 5 of 7", "Tap to fill today"]] },
  /* v12 additions: Skill, Slides, PDF, Sheet, Form, Quiz, Flashcards, Email, Checklist. */
  "Follow-up writer": { u: "A skill is a recipe Eumae follows: same inputs, same good output, every time.",
    s: ["Trigger in plain words: when a pitch is 2 days old", "The output is a draft - never sent without you", "Two nudges, then it stops"],
    v: [["Standard", "Follow-up writer", "Watches sent pitches", "Day 2: short check-in draft", "Day 5: the mockup link, once more"],
      ["Gentle", "Follow-up writer - gentle", "One nudge only, day 3", "Closes the loop politely", "Stops forever after"]] },
  "Site teardown": { u: "Point it at any webpage; get the defect list a designer would write.",
    s: ["Reads the page like a phone user, not a desktop", "Every defect ranked by money lost", "Fixes written as plain instructions"],
    v: [["Standard", "Site teardown", "55 defects on terravitarestaurants.com", "Top: phone number below the fold", "Each fix in plain words"],
      ["Quick", "Site teardown - quick pass", "Top 10 defects only", "Five minutes, ranked", "For a first sales call"]] },
  "Morning researcher": { u: "A skill that gathers overnight and hands you one page by morning.",
    s: ["Sources named up front - no mystery feeds", "One page, ranked, with links", "Learns what you actually read"],
    v: [["Standard", "Morning researcher", "AI news + your watchlist", "Three items, ranked by your work", "Delivered 7:00 AM"],
      ["Watchlist", "Morning researcher - watchlist", "Only your named sources", "Skips the noise entirely", "One page, links included"]] },
  "Lesson deck": { u: "Slides that teach hold one idea each and make the student say it back.",
    s: ["Idea, example, check - repeat", "Big type, few words", "Ends with the one thing to remember"],
    v: [["Class", "Lesson deck", "5 slides per concept", "Quick check on slide 4"]] },
  "Report deck": { u: "A report deck is numbers with a story: what changed, why, what's next.",
    s: ["Headline result first", "One chart per claim", "Last slide: the decision you need"],
    v: [["Weekly", "Weekly report deck", "Wins, numbers, next week", "6 slides max"]] },
  "Menu": { u: "A menu PDF sells with whitespace and prices that are easy to find.",
    s: ["Sections by course, not by kitchen logic", "Prices aligned, nothing buried", "One special called out"],
    v: [["Dinner", "Dinner menu", "Starters → mains → dessert", "PDF, print-ready"]] },
  "Rate sheet": { u: "A rate sheet answers 'how much' in ten seconds.",
    s: ["Services as rows, prices as a column", "What's included under each price", "Contact on every page"],
    v: [["Services", "Rate sheet", "Flat prices, no ranges", "One page"]] },
  "One-pager": { u: "One page, one job: make the reader say yes to a meeting.",
    s: ["Problem, fix, proof, price - in that order", "One image max", "Contact loud at the bottom"],
    v: [["Sales", "Sales one-pager", "For handing over after a call", "Print and PDF"]] },
  "Budget": { u: "A budget sheet is income, outgo, and what's left - nothing fancier until it's true.",
    s: ["One row per line, monthly", "Totals that add themselves", "A 'what's left' row in bold"],
    v: [["Monthly", "Monthly budget", "Rent, food, training, ship money", "Red when a row busts plan"]] },
  "Tracker sheet": { u: "A tracker works when filling it takes five seconds.",
    s: ["Date, thing, number - three columns", "Totals at the top, not the bottom", "One row per day"],
    v: [["Training", "Training tracker", "Class #, what we drilled, how it felt", "60% bar built in"]] },
  "Schedule": { u: "A schedule sheet is the week at a glance - time down the side, days across.",
    s: ["Blocks, not lines", "Fixed things first, flex around them", "Print size: one page"],
    v: [["Week", "Week schedule", "Work, study, training blocks", "Color by kind of work"]] },
  "Intake form": { u: "An intake form asks only what changes the work.",
    s: ["Five questions max", "One question per screen on mobile", "Answers land in a note automatically"],
    v: [["Client", "Client intake", "Name, project, budget, deadline", "Sends to your Notes"]] },
  "Survey": { u: "A survey people finish asks one thing at a time and shows progress.",
    s: ["Under two minutes or it dies", "Mostly taps, one write-in", "Thank-you with what's next"],
    v: [["Quick", "Quick survey", "3 taps, 1 write-in", "Results as a list"]] },
  "Sign-up": { u: "A sign-up form trades one field at a time for trust.",
    s: ["Name and contact first, details later", "What they get, stated plainly", "Confirmation on screen, not just email"],
    v: [["Class", "Class sign-up", "Name, level, goal", "Waitlist when full"]] },
  "Quick check": { u: "A quick check is three questions that prove the last five minutes landed.",
    s: ["One right answer, two tempting wrong ones", "Feedback after each answer", "Score at the end, no shame"],
    v: [["Lesson", "Lesson quick check", "3 questions, instant feedback", "Missed ones come back tomorrow"]] },
  "Exam practice": { u: "Practice exams work when they're harder than the real thing.",
    s: ["Timed, no pausing", "Answers explained at the end", "Weak spots listed after"],
    v: [["Drill", "Exam drill", "10 questions, 8 minutes", "Ends with what to restudy"]] },
  "Vocabulary": { u: "Flashcards stick when the card makes you say it before you flip.",
    s: ["Word up front, meaning + example behind", "Missed cards return sooner", "20 a day beats 200 once"],
    v: [["Spanish", "Spanish vocab", "Ser/estar set, 20 cards", "Example sentence on every back"]] },
  "Formulas": { u: "Formula cards teach when to reach for it, not just what it is.",
    s: ["Situation on the front", "Formula + one worked example behind", "Units always shown"],
    v: [["Physics", "Physics formulas", "Kinematics set", "Worked example per card"]] },
  "Follow-up": { u: "A follow-up email is short, specific, and easy to answer.",
    s: ["Reference the last thing, by name", "One question, not three", "A next step with a date"],
    v: [["Sales", "Sales follow-up", "Sent the mockup Tuesday…", "Ends with one yes/no question"]] },
  "Intro": { u: "An intro email earns the reply in the first two lines.",
    s: ["Who you are, why them, one proof", "No life story", "One small ask"],
    v: [["Cold", "Cold intro", "Terravita-style: their site, your fix", "Four lines total"]] },
  "Update": { u: "An update email respects the reader: what changed, what it means, what's next.",
    s: ["Three bullets max", "Numbers where they exist", "One ask, at the end"],
    v: [["Weekly", "Weekly update", "Shipped, learned, next", "Five lines"]] },
  "Morning routine": { u: "A morning checklist works when it's tap-sized and in order.",
    s: ["Order matters - write it in sequence", "Times on the left", "Under ten items"],
    v: [["Daily", "Morning routine", "Wake, train, study block", "Missed days shown, never scolded"]] },
  "Launch checklist": { u: "A launch checklist is everything you'd forget under pressure, in order.",
    s: ["Sections: build, money, people, day-of", "Each item one tap to check", "Owner per section"],
    v: [["Ship", "Launch checklist", "Demo day version", "Ends with 'press send'"]] },
  "Packing list": { u: "A packing list groups by bag, not by thing.",
    s: ["Sections per bag or room", "Check as you pack, not before", "The 'last out' row: chargers, keys"],
    v: [["Trip", "Trip packing", "Carry-on only version", "Weather-based swaps"]] },

};
export function templateOf(name: string): StudioTemplate | null {
  return STUDIO_TEMPLATES[name] ?? null;
}

export function categoryOf(template: string): string | null {
  for (const [cat, names] of Object.entries(STUDIO_CATEGORIES)) {
    if (names.includes(template)) return cat;
  }
  return null;
}

/* The brief Studio sends to Chat - the mockup's goBuild8 string:
   "Make a {template} ({style} style: {title})" + purpose + must-include. */
export function buildBrief(template: string, variant: number, purpose: string, details: string): string {
  const T = templateOf(template);
  const v = (T && T.v[variant]) || (T && T.v[0]) || ["Starter", template];
  const pu = purpose.trim();
  const de = details.trim();
  return (
    "Make a " + template + " (" + v[0] + " style: " + v[1] + ")" +
    (pu ? ". Purpose: " + pu : "") +
    (de ? ". Must include: " + de : "")
  );
}

/* Direct creates - the mockup's goBuild8 branches for Project/Flow/Routine
   (Chart files arrive with the chart renderer in batch 3; the brief still
   goes to Chat). Returns what was made + the toast line. */
export interface BuildResult {
  made: "project" | "flow" | "routine" | "brief";
  id: string;
  toast: string;
}
/* Studio UI state: which drafts drawer + gallery flags the root reads.
 * The mockup keeps these as globals (drOpen10, stGal); here they persist
 * per-device like dashboard sizes. */
const UI_KEY = 'eumae:studio-ui';

interface StudioUi {
  draftsOpen: boolean;
}

function loadUi(): StudioUi {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && typeof p.draftsOpen === 'boolean') return p as StudioUi;
    }
  } catch {
    /* Fall through to default. */
  }
  return { draftsOpen: false };
}

function saveUi(ui: StudioUi): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* Non-fatal. */
  }
}

export function draftsOpen(): boolean {
  return loadUi().draftsOpen;
}

export function setDraftsOpen(open: boolean): void {
  saveUi({ draftsOpen: open });
}

/* The brief Studio hands to Chat — the mockup's go("ai"); ask(brief).
 * Studio queues it and switches tabs; Chat takes it once on arrival and
 * sends. Take consumes (a reload mid-handoff lands one brief, never two). */
const BRIEF_KEY = 'eumae:pendingBrief';

export function queueBrief(brief: string): void {
  try {
    localStorage.setItem(BRIEF_KEY, brief);
  } catch {
    /* Non-fatal — Chat just opens without it. */
  }
}

export function takePendingBrief(): string | null {
  try {
    const b = localStorage.getItem(BRIEF_KEY);
    if (b) localStorage.removeItem(BRIEF_KEY);
    return b;
  } catch {
    return null;
  }
}
