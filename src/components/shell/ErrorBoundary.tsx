import { Component, type ReactNode } from 'react';

/* The airbag. A render crash anywhere inside the app is a white screen today —
 * no message, no way back, whatever the person was doing is gone from view.
 * This catches it and shows a way back instead: what broke is named, Reload
 * re-mounts the app, and the person's data is untouched (it lives in
 * localStorage / IndexedDB, not in the crashed tree).
 *
 * One boundary around the whole app, not one per screen: per-screen boundaries
 * need per-screen fallback copy and retry rules, which is Phase 9 work. This
 * file's job is only that a crash is never blank. */

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
  confirmingWipe: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null, confirmingWipe: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : 'Something went wrong.',
      confirmingWipe: false,
    };
  }

  componentDidCatch(error: unknown): void {
    // Ours to read, not the caller's: the message above is the human sentence,
    // the stack here is the debugging half. Same split as api/ai.ts keeps.
    console.error('Eumae crashed:', error);
  }

  /* The escape hatch: a bad saved message used to crash boot, and Reload
   * re-read the same bad row and crashed again — no way out but clearing
   * site data by hand. Message validation (threads.ts) should stop that
   * class of crash before React sees it; this button covers whatever shape
   * ever breaks validation again. Chats only — notes, uploads, theme stay.
   * Two taps: the first arms, the second wipes `eumae:threads` +
   * `eumae:currentThread` and reloads onto a fresh chat. */
  private wipeChats = () => {
    if (!this.state.confirmingWipe) {
      this.setState({ confirmingWipe: true });
      return;
    }
    try {
      localStorage.removeItem('eumae:threads');
      localStorage.removeItem('eumae:currentThread');
      sessionStorage.removeItem('eumae:session');
    } catch {
      /* If storage itself is broken, reloading is still the best move. */
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.message === null) return this.props.children;
    return (
      <div className="crash" role="alert">
        <div className="crash-card">
          <div className="crash-title">Something broke</div>
          <div className="crash-note">
            The app hit an error and stopped. Your chats, notes and files are
            still saved on this device — reloading brings them back.
          </div>
          <button className="crash-btn" onClick={() => window.location.reload()}>
            Reload Eumae
          </button>
          <button className="crash-btn crash-btn-ghost" onClick={this.wipeChats}>
            {this.state.confirmingWipe ? 'Tap again to erase chats & reload' : 'Erase chats & reload'}
          </button>
          {this.state.confirmingWipe ? (
            <div className="crash-note">This erases saved chats only. Notes, files and settings stay.</div>
          ) : null}
        </div>
      </div>
    );
  }
}
