// Monetag SDK integration (Rewarded Interstitial).
//
// We load Monetag's SDK from the SAME host their dashboard emits in the install tag
// (//libtl.com/sdk.js). The npm `monetag-tg-sdk` wrapper hardcodes a different, stale
// mirror (yoszi.com) whose build no longer matches the current feed/zone scheme, so we
// inject the script ourselves with the exact data-zone / data-sdk attributes and call
// the resulting global show_<zone>(...). Coins are NEVER granted here: crediting is
// server-side on a verified `valued` S2S postback; the caller polls /api/ads/status.
// We pass `ymid = watch sessionId` so the postback routes back to this exact view.

// Canonical SDK host from Monetag's current install tag (override via env if needed).
const _env = import.meta.env as unknown as Record<string, string | undefined>;
const SDK_HOST = _env.VITE_MONETAG_SDK_HOST || "//libtl.com";

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
type Queued = [ShowOptions | string, (v: AdResult | undefined) => void, (e: unknown) => void];

// Reimplementation of monetag-tg-sdk's createAdHandler, pointed at the correct host.
// Appends ONE <script> per zone and returns a function that invokes the global
// show_<zone>(opts), queueing any calls made before the script finishes loading.
function getHandler(zoneId: string): Handler {
  const id = Number(zoneId);
  const cached = handlers.get(id);
  if (cached) return cached;

  const globalName = `show_${id}`;
  const queue: Queued[] = [];
  let settled = false;
  const doc = typeof document !== "undefined" ? document.body || document.documentElement : null;
  const asFn = (window as Record<string, unknown>)[globalName] as
    | ((o: ShowOptions | string) => Promise<AdResult | undefined>)
    | undefined;

  const flush = () => {
    settled = true;
    const fn = (window as Record<string, unknown>)[globalName] as
      | ((o: ShowOptions | string) => Promise<AdResult | undefined>)
      | undefined;
    for (const [opts, resolve, reject] of queue) {
      if (typeof fn !== "function") reject(new Error("SDK global missing: " + globalName));
      else fn(opts).then(resolve, reject);
    }
    queue.length = 0;
  };

  if (doc) {
    const s = document.createElement("script");
    s.src = `${SDK_HOST}/sdk.js`;
    s.dataset.zone = String(id);
    s.dataset.sdk = globalName;
    s.addEventListener("load", flush);
    s.addEventListener("error", flush);
    doc.appendChild(s);
  }

  const handler: Handler = (opts) => {
    const fn = (window as Record<string, unknown>)[globalName] as
      | ((o: ShowOptions | string) => Promise<AdResult | undefined>)
      | undefined;
    if (typeof fn === "function") return fn(opts as ShowOptions | string);
    if (settled) return Promise.reject(new Error("SDK global missing: " + globalName));
    return new Promise<AdResult | undefined>((resolve, reject) => {
      queue.push([opts as ShowOptions | string, resolve, reject]);
    });
  };
  void asFn;

  handlers.set(id, handler);
  return handler;
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
const preloaded = new Map<number, boolean>();
export function isAdPreloaded(zoneId: string): boolean {
  return preloaded.get(Number(zoneId)) === true;
}
export async function preloadAd(zoneId: string, ymid = "warmup"): Promise<boolean> {
  if (isDevAdMode(zoneId)) return false;
  try {
    await getHandler(zoneId)({ type: "preload", ymid, timeout: 8 });
    preloaded.set(Number(zoneId), true);
    return true;
  } catch {
    preloaded.set(Number(zoneId), false);
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
    // Diagnostics: did the SDK script actually define the global for this zone, and
    // did preload succeed? This disambiguates "script blocked/zone invalid" (global=
    // undefined) from "feed/network failed at show time" (global=function).
    const globalName = `show_${opts.zoneId}`;
    const g = typeof (window as Record<string, unknown>)[globalName];
    const pre = preloaded.get(Number(opts.zoneId)) === true;
    const diag = `${message} [global=${g}, preloaded=${pre}]`;
    return {
      completed: false,
      valued: false,
      noFeed: /feed is empty|no feed|no ads?|unavailable|empty/i.test(message),
      error: diag,
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
