import { useEffect, useState } from 'react';

/** Does the viewport match? The two overlays that have a phone shape and a
 *  desktop one — Settings (`.settings`) and the composer's `+` window
 *  (`.addWin`) — both read this, so the breakpoint lives in one place instead of
 *  a copy each that can silently drift apart. It was Settings' private hook
 *  until Phase 5 gave the `+` window the same shape.
 *
 *  `900px` is the width tokens.css switches the whole shell at, and the query is
 *  written out at each call site rather than hidden behind a boolean for that
 *  reason: the CSS and the JS have to agree, and a reader can see that they do. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}
