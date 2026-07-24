import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so a single broken screen shows a friendly retry
 * prompt instead of taking down the whole Mini App into a blank white screen.
 * Uses inline styles on purpose — it must render even if the CSS bundle fails.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error?.message || error);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            background: "#f0f8ff",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 34 }}>⚠️</div>
          <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 12, color: "#64748b", maxWidth: 280, lineHeight: 1.5 }}>
            This screen hit an unexpected error. Tap reload to try again.
          </div>
          <button
            onClick={() => {
              this.setState({ error: null });
              try {
                window.location.reload();
              } catch {
                /* noop */
              }
            }}
            style={{
              marginTop: 6,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#10b981",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
