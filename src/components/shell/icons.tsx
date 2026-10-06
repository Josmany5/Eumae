import type { JSX } from 'react';

const PATHS: Record<string, JSX.Element> = {
  chat: <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />,
  doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /></>,
  fol: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  clk: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  /* The pair to `cal`: same calendar, a day marked. Events (a list you add to)
     vs Calendar (a grid you read) sit next to each other, so they read as a
     family but never as the same row. */
  evt: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="12" cy="15.5" r="1.8" /></>,
  chk: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></>,
  bel: <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10 20a2 2 0 0 0 4 0" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" /></>,
  pls: <path d="M12 5v14M5 12h14" />,
  lnk: <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />,
  str: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  zap: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  db: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  cap: <><path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M6 11v4c0 1.5 3 3 6 3s6-1.5 6-3v-4" /><path d="M22 9v5" /></>,
  sea: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  vid: <><rect x="3" y="5" width="13" height="14" rx="3" /><path d="M16 10l5-3v10l-5-3" /></>,
  img: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5-9 9" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  bk: <path d="M15 6l-6 6 6 6" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  clp: <path d="M21 12.5l-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.5 3.5 0 0 1 5 5L10.4 19a2 2 0 0 1-2.8-2.8l7.8-7.8" />,
  side: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9.5 4v16" /></>,

  /* The right panel and its readings. `ctx` is a target — "what Eumae is
     holding" — so it can never read as a link the way the attach rows do. Its
     other two readings borrow rather than redraw: Activity wears `clk` and
     Studio wears `tab-studio`, because each is the same thing the header's
     clock button and the rail's Studio row already mean. `code` and `eye` are
     drawn for Studio's sandbox and are still unread — no artifact renders yet. */
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  ctx: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  code: <path d="M9.5 7.5L4 12l5.5 4.5M14.5 7.5L20 12l-5.5 4.5" />,
  eye: <><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,

  /* The six tab icons are their own set in the mockup (#tabbar) and are NOT
     the general icons above — a clock is not a monitor, a bell is not a Guild
     star. The phone tab bar and the desktop rail both read these, so the two
     can no longer drift apart. */
  'tab-chat': <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />,
  'tab-console': <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></>,
  'tab-studio': <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  'tab-library': <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14" />,
  'tab-classroom': <><path d="M12 4L2 9l10 5 10-5-10-5z" /><path d="M6 11v4c0 1.5 3 3 6 3s6-1.5 6-3v-4" /><path d="M22 9v5" /></>,
  'tab-guild': <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />,

  /* The six settings-only glyphs. Each is here because the nearest existing
     icon would have said something untrue: `lnk` is an attach, not a language;
     `db` is storage, not a backup; `doc` already means "report a problem" in
     the same group, so Legal can't borrow it. Same rule as the tab icons above. */
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><ellipse cx="12" cy="12" rx="4" ry="9" /></>,
  acc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="7.6" r="1.4" /><path d="M7.6 10.6h8.8M12 10.6v4M12 14.6l-2.1 4.6M12 14.6l2.1 4.6" /></>,
  bill: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M6.5 14.5h4" /></>,
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  arch: <><path d="M3.5 7.5h17v3h-17z" /><path d="M5.5 10.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8" /><path d="M10 14h4" /></>,
  law: <><path d="M12 4v16" /><path d="M6 8h12" /><path d="M6 8l-2.5 5.5a3 3 0 0 0 5 0z" /><path d="M18 8l-2.5 5.5a3 3 0 0 0 5 0z" /><path d="M8 20h8" /></>,
};

export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
