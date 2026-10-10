import type { ComponentType } from 'react';
import SearchPage from './SearchPage';
import NotesPage from './NotesPage';
import NoteViewPage from './NoteViewPage';

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
  note: { title: 'Note', page: NoteViewPage },
};

export function pageTitle(name: string): string {
  return PAGES[name]?.title ?? name;
}