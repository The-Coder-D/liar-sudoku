import { Component, type ReactNode } from "react";

interface State {
  failed: boolean;
}

/** If something throws while rendering, show a calm recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("Liar Sudoku crashed:", error);
  }

  private reload = () => window.location.reload();

  private resetAndReload = () => {
    try {
      window.localStorage.removeItem("liar-sudoku-save");
    } catch {
      /* storage blocked: reloading is still worth trying */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash-screen" role="alert">
        <h1>Something went wrong</h1>
        <p>The professor tripped over a rug. Your stats are safe.</p>
        <div className="crash-actions">
          <button className="btn btn-primary" onClick={this.reload}>
            Reload
          </button>
          <button className="btn btn-secondary" onClick={this.resetAndReload}>
            Discard saved game and reload
          </button>
        </div>
      </div>
    );
  }
}
