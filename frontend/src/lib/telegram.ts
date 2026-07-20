// Thin wrapper over the official Telegram WebApp bridge (telegram-web-app.js,
// loaded in index.html). Guarded so the app degrades gracefully outside Telegram.

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  version: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** Call once on app start. */
export function initTelegram(): void {
  const wa = getWebApp();
  if (!wa) return;
  try {
    wa.ready();
    wa.expand();
  } catch {
    /* no-op */
  }
}

/** The raw signed initData string — sent to the backend for HMAC verification. */
export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

export function isInTelegram(): boolean {
  return getInitData().length > 0;
}

export function isDark(): boolean {
  return getWebApp()?.colorScheme !== "light";
}

export function haptic(kind: "light" | "success" | "error" = "light"): void {
  const h = getWebApp()?.HapticFeedback;
  if (!h) return;
  if (kind === "light") h.impactOccurred("light");
  else h.notificationOccurred(kind);
}
