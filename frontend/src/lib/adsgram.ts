import type React from "react";

// AdsGram integration for Telegram Mini App.
// Formats used:
// - Rewarded: main WATCH AD button; coins credited only after SDK resolves and backend settles session.
// - Interstitial: natural app transitions; no user reward.
// - Task: <adsgram-task> web component rendered in Dashboard.

export type AdsgramBannerType = "RewardedVideo" | "FullscreenMedia";

export interface ShowPromiseResult {
  done: boolean;
  description: string;
  state: "load" | "render" | "playing" | "destroy";
  error: boolean;
}

export interface AdsOutcome {
  completed: boolean;
  error?: string;
  raw?: ShowPromiseResult;
}

interface AdController {
  show: () => Promise<ShowPromiseResult>;
  addEventListener?: (event: string, handler: () => void) => void;
  removeEventListener?: (event: string, handler: () => void) => void;
  destroy?: () => void;
}

declare global {
  interface Window {
    Adsgram?: {
      init: (opts: {
        blockId: string;
        debug?: boolean;
        debugConsole?: boolean;
        debugBannerType?: AdsgramBannerType;
      }) => AdController;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      "adsgram-task": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "data-block-id"?: string;
        "data-debug"?: string | boolean;
        "data-debug-console"?: string | boolean;
      };
    }
  }
}

let scriptPromise: Promise<void> | null = null;
const controllers = new Map<string, AdController>();

export function loadAdsGramScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (typeof document === "undefined") return Promise.reject(new Error("no document"));

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.Adsgram && customElements.get("adsgram-task")) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://sad.adsgram.ai/js/sad.min.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("adsgram script load failed")), { once: true });
      // If AdsGram global already appeared after an earlier load, resolve immediately.
      if (window.Adsgram) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sad.adsgram.ai/js/sad.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("adsgram script load failed"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function controllerKey(blockId: string, debugBannerType?: AdsgramBannerType): string {
  return `${blockId}:${debugBannerType || "live"}`;
}

export async function getAdsGramController(
  blockId: string,
  debugBannerType?: AdsgramBannerType
): Promise<AdController | null> {
  if (!blockId) return null;
  await loadAdsGramScript();
  if (!window.Adsgram) return null;

  const key = controllerKey(blockId, debugBannerType);
  const cached = controllers.get(key);
  if (cached) return cached;

  const controller = window.Adsgram.init({
    blockId,
    debug: false,
    debugConsole: false,
    debugBannerType,
  });
  controllers.set(key, controller);
  return controller;
}

export async function preloadAdsGram(blockIds: string[] | string): Promise<boolean> {
  const ids = Array.isArray(blockIds) ? blockIds : [blockIds];
  try {
    await loadAdsGramScript();
    await Promise.all(ids.filter(Boolean).map((id) => getAdsGramController(id)));
    return true;
  } catch {
    return false;
  }
}

export function showAdsGramAd(
  blockId: string,
  debugBannerType?: AdsgramBannerType
): Promise<AdsOutcome> {
  if (!blockId) return Promise.resolve({ completed: false, error: "adsgram block id missing" });

  return getAdsGramController(blockId, debugBannerType)
    .then((controller) => {
      if (!controller) return { completed: false, error: "adsgram not ready" };
      return controller.show().then(
        (result): AdsOutcome => ({ completed: result?.done !== false && result?.error !== true, raw: result }),
        (result: ShowPromiseResult): AdsOutcome => ({
          completed: false,
          error: result?.description || "ad skipped or unavailable",
          raw: result,
        })
      );
    })
    .catch((err) => ({
      completed: false,
      error: err instanceof Error ? err.message : "adsgram error",
    }));
}

export function showAdsGramReward(blockId: string): Promise<AdsOutcome> {
  return showAdsGramAd(blockId, "RewardedVideo");
}

export function showAdsGramInterstitial(blockId: string): Promise<AdsOutcome> {
  return showAdsGramAd(blockId, "FullscreenMedia");
}
