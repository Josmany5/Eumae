import type { ComponentType } from 'react';
import SearchPage from './SearchPage';
import NotesPage from './NotesPage';
import NoteViewPage from './NoteViewPage';
import TasksPage from './TasksPage';
import CalendarPage from './CalendarPage';
import GoalsPage from './GoalsPage';
import ProjectsPage from './ProjectsPage';
import ProjectPage from './ProjectPage';
import BriefPage from './BriefPage';
import MessagesPage from './MessagesPage';
import ChatPage, { GroupChatPage } from './ChatPage';
import RequestsPage from './RequestsPage';
import GuildSectionPage from './GuildSectionPage';
import FlowsPage from './FlowsPage';
import FlowPage from './FlowPage';
import FlowEditPage from './FlowEditPage';
import StudioItemPage from './StudioItemPage';
import LibraryFolderPage from './LibraryFolderPage';

export interface PageProps {
  /** Whatever the caller passed to nav.go(name, arg). */
  arg?: unknown;
}

export interface PageDef {
  title: string;
  page: ComponentType<PageProps>;
}

/**
 * Every sub-page, in one place — the mockup's `PGF` map.
 * `goPage('tasks')` in the mockup becomes `nav.go('tasks')` here.
 * A new page is one row.
 */
export const PAGES: Record<string, PageDef> = {
  search: { title: 'Search', page: SearchPage },
  notes: { title: 'Notes', page: NotesPage },
  note: { title: '', page: NoteViewPage },
  tasks: { title: 'Tasks', page: TasksPage },
  cal: { title: 'Calendar', page: CalendarPage },
  goals: { title: 'Goals', page: GoalsPage },
  projects: { title: 'Projects', page: ProjectsPage },
  project: { title: 'Project', page: ProjectPage },
  brief: { title: "Today's briefing", page: BriefPage },
  gmsg: { title: 'Messages', page: MessagesPage },
  gchat: { title: '', page: ChatPage },
  gchatg: { title: '', page: GroupChatPage },
  greq: { title: 'Requests', page: RequestsPage },
  gsec: { title: '', page: GuildSectionPage },
  flows: { title: 'Flows', page: FlowsPage },
  flow: { title: '', page: FlowPage },
  flowedit: { title: '', page: FlowEditPage },
  sitem: { title: '', page: StudioItemPage },
  libf: { title: '', page: LibraryFolderPage },
};

export function pageTitle(name: string): string {
  return PAGES[name]?.title ?? name;
}