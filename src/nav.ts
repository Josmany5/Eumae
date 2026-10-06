import { createContext, useContext } from 'react';
import type { TabId } from './components/shell/TabBar';

/** The right panel's three readings, one panel rather than three.
 *
 *  Context is what is in play on this conversation, Activity is what has
 *  actually happened (the log in src/log.ts), Studio is what came out of it.
 *  Context and Activity have real data today; Studio stays an honest empty
 *  until an artifact exists to show. Studio absorbed the old Code and Preview
 *  readings — two tabs holding two versions of nothing, with no artifact
 *  between them. */
export type PanelView = 'context' | 'activity' | 'studio';

/** How Eumae answers on this chat. The mockup keeps these five in module scope
 *  (`MODE`, `ROLE9`, `SKS9`, `THINK9`, `MODEL9` — line 1280) and shows them in
 *  two places: the `+` menu sets them, the chip above the input reads them back.
 *  Both ends render from here, so the two can't disagree.
 *
 *  `role: ''` is the mockup's "Default" (line 1284 tests `ROLE9 || "Default"`),
 *  and an empty `skill` means none is picked. */
export type Mode = 'Ask' | 'Build' | 'Learn';
export type Thinking = 'Quick' | 'Balanced' | 'Deep';
export type Model = 'Auto' | 'Fast' | 'Best';

export interface Turn {
  mode: Mode;
  role: string;
  skill: string;
  thinking: Thinking;
  model: Model;
}

/** The mockup's opening state, verbatim. */
export const DEFAULT_TURN: Turn = {
  mode: 'Ask',
  role: '',
  skill: '',
  thinking: 'Balanced',
  model: 'Auto',
};

/**
 * The shell's navigation stack — the mockup's `pageSt` + `goPage` + `pageBack`.
 *
 *   go('tasks')    push a sub-page on top of the current tab
 *   back()         pop it (no-op at the tab root)
 *   goTab('chat')  switch tab — clears the stack, exactly like the mockup's go()
 *
 * Pages register in src/pages/index.tsx. Any screen or page can reach this
 * with useNav(), so nothing has to be prop-drilled through the shell.
 *
 * The panel rides along here rather than in App state so its two doorways — the
 * rail header and the phone header — can each reach it without App threading a
 * prop through every one of them. The composer's context button was a third
 * until it was retired: the mockup's composer row has no such control.
 */
export interface Nav {
  go: (page: string, arg?: unknown) => void;
  back: () => void;
  depth: number;
  goTab: (tab: TabId) => void;
  openSettings: () => void;

  /** Right panel. `openPanel` sets the view as it opens, so a doorway can point
   *  straight at the reading it means instead of opening on whatever was last
   *  looked at. */
  panelOpen: boolean;
  panelView: PanelView;
  togglePanel: () => void;
  openPanel: (view?: PanelView) => void;
  closePanel: () => void;

  /** The composer's `+` sheet — the mockup's `plusSh()`, "Add to this chat".
   *  This is the chat's one setup door: Mode, Role, Skill, Thinking, Model, and
   *  the Context rows underneath. What is already attached is read back in the
   *  panel's Context view, not here. */
  openAdd: () => void;

  /** How this chat answers. Set by that menu, read back by the chip above the
   *  input — the two ends of one piece of state, so it lives with both. */
  turn: Turn;
  setTurn: (patch: Partial<Turn>) => void;

  /** Opens the file input, which App renders once. It sits here rather than in
   *  the composer because the paperclip and the menu's "Attach a file…" row
   *  have to open the same input — two pickers would be two readers, and the
   *  last time a control grew a second door to the same room was the bug. */
  pickFile: () => void;
}

export const NavContext = createContext<Nav>({
  go: () => {},
  back: () => {},
  depth: 0,
  goTab: () => {},
  openSettings: () => {},
  panelOpen: false,
  panelView: 'context',
  togglePanel: () => {},
  openPanel: () => {},
  closePanel: () => {},
  openAdd: () => {},
  turn: DEFAULT_TURN,
  setTurn: () => {},
  pickFile: () => {},
});

export function useNav(): Nav {
  return useContext(NavContext);
}
