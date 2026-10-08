import type { TabId } from './TabBar';

export interface MenuItem {
  label: string;
  icon: string;
}

export interface MenuSection {
  /** Omitted where the mockup shows the rows bare, with no heading above. */
  heading?: string;
  items: MenuItem[];
  /** Shown in place of the rows while the data behind them doesn't exist yet. */
  empty?: string;
}

/** The second level of navigation: what belongs to whichever page you're on.
 *
 *  Taken from the LAST `pD` assignment in eumae-mockup-wove-branch.html
 *  (lines 1515-1525). That file reassigns `pD` six times and the last one
 *  wins, so the earlier definition at line 242 — which is where this project
 *  got "Pinned project" and "Customize" from — is dead code. Console's real
 *  menu is "Full pages", and New chat is chat-scoped, not global.
 *
 *  The desktop rail renders these under the six tabs; the phone drawer renders
 *  the same list behind the hamburger. */
export const PAGE_MENU: Record<TabId, MenuSection[]> = {
  chat: [
    { items: [{ label: 'New chat', icon: 'pls' }] },
    { heading: 'Recent chats', items: [], empty: 'No chats yet' },
    {
      /* "Scope to a project" came back in Phase 5. It was dropped on purpose
         because the composer's add menu held it — and that menu is behavior only
         now (§4.13), so with the row gone a scope would have no door at all. It
         still scopes nothing until a project screen exists, and it toasts like
         every other unbuilt row; a labelled row beats no door (§4.7). */
      heading: 'Context',
      items: [
        { label: 'Attach an item', icon: 'lnk' },
        { label: 'Scope to a project', icon: 'fol' },
      ],
    },
  ],
  console: [
    {
      heading: 'Full pages',
      items: [
        { label: 'Tasks', icon: 'chk' },
        /* NOT in the mockup's last pD — the mockup only ever surfaces events
           inside Console's "This week" widget (`FB10.week8`: a calendar strip,
           that day's `dayEvents`, and an "Add event" button). Added on
           purpose, and the reason is the one the mockup itself implies:
           Calendar is a grid you read, Events is a list you add to — and tasks
           already get both (a `today8` widget plus a Tasks full page). */
        { label: 'Events', icon: 'evt' },
        { label: 'Calendar', icon: 'cal' },
        { label: 'Goals', icon: 'str' },
        { label: 'Projects', icon: 'fol' },
        { label: 'Notes', icon: 'doc' },
        { label: 'Flows', icon: 'zap' },
      ],
    },
  ],
  studio: [
    { heading: 'Published', items: [], empty: 'Nothing published yet' },
    { heading: 'Drafts', items: [], empty: 'Nothing in draft yet' },
    {
      heading: 'People',
      items: [
        { label: 'Shared with me', icon: 'lnk' },
        { label: 'Marketplace', icon: 'str' },
      ],
    },
  ],
  library: [
    {
      items: [
        { label: 'Favorites', icon: 'str' },
        { label: 'Recent', icon: 'clk' },
        { label: 'Shared with me', icon: 'lnk' },
        { label: 'Trash', icon: 'doc' },
        { label: 'Sources', icon: 'lnk' },
      ],
    },
  ],
  guild: [
    {
      items: [
        { label: 'Contacts', icon: 'lnk' },
        { label: 'Messages', icon: 'chat' },
        { label: 'Requests', icon: 'chk' },
        { label: 'Assigned work', icon: 'cap' },
        { label: 'Activity', icon: 'clk' },
        { label: 'Shared work', icon: 'lnk' },
        { label: 'Marketplace', icon: 'str' },
      ],
    },
  ],
  classroom: [
    {
      heading: 'Courses',
      items: [
        { label: 'Spanish · Lesson 5', icon: 'cap' },
        { label: 'AI Engineering · Ch 3', icon: 'cap' },
      ],
    },
    {
      heading: 'Training',
      items: [
        { label: 'Sales onboarding · assigned to you', icon: 'chk' },
        { label: 'Onboarding · you assigned', icon: 'chk' },
      ],
    },
    {
      heading: 'Digest',
      items: [
        { label: 'gbrain teardown', icon: 'doc' },
        { label: 'Speech as programming', icon: 'vid' },
      ],
    },
    {
      heading: 'App tutorials',
      items: [
        { label: 'Using Studio', icon: 'cap' },
        { label: 'Using Guild', icon: 'cap' },
      ],
    },
  ],
};
