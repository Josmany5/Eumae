import type { ComponentType } from 'react';
import type { TabId } from '../components/shell/TabBar';
import ChatScreen from './ChatScreen';
import ConsoleScreen from './ConsoleScreen';
import StudioScreen from './StudioScreen';
import LibraryScreen from './LibraryScreen';
import ClassroomScreen from './ClassroomScreen';
import GuildScreen from './GuildScreen';

// One screen per tab. The shell never changes when a screen does — this
// map is the only place a tab knows what it renders.
export const SCREENS: Record<TabId, ComponentType> = {
  chat: ChatScreen,
  console: ConsoleScreen,
  studio: StudioScreen,
  library: LibraryScreen,
  classroom: ClassroomScreen,
  guild: GuildScreen,
};

export const LABELS: Record<TabId, string> = {
  chat: 'Chat',
  console: 'Console',
  studio: 'Studio',
  library: 'Library',
  classroom: 'Classroom',
  guild: 'Guild',
};
