import type { ComponentType } from 'react';
import SearchPage from './SearchPage';
import NotesPage from './NotesPage';
import NoteViewPage from './NoteViewPage';
import TasksPage from './TasksPage';
import CalendarPage from './CalendarPage';
import EventsPage from './EventsPage';
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
import CoursePage from './CoursePage';
import CxSectionPage from './CxSectionPage';
import TutorialPage from './TutorialPage';
import ViewPage from './ViewPage';
import EditPage from './EditPage';
import VersionPage from './VersionPage';
import LessonPage from './LessonPage';
import RolePage from './RolePage';
import PersonPage from './PersonPage';
import SharedViewPage from './SharedViewPage';
import AssignedPage from './AssignedPage';

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
  events: { title: 'Events', page: EventsPage },
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
  libf: { title: 'Library', page: LibraryFolderPage },
  course: { title: '', page: CoursePage },
  cxsec: { title: '', page: CxSectionPage },
  tut: { title: '', page: TutorialPage },
  view: { title: '', page: ViewPage },
  edit: { title: 'Edit', page: EditPage },
  ver: { title: '', page: VersionPage },
  lesson: { title: '', page: LessonPage },
  role: { title: 'Create a role', page: RolePage },
  person: { title: '', page: PersonPage },
  sharedv: { title: 'Shared work', page: SharedViewPage },
  asn: { title: 'Assigned work', page: AssignedPage },
};

export function pageTitle(name: string): string {
  return PAGES[name]?.title ?? name;
}