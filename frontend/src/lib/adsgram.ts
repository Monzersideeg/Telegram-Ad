// AdsGram rewarded-interstitial integration.
//
// Unlike Monetag, AdsGram verifies the view inside its own SDK: AdController.show()
// resolves ONLY on a legitimate completed watch and rejects on error/skip. AdsGram's
// public docs expose no signed per-view S2S postback for publishers (only an optional,
// unsigned, telegramId-based GET aimed at very large publishers), so we credit on the
// SDK-verified resolved promise via POST /api/ads/complete — still gated server-side by
// the watch session, rate-limits, once-per-session idempotency and a min-watch-time.

interface ShowResult {
  done?: boolean;
  error?: boolean;
  description?: string;
  state?: string;
}
interface AdController {
  show: () => Promise<ShowResult>;
}
declare global {
  interface Window {
    Adsgram?: { init: (opts: { blockId: string }) => AdController };
  }
}

export interface AdsOutcome {
  completed: boolean;
  error?: string;
}

let scriptP: Promise<void> | null = null;
let controller: AdController | null = null;
let initedBlock: string | null = null;

function loadScript(): Promise<void> {
  if (scriptP) return scriptP;
  if (typeof document === "undefined") return Promise.reject(new Error("no document"));
  scriptP = new Promise<void>((resolve, reject) => {
    if (window.Adsgram) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://sad.adsgram.ai/js/sad.min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptP = null;
      reject(new Error("adsgram script load failed"));
    };
    document.head.appendChild(s);
  });
  return scriptP;
}

/** Load the SDK and init with the block id. Call on mount so show() is ready at tap time. */
export async function preloadAdsGram(blockId: string): Promise<boolean> {
  if (!blockId) return false;
  try {
    await loadScript();
    if (!window.Adsgram) return false;
    if (initedBlock !== blockId) {
      controller = window.Adsgram.init({ blockId });
      initedBlock = blockId;
    }
    return true;
  } catch {
    return false;
  }
}

/** Show the rewarded ad. MUST be called synchronously inside the tap handler (gesture). */
export function showAdsGramAd(): Promise<AdsOutcome> {
  if (!controller) return Promise.resolve({ completed: false, error: "adsgram not ready" });
  try {
    return controller.show().then(
      (r): AdsOutcome => ({ completed: r?.done !== false && r?.error !== true, error: r?.description }),
      (r): AdsOutcome => ({ completed: false, error: (r && r.description) || "adsgram error" })
    );
  } catch (e) {
    return Promise.resolve({
      completed: false,
      error: e instanceof Error ? e.message : "adsgram throw",
    });
  }
}
