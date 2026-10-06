import type { JSX } from 'react';

const PATHS: Record<string, JSX.Element> = {
  chat: <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />,
  doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /></>,
  fol: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  clk: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  chk: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></>,
  bel: <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10 20a2 2 0 0 0 4 0" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" /></>,
  pls: <path d="M12 5v14M5 12h14" />,
  lnk: <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />,
  str: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  zap: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  db: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  cap: <path d="M3 9l9-5 9 5-9 5-9-5zM6 11v4c0 1.5 3 3 6 3s6-1.5 6-3v-4" />,
  img: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5-9 9" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  bk: <path d="M15 6l-6 6 6 6" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  clp: <path d="M21 12.5l-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.5 3.5 0 0 1 5 5L10.4 19a2 2 0 0 1-2.8-2.8l7.8-7.8" />,
  side: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9.5 4v16" /></>,
};

export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
