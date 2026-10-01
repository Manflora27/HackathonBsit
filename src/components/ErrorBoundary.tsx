import { Component, type ReactNode } from "react";
import { useT } from "../i18n";
import { report } from "../lib/remote";

/** What a crashed page shows instead of a white screen. Progress lives in local storage, so nothing is lost. */
function Fallback({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <main className="mx-auto max-w-md px-6 pt-24 text-center" role="alert" data-testid="crash">
      <h1 className="font-display text-[26px] leading-tight">{t("common.crashTitle")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("common.crashText")}</p>
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn-primary" onClick={onRetry}>{t("unit.tryAgain")}</button>
        <a className="btn-ghost" href="/">{t("common.goHome")}</a>
      </div>
    </main>
  );
}

/**
 * Catches a render crash anywhere below it, logs it, and shows a way out instead of a blank page.
 * `resetKey` (the route) clears the error, so navigating away from a broken page recovers on its own.
 */
export class ErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    report("render crash", { error, componentStack: info.componentStack });
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    return this.state.error ? <Fallback onRetry={() => this.setState({ error: null })} /> : this.props.children;
  }
}
