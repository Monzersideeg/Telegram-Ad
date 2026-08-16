// Monetag SDK integration for Telegram Mini App.
// Uses the install tag format Monetag provided:
//   <script src="//libtl.com/sdk.js" data-zone="11590144" data-sdk="show_11590144">
// Coins are NOT credited by this client callback. Crediting is server-side only when
// the Monetag S2S postback confirms a valued reward event for the watch session.

type ShowOptions = {
  type?: "end" | "start" | "preload" | "pop" | "inApp";
  ymid?: string;
  requestVar?: string;
  timeout?: number;
  catchIfNoFeed?: boolean;
};

type AdResult = {
  reward_event_type?: "valued" | "non_valued" | "not_valued";
  estimated_price?: number;
};

type Handler = (options?: ShowOptions | string) => Promise<AdResult | undefined>;

export interface MonetagOutcome {
  completed: boolean;
  noFeed?: boolean;
  error?: string;
  estimatedPrice?: number;
}

const SDK_HOST = "//libtl.com";
const handlers = new Map<number, Handler>();
type Queued = [ShowOptions | string, (v: AdResult | undefined) => void, (e: unknown) => void];

function windowRecord(): Record<string, unknown> {
  return window as unknown as Record<string, unknown>;
}

function getHandler(zoneId: string): Handler {
  const id = Number(zoneId);
  if (!Number.isFinite(id) || id <= 0) {
    return () => Promise.reject(new Error("invalid Monetag zone id"));
  }
  const cached = handlers.get(id);
  if (cached) return cached;

  const globalName = `show_${id}`;
  const queue: Queued[] = [];
  let settled = false;

  const flush = () => {
    settled = true;
    const fn = windowRecord()[globalName] as ((o: ShowOptions | string) => Promise<AdResult | undefined>) | undefined;
    for (const [opts, resolve, reject] of queue) {
      if (typeof fn !== "function") reject(new Error("SDK global missing: " + globalName));
      else fn(opts).then(resolve, reject);
    }
    queue.length = 0;
  };

  if (typeof document !== "undefined") {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-sdk="${globalName}"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.src = `${SDK_HOST}/sdk.js`;
      script.async = true;
      script.dataset.zone = String(id);
      script.dataset.sdk = globalName;
      script.addEventListener("load", flush);
      script.addEventListener("error", flush);
      (document.body || document.documentElement).appendChild(script);
    } else if (typeof windowRecord()[globalName] === "function") {
      settled = true;
    } else {
      existing.addEventListener("load", flush, { once: true });
      existing.addEventListener("error", flush, { once: true });
    }
  }

  const handler: Handler = (opts) => {
    const fn = windowRecord()[globalName] as ((o: ShowOptions | string) => Promise<AdResult | undefined>) | undefined;
    if (typeof fn === "function") return fn(opts as ShowOptions | string);
    if (settled) return Promise.reject(new Error("SDK global missing: " + globalName));
    return new Promise<AdResult | undefined>((resolve, reject) => queue.push([opts as ShowOptions | string, resolve, reject]));
  };

  handlers.set(id, handler);
  return handler;
}

export async function preloadMonetag(zoneId: string): Promise<boolean> {
  if (!zoneId) return false;
  try {
    await getHandler(zoneId)({ type: "preload", ymid: "warmup", timeout: 8 });
    return true;
  } catch {
    return false;
  }
}

export function showMonetagRewardedAd(opts: {
  zoneId: string;
  sessionId: string;
  requestVar?: string;
}): Promise<MonetagOutcome> {
  const show = getHandler(opts.zoneId);
  return show({
    type: "end",
    ymid: opts.sessionId,
    requestVar: opts.requestVar || "watch_button",
    catchIfNoFeed: true,
  })
    .then((result) => ({
      completed: true,
      estimatedPrice: result?.estimated_price,
    }))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        completed: false,
        noFeed: /feed is empty|no feed|no ads?|unavailable|empty/i.test(msg),
        error: msg,
      };
    });
}
