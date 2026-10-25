import { useEffect, useRef, type RefObject } from 'react';
import { useMedia } from '../../useMedia';

/* Shared page switching for the paged dashboards (Console + Guild).
 *
 * Phone: the .cswipe row stays a horizontal snap-scroller with dots, so
 * swipe works as before and these controls just scroll it.
 * Desktop (>=900px): tokens.css shows only the .cpg marked .on, so the page
 * is state, not scroll. PageNav is the segmented control with ‹ › arrows;
 * usePageKeys adds ←/→ keys and trackpad horizontal swipe (wheel deltaX).
 */

export const DESKTOP_QUERY = '(min-width:900px)';

export function PageNav({
  names,
  page,
  onJump,
}: {
  names: string[];
  page: number;
  onJump: (i: number) => void;
}) {
  const n = names.length;
  if (n < 2) return null;
  return (
    <div className="pn" role="tablist" aria-label="Pages">
      {names.map((name, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === page}
          className={i === page ? 'on' : ''}
          onClick={() => onJump(i)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

/** ←/→ keys (when focus isn't in a field) and trackpad horizontal swipe on
 *  desktop. One swipe gesture = one page: deltaX accumulates past a
 *  threshold, then locks until the gesture goes quiet. */
export function usePageKeys(
  ref: RefObject<HTMLElement | null>,
  page: number,
  count: number,
  onJump: (i: number) => void,
  enabled: boolean,
) {
  const desktop = useMedia(DESKTOP_QUERY);
  const state = useRef({ page, count, onJump });
  state.current = { page, count, onJump };

  useEffect(() => {
    if (!enabled) return;
    const go = (d: number) => {
      const { page: p, count: c, onJump: j } = state.current;
      const next = p + d;
      if (next >= 0 && next < c) j(next);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);

    const el = ref.current;
    let acc = 0;
    let locked = false;
    let quiet: number | undefined;
    const onWheel = (e: WheelEvent) => {
      if (!desktop) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      window.clearTimeout(quiet);
      quiet = window.setTimeout(() => {
        acc = 0;
        locked = false;
      }, 180);
      if (locked) return;
      acc += e.deltaX;
      if (Math.abs(acc) > 60) {
        go(acc > 0 ? 1 : -1);
        locked = true;
        acc = 0;
      }
    };
    el?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey);
      el?.removeEventListener('wheel', onWheel);
      window.clearTimeout(quiet);
    };
  }, [ref, desktop, enabled]);

  return desktop;
}

