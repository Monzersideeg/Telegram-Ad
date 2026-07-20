import createAdHandler from "monetag-tg-sdk";

// Monetag SDK integration (Rewarded Interstitial).
//
// The npm package types the handler as Promise<void>, but the SDK actually resolves
// with a result object (reward_event_type, estimated_price) — so we cast to read it
// best-effort. Coins are NEVER granted here: crediting happens server-side when
// Monetag fires the S2S postback with reward_event_type === 'valued'. The caller
// polls /api/ads/status/:sessionId for the authoritative outcome.
//
// We pass `ymid = watch sessionId` so the postback routes back to this exact view.

interface ShowOptions {
  type?: "end" | "start" | "preload" | "pop" | "inApp";
  ymid?: string;
  requestVar?: string;
  timeout?: number;
  catchIfNoFeed?: boolean;
}

interface AdResult {
  reward_event_type?: "valued" | "non_valued" | "not_valued";
  estimated_price?: number;
}

type Handler = (options?: ShowOptions | string) => Promise<AdResult | undefined>;

const handlers = new Map<number, Handler>();

function getHandler(zoneId: string): Handler {
  const id = Number(zoneId);
  let h = handlers.get(id);
  if (!h) {
    h = createAdHandler(id) as unknown as Handler;
    handlers.set(id, h);
  }
  return h;
}

/** True when we should simulate instead of calling the live SDK. */
export function isDevAdMode(zoneId: string): boolean {
  return import.meta.env.DEV || !zoneId || zoneId === "0000000";
}

export interface ShowOutcome {
  completed: boolean;
  valued: boolean;
  noFeed: boolean;
  estimatedPrice?: number;
  error?: string;
}

/** Warm the feed in the background so showing the ad is near-instant. Best-effort. */
export async function preloadAd(zoneId: string, ymid = "warmup"): Promise<boolean> {
  if (isDevAdMode(zoneId)) return false;
  try {
    await getHandler(zoneId)({ type: "preload", ymid, timeout: 8 });
    return true;
  } catch {
    return false;
  }
}

/** Show a Rewarded Interstitial. Resolves when the user finishes/closes the ad. */
export async function showRewardedAd(opts: {
  zoneId: string;
  ymid: string;
  requestVar?: string;
}): Promise<ShowOutcome> {
  const show = getHandler(opts.zoneId);
  try {
    const result = await show({
      type: "end",
      ymid: opts.ymid,
      requestVar: opts.requestVar || "watch_button",
      catchIfNoFeed: true,
    });
    return {
      completed: true,
      valued: result?.reward_event_type === "valued",
      noFeed: false,
      estimatedPrice: result?.estimated_price,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      completed: false,
      valued: false,
      noFeed: /feed|no ?ads?|unavailable|empty/i.test(message),
      error: message,
    };
  }
}

/** DEV-ONLY simulated ad so the loop is testable without a live Monetag zone. */
export function simulateAdDev(onProgress?: (fractionRemaining: number) => void): Promise<void> {
  const totalMs = 2500;
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - started;
      onProgress?.(Math.max(0, 1 - elapsed / totalMs));
      if (elapsed >= totalMs) {
        clearInterval(timer);
        onProgress?.(0);
        resolve();
      }
    }, 100);
  });
}
