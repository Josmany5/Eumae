import { getGuild, takeMarketplace } from './guild';
import { addFile } from './library';

/* "Get" from the Marketplace: marks it got and, the first time, puts a real
   file in the Library (Documents) so "Added to your Studio" is true. The
   Guild page and the dashboard widget both call this one function — the
   widget used to only toast. Lives outside guild.ts so that store keeps no
   imports. */
export function getFromMarket(index: number): string {
  const item = getGuild().market[index];
  if (!item) return 'Nothing there.';
  if (!item.got) addFile(item.n, (item.k || '').toLowerCase().includes('widget') ? 'WIDGET' : 'DOC', 'Documents');
  return takeMarketplace(index);
}
