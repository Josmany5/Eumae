import type { PageProps } from './index';
import { StudioChat } from '../components/StudioChat';
import { getSession } from '../studioChat';

/* A Studio item's chat, as a page: the app header carries back and its name. */
export default function StudioChatPage({ arg }: PageProps) {
  return <StudioChat id={String(arg ?? '')} />;
}

export function studioChatTitle(arg: unknown): string {
  return getSession(String(arg ?? ''))?.title ?? 'Studio';
}
