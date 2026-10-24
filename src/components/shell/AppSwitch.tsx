import { useRef, type PointerEvent } from 'react';
import { homeSections, tileSpace, TileIcon } from '../../screens/HomeScreen';
import { Icon } from './icons';

/** One app left open behind Home: its tile name and where you were in it. */
export interface OpenApp {
  key: string;
  title: string;
}

function tileFor(key: string) {
  for (const s of homeSections()) for (const t of s.tiles) if (t.n === key) return { t, s };
  return null;
}

/** The home handle (Home mode only, phone). It sits just above the bottom
 *  edge, because iPhone keeps the very bottom swipe for itself.
 *  Quick swipe up or tap = Home. Slow swipe up and hold = app switcher. */
export function HomeHandle({ onHome, onSwitch }: { onHome: () => void; onSwitch: () => void }) {
  const st = useRef<{ y: number; dy: number; timer: number; switched: boolean } | null>(null);
  const down = (e: PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = { y: e.clientY, dy: 0, timer: 0, switched: false };
    s.timer = window.setTimeout(() => {
      if (s.dy < -18) {
        s.switched = true;
        onSwitch();
      }
    }, 380);
    st.current = s;
  };
  const move = (e: PointerEvent) => {
    if (st.current) st.current.dy = e.clientY - st.current.y;
  };
  const up = () => {
    const s = st.current;
    st.current = null;
    if (!s) return;
    window.clearTimeout(s.timer);
    if (s.switched) return;
    if (s.dy < -18 || Math.abs(s.dy) < 8) onHome();
  };
  return (
    <div className="hmHandle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (st.current = null)} role="button" aria-label="Home (hold and swipe up for open apps)">
      <i />
    </div>
  );
}

/** The app switcher: cards of the apps you left open. Tap one to go back
 *  where you were; swipe a card up (or tap ×) to close it. */
export function AppSwitcher({
  apps,
  onPick,
  onCloseApp,
  onHome,
  onDismiss,
}: {
  apps: OpenApp[];
  onPick: (key: string) => void;
  onCloseApp: (key: string) => void;
  onHome: () => void;
  onDismiss: () => void;
}) {
  const drag = useRef<{ key: string; y: number; el: HTMLElement } | null>(null);
  const down = (key: string) => (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { key, y: e.clientY, el: e.currentTarget };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = Math.min(0, e.clientY - d.y);
    d.el.style.transform = `translateY(${dy}px)`;
    d.el.style.opacity = String(1 + dy / 400);
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dy = e.clientY - d.y;
    d.el.style.transform = '';
    d.el.style.opacity = '';
    if (dy < -90) onCloseApp(d.key);
    else if (Math.abs(dy) < 8) onPick(d.key);
  };
  return (
    <div className="swOv" onClick={(e) => e.target === e.currentTarget && onDismiss()}>
      {apps.length ? (
        <div className="swRow" onClick={(e) => e.target === e.currentTarget && onDismiss()}>
          {apps.map((a) => {
            const hit = tileFor(a.key);
            return (
              <div key={a.key} className="swCard" onPointerDown={down(a.key)} onPointerMove={move} onPointerUp={up}>
                <div className="swTop">
                  {hit ? (
                    <span className={'hmIc swIc sp-' + tileSpace(hit.t, hit.s)}>
                      <TileIcon t={hit.t} />
                    </span>
                  ) : null}
                  <b>{a.key}</b>
                  <button
                    className="swX"
                    aria-label={'Close ' + a.key}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={() => onCloseApp(a.key)}
                  >
                    <Icon name="x" />
                  </button>
                </div>
                <div className="swBody">{a.title}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="swEmpty">No open apps</div>
      )}
      <button className="swHome" onClick={onHome}>Home</button>
    </div>
  );
}
