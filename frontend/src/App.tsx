/**
 * App orchestrator — ports the reference UI skeleton, wired to the EXISTING backend:
 *  - Auth: Telegram initData (auto-login inside Telegram; Landing page outside).
 *  - Data: /api/auth/me, /api/ledger/*, /api/withdrawals, /api/referrals.
 *  - Ads: real Monetag Rewarded Interstitial + server-to-server postback crediting.
 *  - Games (Lucky Spin / Missions / Arena / check-in): client-side simulations only.
 * The backend is unchanged; coin <-> USD conversion uses config.coinsPerUsd.
 */

import { useState, useEffect, lazy, Suspense, useMemo, type ReactNode } from "react";
import {
  Play, Users, Trophy, Wallet, ShieldCheck, CheckSquare,
  ShieldCheck as ShieldIcon, Zap, Check,
} from "lucide-react";

import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { CheckInCard } from "./components/CheckInCard";
import ErrorBoundary from "./components/ErrorBoundary";

// Heavy / non-initial screens are lazy-loaded (code-split) so first paint and tab
// navigation stay fast on low-end devices. Named exports are adapted to a default.
const Tasks = lazy(() => import("./components/Tasks").then((m) => ({ default: m.Tasks })));
const Referrals = lazy(() => import("./components/Referrals").then((m) => ({ default: m.Referrals })));
const Leaderboard = lazy(() => import("./components/Leaderboard").then((m) => ({ default: m.Leaderboard })));
const Payout = lazy(() => import("./components/Payout").then((m) => ({ default: m.Payout })));
const MyAdmin = lazy(() => import("./components/admin/MyAdmin").then((m) => ({ default: m.MyAdmin })));
const LandingPage = lazy(() => import("./components/public/LandingPage").then((m) => ({ default: m.LandingPage })));
const PrivacyPolicy = lazy(() => import("./components/public/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import("./components/public/TermsOfService").then((m) => ({ default: m.TermsOfService })));

import {
  UserStats, MonetagConfig, PayoutRequest, ReferredFriend, AdWatchLog, AppConfig, AdCampaign, LeaderboardUser,
} from "./types";
import { MOCK_REFERRED_FRIENDS, SIMULATED_AD_CAMPAIGNS } from "./data";
import { isSoundEnabled, setSoundEnabled, playClickSound, playSuccessSound } from "./utils/soundEffects";
import { fireCelebrationConfetti, fireLevelUpConfetti } from "./utils/confetti";
import { txLabel } from "./lib/format";

import { initTelegram } from "./lib/telegram";
import { api, apiErrorMessage } from "./lib/api";
import { isDevAdMode, preloadAd, showRewardedAd, simulateAdDev } from "./lib/monetag";

const TELEGRAM_APP_URL = "https://t.me/AcEarn_bot/app";

/** Spinner shown while a lazy tab chunk downloads. */
const TabLoading = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Per-tab Suspense + ErrorBoundary: a slow chunk shows a spinner, a crash in one tab
 *  shows a small inline fallback instead of blanking the whole Mini App. */
const TabView = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    fallback={
      <div className="p-8 text-center text-xs text-slate-500">
        This section failed to load. Please reopen the app.
      </div>
    }
  >
    <Suspense fallback={<TabLoading />}>{children}</Suspense>
  </ErrorBoundary>
);

/** Shape of GET /api/auth/me from the existing backend. */
interface MeResponse {
  user: { id: number; telegramId: number; username: string | null; firstName: string | null; photoUrl: string | null };
  balance: number; // coins
  streakDays: number;
  referralLink: string;
  isAdmin: boolean;
  config: {
    rewardPerAd: number;
    minWithdrawal: number; // coins
    coinsPerUsd: number;
    adCooldownSeconds: number;
    maxAdsPerDay: number;
    referralBonusPct: number;
    monetagZoneId: string;
  };
}

export default function App() {
  // Navigation: 'landing' | 'dashboard' | 'admin' | 'privacy' | 'terms'
  const [currentPath, setCurrentPath] = useState<string>("landing");
  const [activeTab, setActiveTab] = useState<string>("home");
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => isSoundEnabled());
  const [language, setLanguage] = useState<"en" | "ru">("en");

  // Auth (Telegram initData) — replaces the reference's JWT flow.
  const [loading, setLoading] = useState<boolean>(true);
  const [authed, setAuthed] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [referralLink, setReferralLink] = useState<string>(TELEGRAM_APP_URL);

  const [knockCount, setKnockCount] = useState<number>(0);

  const [appConfig, setAppConfig] = useState<AppConfig>({
    appName: "AcEarn",
    appDescription: "Watch rewarded ads, earn coins, and cash out. Every coin is backed by a verified server-to-server postback.",
    currencySymbol: "ACN",
    usdToCoinRate: 1000,
    enableTasks: true,
    enableFriends: true,
    enableArena: true,
    enableWallet: true,
    enableCaptcha: true,
    joinTelegramReward: 0.1,
    watch10AdsReward: 0.05,
    invite3FriendsReward: 0.3,
    minWithdrawal: 1.0,
    allowedCurrencies: ["TON", "USDT", "TRX", "STARS"],
  });

  const [adCampaigns] = useState<AdCampaign[]>(SIMULATED_AD_CAMPAIGNS);

  const [stats, setStats] = useState<UserStats>({
    balance: 0,
    lifetimeEarnings: 0,
    adsWatchedCount: 0,
    referralCount: 0,
    referralEarnings: 0,
    totalPayouts: 0,
  });

  const [streak, setStreak] = useState<number>(1);
  const [checkedInToday, setCheckedInToday] = useState<boolean>(false);

  // Mission states (client-side simulations)
  const [joinedTelegram, setJoinedTelegram] = useState<boolean>(false);
  const [claimedWatch10, setClaimedWatch10] = useState<boolean>(false);
  const [claimedInvite3, setClaimedInvite3] = useState<boolean>(false);

  const [levelUpData, setLevelUpData] = useState<{ newLevel: number; oldLevel: number } | null>(null);
  const [postbackLogs, setPostbackLogs] = useState<string[]>([]);
  const [feed, setFeed] = useState<string[]>([]);

  const [monetagConfig, setMonetagConfig] = useState<MonetagConfig>({
    smartlinkUrl: "",
    popunderZoneId: "",
    inPagePushZoneId: "",
    interstitialZoneId: "",
    isEnabled: false,
  });

  const [telegramUser, setTelegramUser] = useState<{ username: string; fullName: string; isPremium: boolean; photoUrl: string | null }>({ username: "anonymous", fullName: "Guest User", isPremium: false, photoUrl: null });
  const [friends, setFriends] = useState<ReferredFriend[]>([]);
  const [watchHistory, setWatchHistory] = useState<AdWatchLog[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRequest[]>([]);

  // Game features (backend-driven)
  const [myTelegramId, setMyTelegramId] = useState<number>(0);
  const [missions, setMissions] = useState<{ id: string; reward: number; claimed: boolean; eligible: boolean; progress: number; target: number }[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [myRank, setMyRank] = useState<{ rank: number; earned: number; activeReferralCount: number }>({ rank: 0, earned: 0, activeReferralCount: 0 });
  const [checkin, setCheckin] = useState<{ streakDays: number; checkedInToday: boolean; nextReward: number; week: { dow: string; done: boolean }[] }>({ streakDays: 1, checkedInToday: false, nextReward: 0, week: [] });
  const [spinCooldown, setSpinCooldown] = useState<number>(0);
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [rewardPerAdCoins, setRewardPerAdCoins] = useState<number>(0);
  const [adCooldownSeconds, setAdCooldownSeconds] = useState<number>(30);
  const [maxAdsPerDay, setMaxAdsPerDay] = useState<number>(20);

  // Watch-ad UI state, lifted here so it survives tab switches (Dashboard unmounts
  // when you change tabs; keeping this in App means the spinner / status / cooldown
  // persist, and a late S2S confirmation still updates the balance + counter).
  const [adWatching, setAdWatching] = useState<boolean>(false);
  const [adMsg, setAdMsg] = useState<string | null>(null);
  const [adCooldownLeft, setAdCooldownLeft] = useState<number>(0);

  useEffect(() => {
    if (adCooldownLeft <= 0) return;
    const id = setInterval(() => setAdCooldownLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [adCooldownLeft]);

  // ----- helpers -----
  const addTerminalLog = (lines: string[]) => {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = lines.map((l) => `[${timestamp}] ${l}`);
    setPostbackLogs((prev) => [...prev, ...formatted].slice(-24));
  };

  const navigateTo = (pathName: string) => {
    // Outside Telegram, the "app" routes open the Telegram Mini App link instead.
    if (!authed && (pathName === "/dashboard" || pathName === "/login" || pathName === "/admin")) {
      window.open(TELEGRAM_APP_URL, "_blank");
      return;
    }
    window.location.hash = `#${pathName}`;
  };

  const handleSecretKnock = () => {
    const next = knockCount + 1;
    setKnockCount(next);
    if (next >= 5) {
      setKnockCount(0);
      navigateTo("/admin");
    }
  };

  // ----- hash router -----
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === "#/privacy") setCurrentPath("privacy");
      else if (hash === "#/terms") setCurrentPath("terms");
      else if (hash === "#/dashboard") setCurrentPath("dashboard");
      else if (hash === "#/admin/dashboard" || hash === "#/admin") setCurrentPath("admin");
      else setCurrentPath("landing");
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // ----- data loading from the existing backend -----
  const loadHistory = async (rate: number) => {
    try {
      const { data } = await api.get<{ items: { id: number; type: string; amount: number; created_at: string }[] }>(
        "/api/ledger/transactions?limit=100"
      );
      const txs = data.items || [];
      setWatchHistory(
        txs.map((t) => ({
          id: String(t.id),
          campaignId: t.type,
          title: txLabel(t.type),
          reward: t.amount / rate,
          timestamp: t.created_at,
        }))
      );
      const adsCount = txs.filter((t) => t.type === "ad_reward").length;
      const refEarn = txs.filter((t) => t.type === "referral_bonus").reduce((s, t) => s + t.amount, 0) / rate;
      setStats((prev) => ({ ...prev, adsWatchedCount: adsCount, referralEarnings: refEarn }));
    } catch {
      /* ignore */
    }
  };

  const loadWithdrawals = async (rate: number) => {
    try {
      const { data } = await api.get<{
        items: { id: number; amount: number; method: string; destination: string; status: string; created_at: string }[];
      }>("/api/withdrawals");
      const items = data.items || [];
      const statusMap: Record<string, PayoutRequest["status"]> = {
        pending: "Pending",
        approved: "Completed",
        paid: "Completed",
        rejected: "Rejected",
      };
      setPayoutHistory(
        items.map((w) => {
          const m = /^\[([A-Z]+)\]\s*/.exec(w.destination);
          const currency = (m?.[1] || w.method || "USDT") as PayoutRequest["currency"];
          const address = w.destination.replace(/^\[[A-Z]+\]\s*/, "");
          return {
            id: String(w.id),
            amount: w.amount / rate,
            currency,
            address,
            requestDate: w.created_at,
            status: statusMap[w.status] || "Pending",
          };
        })
      );
      const paidSum = items
        .filter((w) => w.status === "paid" || w.status === "approved")
        .reduce((s, w) => s + w.amount, 0) / rate;
      setStats((prev) => ({ ...prev, totalPayouts: paidSum }));
    } catch {
      /* ignore */
    }
  };

  const loadReferrals = async () => {
    try {
      const rate = appConfig.usdToCoinRate || 1000;
      const { data } = await api.get<{
        count: number;
        earned: number;
        friends: {
          id: number;
          username: string | null;
          firstName: string | null;
          createdAt: string;
          totalEarned: number;
          commission: number;
        }[];
      }>("/api/referrals");
      setStats((prev) => ({
        ...prev,
        referralCount: data.count,
        referralEarnings: (data.earned || 0) / rate,
      }));
      const real: ReferredFriend[] = (data.friends || []).map((f) => ({
        id: String(f.id),
        username: f.username || f.firstName || "friend",
        fullName: f.firstName || f.username || "Friend",
        joinDate: (f.createdAt || "").split("T")[0],
        totalEarned: (f.totalEarned || 0) / rate,
        commissionContributed: (f.commission || 0) / rate,
      }));
      setFriends(real); // real data only — honest empty state when none
    } catch {
      /* ignore */
    }
  };

  const loadFeed = async () => {
    try {
      const { data } = await api.get<{ events: { text: string }[] }>("/api/feed");
      setFeed((data.events || []).map((e) => e.text));
    } catch {
      /* ignore */
    }
  };

  const loadMissions = async (rate: number) => {
    try {
      const { data } = await api.get<{ missions: { id: string; reward: number; claimed: boolean; eligible: boolean; progress: number; target: number }[] }>("/api/missions");
      const ms = data.missions || [];
      setMissions(ms);
      setJoinedTelegram(ms.find((m) => m.id === "join_telegram")?.claimed ?? false);
      setClaimedWatch10(ms.find((m) => m.id === "watch_10_ads")?.claimed ?? false);
      setClaimedInvite3(ms.find((m) => m.id === "invite_3_friends")?.claimed ?? false);
      const rw = (id: string) => ms.find((m) => m.id === id)?.reward ?? 0;
      setAppConfig((prev) => ({
        ...prev,
        joinTelegramReward: rw("join_telegram") / rate,
        watch10AdsReward: rw("watch_10_ads") / rate,
        invite3FriendsReward: rw("invite_3_friends") / rate,
      }));
    } catch {
      /* ignore */
    }
  };

  const loadLeaderboard = async (rate: number, telegramId: number) => {
    try {
      const { data } = await api.get<{
        leaders: { telegramId: number; username: string | null; firstName: string | null; earned: number; referralCount: number; activeReferralCount: number }[];
        me: { rank: number; earned: number; activeReferralCount: number };
        coinsPerUsd: number;
      }>("/api/leaderboard?limit=50");
      const r = data.coinsPerUsd || rate;
      setLeaders(
        (data.leaders || []).map((l, i) => ({
          rank: i + 1,
          username: l.username || `user_${l.telegramId}`,
          fullName: l.firstName || l.username || "User",
          avatarSeed: l.username || String(l.telegramId),
          totalEarned: l.earned / r,
          referralCount: l.referralCount,
          activeReferralCount: l.activeReferralCount,
          isCurrentUser: l.telegramId === telegramId,
        }))
      );
      setMyRank({ rank: data.me.rank, earned: data.me.earned, activeReferralCount: data.me.activeReferralCount });
    } catch {
      /* ignore */
    }
  };

  const loadCheckin = async () => {
    try {
      const { data } = await api.get<{ streakDays: number; checkedInToday: boolean; nextReward: number; week: { dow: string; done: boolean }[] }>("/api/streak");
      setCheckin({ streakDays: data.streakDays, checkedInToday: data.checkedInToday, nextReward: data.nextReward, week: data.week ?? [] });
      setStreak(data.streakDays);
    } catch {
      /* ignore */
    }
  };

  const loadSpin = async () => {
    try {
      const { data } = await api.get<{ retryAfterSec: number }>("/api/spin");
      setSpinCooldown(data.retryAfterSec ?? 0);
    } catch {
      /* ignore */
    }
  };

  const loadApp = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<MeResponse>("/api/auth/me");
      const rate = data.config.coinsPerUsd || 1000;
      const balUsd = data.balance / rate;

      setAuthed(true);
      setIsAdmin(!!data.isAdmin);
      setReferralLink(data.referralLink);
      setTelegramUser({
        username: data.user.username || "telegram_user",
        fullName: data.user.firstName || "User",
        isPremium: false,
        photoUrl: null,
      });
      setAppConfig((prev) => ({
        ...prev,
        usdToCoinRate: rate,
        minWithdrawal: data.config.minWithdrawal / rate,
      }));
      setRewardPerAdCoins(data.config.rewardPerAd);
      setAdCooldownSeconds(data.config.adCooldownSeconds);
      setMaxAdsPerDay(data.config.maxAdsPerDay);
      setMonetagConfig((prev) => ({
        ...prev,
        interstitialZoneId: data.config.monetagZoneId,
        isEnabled: !isDevAdMode(data.config.monetagZoneId),
      }));
      setStats((prev) => ({
        ...prev,
        balance: balUsd,
        lifetimeEarnings: Math.max(balUsd, prev.lifetimeEarnings),
      }));
      setStreak(data.streakDays || 1);
      setMyTelegramId(data.user.telegramId);

      // Fetch the Telegram profile photo (proxied + cached + persisted server-side).
      api
        .get("/api/users/photo", { responseType: "blob" })
        .then((r) => {
          const url = URL.createObjectURL(r.data as Blob);
          setTelegramUser((prev) => ({ ...prev, photoUrl: url }));
        })
        .catch(() => undefined);

      loadHistory(rate);
      loadWithdrawals(rate);
      loadReferrals();
      loadMissions(rate);
      loadLeaderboard(rate, data.user.telegramId);
      loadCheckin();
      loadSpin();
      loadFeed();

      if (!isDevAdMode(data.config.monetagZoneId)) preloadAd(data.config.monetagZoneId);

      addTerminalLog([
        "[SYSTEM] Telegram initData verified (HMAC-SHA256).",
        `[SYSTEM] Session linked to @${data.user.username || data.user.telegramId}.`,
        "[SYSTEM] Monetag rewarded engine ready. Awaiting S2S postbacks.",
      ]);
    } catch {
      setAuthed(false); // outside Telegram / not authorized -> Landing page
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initTelegram();
    loadApp();
    loadFeed();
    const feedTimer = setInterval(() => {
      loadFeed();
    }, 20_000);
    return () => clearInterval(feedTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-login: once authed, go straight to the dashboard.
  useEffect(() => {
    if (!loading && authed && (currentPath === "landing")) {
      window.location.hash = "#/dashboard";
    }
  }, [loading, authed, currentPath]);

  // Poll a watch session until the S2S postback settles it.
  const pollAdStatus = async (sessionId: string): Promise<{ status: string; reward: number } | null> => {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const { data } = await api.get<{ status: string; reward: number }>(`/api/ads/status/${sessionId}`);
        if (data.status === "confirmed" || data.status === "rejected" || data.status === "unrewarded") return data;
      } catch {
        /* retry */
      }
    }
    return null;
  };

  // ----- sound -----
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundEnabled(next);
    if (next) setTimeout(() => playClickSound(), 50);
  };

  const handleNavigateTab = (tab: string) => {
    setActiveTab(tab);
    playClickSound();
  };

  // ----- REAL ad reward flow (Monetag rewarded interstitial + S2S postback) -----
  // CRITICAL: the Monetag SDK handler MUST be invoked synchronously inside the user's
  // tap — no `await` before it — otherwise the browser / Telegram webview drops the
  // transient user-gesture and the interstitial never opens (this was the bug: the old
  // code ran a fake countdown + CAPTCHA and only called the SDK seconds later). So we
  // generate the session id client-side, open the real ad immediately, and register the
  // session with the backend right after (the row is created while the ad is on screen,
  // long before the S2S postback fires on completion). Coins are still credited ONLY by
  // the verified valued postback — never here.
  const handleWatchAd = async (): Promise<void> => {
    if (busyAction || adWatching) return;
    const en = language === "en";
    const sym = appConfig.currencySymbol;

    // Local helper: set the user-facing status line + cooldown for a failed/!credited outcome.
    const finish = (reason: string, detail?: string) => {
      const d = detail ? ` (${detail})` : "";
      setAdWatching(false);
      setBusyAction(false);
      if (reason === "no_ads") {
        setAdMsg((en ? "No ads available right now — try again shortly." : "Сейчас нет рекламы — попробуйте чуть позже.") + d);
        setAdCooldownLeft(15);
      } else if (reason === "zone") {
        setAdMsg((en ? "Ad zone misconfigured (verify the zone ID is the MAIN Rewarded-Interstitial zone in Monetag)." : "Зона рекламы настроена неверно.") + d);
        setAdCooldownLeft(10);
      } else if (reason === "network") {
        setAdMsg((en ? "Ad servers unreachable on this network (often blocked by region/ISP). Try another network or VPN." : "Серверы рекламы недоступны в этой сети. Попробуйте другую сеть/VPN.") + d);
        setAdCooldownLeft(10);
      } else if (reason === "unrewarded") {
        setAdMsg((en ? "Ad watched, but this view wasn't monetized by the network — no reward this time (normal in some regions)." : "Реклама просмотрена, но не монетизирована сетью — на этот раз без награды (обычно для некоторых регионов).") + d);
        setAdCooldownLeft(adCooldownSeconds);
      } else if (reason === "pending") {
        setAdMsg(en ? "Reward pending — confirming with the ad network (can take ~1 min). If this persists, make sure the Monetag postback URL is set in your zone." : "Награда подтверждается сетью (может занять ~1 мин). Если не проходит — проверьте postback URL в зоне Monetag.");
        setAdCooldownLeft(0);
      } else {
        setAdMsg((en ? "Could not load an ad. Please try again." : "Не удалось загрузить рекламу.") + d);
        setAdCooldownLeft(5);
      }
    };

    setAdWatching(true);
    setAdMsg(null);

    const zoneId = monetagConfig.interstitialZoneId;

    // DEV builds (or a missing/placeholder zone) keep a short simulation for testing.
    if (isDevAdMode(zoneId)) {
      await simulateAdDev();
      const coins = rewardPerAdCoins || 10;
      const rate = appConfig.usdToCoinRate || 1000;
      setStats((prev) => ({
        ...prev,
        adsWatchedCount: prev.adsWatchedCount + 1,
        balance: prev.balance + coins / rate,
        lifetimeEarnings: prev.lifetimeEarnings + coins / rate,
      }));
      addTerminalLog(["[DEV] simulated ad (no live Monetag zone configured)."]);
      playSuccessSound();
      setAdWatching(false);
      setBusyAction(false);
      setAdMsg(en ? `✓ Ad watched! +${coins} ${sym} credited.` : `✓ Реклама просмотрена! +${coins} ${sym}.`);
      setAdCooldownLeft(adCooldownSeconds);
      return;
    }

    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 1) SYNCHRONOUS open of the real Monetag rewarded interstitial (gesture preserved).
    const adPromise = showRewardedAd({ zoneId, ymid: sessionId, requestVar: "watch_button" });

    setBusyAction(true);
    addTerminalLog([`POST /api/ads/start (session ${sessionId.slice(0, 8)}…) → opening real Monetag ad…`]);

    // 2) Register the session in the background so the row exists while the ad plays.
    const regPromise = api.post("/api/ads/start", { sessionId }).catch((err) => {
      addTerminalLog([`✗ /api/ads/start failed: ${apiErrorMessage(err)}`]);
      return null;
    });

    // 3) Wait for the user to finish (or dismiss) the real ad, then ensure the row exists.
    const outcome = await adPromise;
    await regPromise;

    if (!outcome.completed) {
      addTerminalLog([`✗ Real ad not shown: ${outcome.error || "no feed / unavailable"}`]);
      const msg = outcome.error || "";
      const reason = outcome.noFeed
        ? "no_ads"
        : /zone misconfigured/i.test(msg)
        ? "zone"
        : /network error|timeout exceeded|communicating/i.test(msg)
        ? "network"
        : "other";
      finish(reason, outcome.error);
      return;
    }

    // 4) Poll for the authoritative S2S postback outcome.
    addTerminalLog([`GET /api/ads/status/${sessionId.slice(0, 8)}… → awaiting S2S confirmation…`]);
    const status = await pollAdStatus(sessionId);
    const rate = appConfig.usdToCoinRate;

    if (status?.status === "confirmed") {
      const coins = status.reward;
      const b = await api.get<{ balance: number }>("/api/ledger/balance").catch(() => null);
      const newBalUsd = b ? b.data.balance / rate : stats.balance + coins / rate;
      const oldLevel = Math.floor(stats.adsWatchedCount / 10) + 1;
      setStats((prev) => ({
        ...prev,
        balance: newBalUsd,
        lifetimeEarnings: prev.lifetimeEarnings + coins / rate,
        adsWatchedCount: prev.adsWatchedCount + 1,
      }));
      const newLevel = Math.floor((stats.adsWatchedCount + 1) / 10) + 1;
      if (newLevel > oldLevel) {
        setTimeout(() => {
          setLevelUpData({ newLevel, oldLevel });
          fireLevelUpConfetti();
        }, 600);
      }
      addTerminalLog([`✓ S2S postback verified (valued). Credited +${coins} ${sym}.`]);
      playSuccessSound();
      // Balance increase above triggers the coin float in Dashboard; show a clear prompt too.
      setAdWatching(false);
      setBusyAction(false);
      setAdMsg(en ? `✓ Ad watched! +${coins} ${sym} credited.` : `✓ Реклама просмотрена! +${coins} ${sym}.`);
      setAdCooldownLeft(adCooldownSeconds);
      return;
    }

    if (status?.status === "unrewarded") {
      addTerminalLog(["⚠ Ad viewed but not valued (unpaid traffic). No reward credited."]);
      finish("unrewarded", outcome.error);
      return;
    }

    addTerminalLog(["⏳ Reward pending confirmation — balance will sync shortly."]);
    api.get<{ balance: number }>("/api/ledger/balance")
      .then((b) => setStats((prev) => ({ ...prev, balance: b.data.balance / rate })))
      .catch(() => undefined);
    finish("pending");
  };

  // ----- daily check-in (backend) -----
  const handleCheckIn = async () => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const { data } = await api.post<{ alreadyCheckedIn: boolean; streakDays: number; reward: number; balance: number }>("/api/streak/checkin");
      const rate = appConfig.usdToCoinRate;
      if (data.alreadyCheckedIn) {
        addTerminalLog(["Already checked in today."]);
      } else {
        setStats((prev) => ({ ...prev, balance: data.balance / rate, lifetimeEarnings: prev.lifetimeEarnings + data.reward / rate }));
        setStreak(data.streakDays);
        setCheckin({ streakDays: data.streakDays, checkedInToday: true, nextReward: data.reward });
        setWatchHistory((prev) => [
          { id: `checkin_${Date.now()}`, campaignId: "streak_bonus", title: `Daily Check-In (Day ${data.streakDays})`, reward: data.reward / rate, timestamp: new Date().toISOString() },
          ...prev,
        ]);
        addTerminalLog([`✓ Daily check-in. +${data.reward} ${appConfig.currencySymbol} (streak ${data.streakDays}).`]);
        playSuccessSound();
        fireCelebrationConfetti();
      }
    } catch (err) {
      addTerminalLog([`✗ ${apiErrorMessage(err)}`]);
    } finally {
      setBusyAction(false);
    }
  };

  // ----- lucky spin (backend, server-authoritative) -----
  const handleSpin = async (): Promise<{ ok: boolean; rewardCoins?: number; cooldownLeft?: number }> => {
    try {
      const { data } = await api.post<{ reward: number; balance: number; cooldownSeconds: number }>("/api/spin");
      const rate = appConfig.usdToCoinRate;
      setStats((prev) => ({ ...prev, balance: data.balance / rate, lifetimeEarnings: prev.lifetimeEarnings + data.reward / rate }));
      setSpinCooldown(data.cooldownSeconds ?? 24 * 60 * 60);
      setWatchHistory((prev) => [
        { id: `spin_${Date.now()}`, campaignId: "spin_reward", title: "Lucky Spin", reward: data.reward / rate, timestamp: new Date().toISOString() },
        ...prev,
      ]);
      addTerminalLog([`✓ Lucky Spin won +${data.reward} ${appConfig.currencySymbol}.`]);
      playSuccessSound();
      fireCelebrationConfetti();
      return { ok: true, rewardCoins: data.reward, cooldownLeft: data.cooldownSeconds ?? 24 * 60 * 60 };
    } catch (err) {
      const retry = (err as { response?: { data?: { meta?: { retryAfterSec?: number } } } })?.response?.data?.meta?.retryAfterSec;
      if (retry) {
        setSpinCooldown(Number(retry));
        return { ok: false, cooldownLeft: Number(retry) };
      }
      addTerminalLog([`✗ ${apiErrorMessage(err)}`]);
      return { ok: false };
    }
  };

  // ----- one-time missions (backend) -----
  const claimMission = async (missionId: string) => {
    try {
      const { data } = await api.post<{ reward: number; balance: number }>("/api/missions/claim", { missionId });
      const rate = appConfig.usdToCoinRate;
      setStats((prev) => ({ ...prev, balance: data.balance / rate, lifetimeEarnings: prev.lifetimeEarnings + data.reward / rate }));
      if (missionId === "join_telegram") setJoinedTelegram(true);
      if (missionId === "watch_10_ads") setClaimedWatch10(true);
      if (missionId === "invite_3_friends") setClaimedInvite3(true);
      setMissions((prev) => prev.map((m) => (m.id === missionId ? { ...m, claimed: true } : m)));
      setWatchHistory((prev) => [
        { id: `mission_${Date.now()}`, campaignId: "mission_reward", title: `Mission: ${missionId.replace(/_/g, " ")}`, reward: data.reward / rate, timestamp: new Date().toISOString() },
        ...prev,
      ]);
      addTerminalLog([`✓ Mission claimed (${missionId}). +${data.reward} ${appConfig.currencySymbol}.`]);
      playSuccessSound();
      fireCelebrationConfetti();
    } catch (err) {
      addTerminalLog([`✗ ${apiErrorMessage(err)}`]);
      alert(apiErrorMessage(err));
    }
  };

  const handleJoinTelegram = () => claimMission("join_telegram");
  const handleClaimWatch10 = () => claimMission("watch_10_ads");
  const handleClaimInvite3 = () => claimMission("invite_3_friends");

  // ----- simulated invite (visual demo) -----
  const handleInviteFriendSimulated = () => {
    const names = ["Dmitry Volkov", "Clara Vance", "Tariq Al-Mansoor", "Li Wei", "Emma Watson"];
    const usernames = ["dima_ton", "clara_v", "tariq_crypto", "li_earn_coin", "emma_stars"];
    const i = Math.floor(Math.random() * names.length);
    const chosenUsername = usernames[i] + Math.floor(Math.random() * 99);
    const mockFriend: ReferredFriend = {
      id: `friend_${Date.now()}`,
      username: chosenUsername,
      fullName: names[i],
      joinDate: new Date().toISOString().split("T")[0],
      totalEarned: 0,
      commissionContributed: 0,
    };
    setFriends((prev) => [mockFriend, ...prev]);
    setStats((prev) => ({ ...prev, referralCount: prev.referralCount + 1 }));
    addTerminalLog([`EVENT /referral/invite (simulation) → @${chosenUsername} registered.`]);
  };

  // ----- REAL withdrawal -----
  const handleWithdrawalRequest = async (amount: number, currency: string, address: string) => {
    const rate = appConfig.usdToCoinRate;
    const coins = Math.round(amount * rate);
    const method = currency === "USDT" ? "USDT-TRC20" : "gift-card";
    const destination = `[${currency}] ${address}`;
    addTerminalLog([`POST /api/withdrawals → ${coins} ${appConfig.currencySymbol} via ${method}…`]);
    try {
      await api.post("/api/withdrawals", { amount: coins, method, destination });
      const b = await api.get<{ balance: number }>("/api/ledger/balance");
      setStats((prev) => ({ ...prev, balance: b.data.balance / rate }));
      await loadWithdrawals(rate);
      addTerminalLog([`✓ Withdrawal submitted. Status: pending admin review.`]);
      playSuccessSound();
    } catch (err) {
      addTerminalLog([`✗ Withdrawal failed: ${apiErrorMessage(err)}`]);
      alert(apiErrorMessage(err));
    }
  };

  // Refresh real withdrawal statuses (replaces the reference's mock "confirm").
  const handlePayoutApproval = () => {
    loadWithdrawals(appConfig.usdToCoinRate);
    addTerminalLog(["↻ Refreshing withdrawal statuses from ledger…"]);
  };

  const handleLogout = () => {
    setAuthed(false);
    navigateTo("/");
    window.location.hash = "";
  };

  const handleUpdateMonetag = (newConfig: MonetagConfig) => {
    // Local-only (backend monetization config is managed via env on the server).
    setMonetagConfig(newConfig);
  };

  // =========================================================
  // ROUTER OUTLET
  // =========================================================
  if (currentPath === "privacy") {
    return <TabView><PrivacyPolicy appConfig={appConfig} onNavigate={navigateTo} language={language} /></TabView>;
  }
  if (currentPath === "terms") {
    return <TabView><TermsOfService appConfig={appConfig} onNavigate={navigateTo} language={language} /></TabView>;
  }
  if (currentPath === "admin") {
    if (!authed || !isAdmin) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4 p-6">
          <ShieldIcon className="w-12 h-12 text-red-500 animate-pulse" />
          <h2 className="text-sm uppercase tracking-widest text-slate-400 text-center">
            {authed ? "Your account is not an administrator." : "Authenticate via Telegram to continue."}
          </h2>
          <button
            onClick={() => navigateTo(authed ? "/dashboard" : "/login")}
            className="px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl cursor-pointer"
          >
            {authed ? "Back to App" : "Open in Telegram"}
          </button>
        </div>
      );
    }
    return <TabView><MyAdmin onLogout={handleLogout} /></TabView>;
  }

  // Loading splash
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f8ff] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading AcEarn…</p>
      </div>
    );
  }

  // Not authed (outside Telegram) → Landing page
  if (!authed || currentPath === "landing") {
    if (!authed) {
      return <TabView><LandingPage appConfig={appConfig} onNavigate={navigateTo} language={language} /></TabView>;
    }
  }

  // DEFAULT: authenticated dashboard
  return (
    <div className="min-h-screen bg-[#f0f8ff] font-sans flex items-center justify-center p-0 md:p-8 lg:p-12 relative overflow-hidden select-none">
      <div className="absolute top-[5%] left-[5%] w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[5%] right-[5%] w-[450px] h-[450px] rounded-full bg-green-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10 h-full">
        {/* LEFT SIDEBAR */}
        <div className="hidden lg:block lg:col-span-3 space-y-6 text-slate-800">
          <div className="space-y-4">
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={handleSecretKnock}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-100 border border-emerald-200">
                <Zap className="w-5 h-5 text-emerald-700 fill-emerald-500 animate-pulse" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-800">{appConfig.appName}</span>
            </div>
            <h1 className="font-extrabold text-3xl leading-tight tracking-tight text-slate-800">
              Watch ads.<br />Earn real coins.<br /><span className="text-emerald-500">Cash out daily.</span>
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              A Telegram Mini App powered by server-verified rewarded ads. Every coin is backed by a signed postback — no cheating, no fake clicks.
            </p>
          </div>

          <div className="space-y-3.5 text-xs text-slate-600 font-medium">
            {[
              "HMAC-SHA256 initData verification",
              "Server-to-server ad postbacks",
              "Redis anti-fraud cooldowns",
              "Referral bonuses · lifetime",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REWARD PER AD</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800 tracking-tight">
                +{(appConfig.usdToCoinRate ? (10 / appConfig.usdToCoinRate) : 0.01).toFixed(3)}
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">valued views</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal font-light">Credited only on paid (valued) postbacks.</p>
          </div>
        </div>

        {/* CENTER */}
        <div className="col-span-1 lg:col-span-6 flex justify-center items-center w-full">
          <div className="w-full max-w-lg md:h-[780px] bg-[#f0f8ff] border border-slate-200 rounded-none md:rounded-[2.25rem] shadow-xl relative flex flex-col overflow-hidden h-screen md:h-auto">
            <div className="w-full h-full flex flex-col relative">
              <div onClick={handleSecretKnock} className="pt-safe sticky top-0 z-40 bg-white/95 flex flex-col shrink-0 select-none border-b border-slate-100">
                <Header
                  stats={stats}
                  monetagConfig={monetagConfig}
                  onUpdateMonetag={handleUpdateMonetag}
                  telegramUser={telegramUser}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
                  appConfig={appConfig}
                  language={language}
                  onLanguageChange={setLanguage}
                />
              </div>

              <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }}>
                {activeTab === "home" && (
                  <>
                    <div className="px-4 pt-3">
                      <CheckInCard
                        streakDays={checkin.streakDays}
                        checkedInToday={checkin.checkedInToday}
                        reward={checkin.nextReward}
                        currencySymbol={appConfig.currencySymbol}
                        busy={busyAction}
                        onCheckIn={handleCheckIn}
                      />
                    </div>
                    <Dashboard
                      stats={stats}
                      watchHistory={watchHistory}
                      onNavigateTab={handleNavigateTab}
                      telegramUser={telegramUser}
                      onWatchAd={handleWatchAd}
                      joinedTelegram={joinedTelegram}
                      onJoinTelegram={handleJoinTelegram}
                      monetagConfig={monetagConfig}
                      appConfig={appConfig}
                      rewardPerAdCoins={rewardPerAdCoins}
                      adWatching={adWatching}
                      adMsg={adMsg}
                      adCooldownLeft={adCooldownLeft}
                      maxAdsPerDay={maxAdsPerDay}
                      streakWeek={checkin.week}
                      streakDays={checkin.streakDays}
                      feed={feed}
                      language={language}
                      onSpin={handleSpin}
                      spinCooldownLeft={spinCooldown}
                    />
                  </>
                )}
                {activeTab === "tasks" && (
                  <TabView>
                    <Tasks
                      stats={stats}
                      joinedTelegram={joinedTelegram}
                      onJoinTelegram={handleJoinTelegram}
                      claimedWatch10={claimedWatch10}
                      onClaimWatch10={handleClaimWatch10}
                      claimedInvite3={claimedInvite3}
                      onClaimInvite3={handleClaimInvite3}
                      onNavigateTab={handleNavigateTab}
                      appConfig={appConfig}
                      language={language}
                    />
                  </TabView>
                )}
                {activeTab === "friends" && (
                  <TabView>
                    <Referrals
                      friends={friends}
                      referralCode={referralLink}
                      referralEarnings={stats.referralEarnings}
                    />
                  </TabView>
                )}
                {activeTab === "arena" && (
                  <TabView>
                    <Leaderboard
                      users={leaders}
                      currentUserStats={{
                        balance: stats.balance,
                        adsCount: stats.adsWatchedCount,
                        referralCount: stats.referralCount,
                        activeReferralCount: myRank.activeReferralCount,
                        rank: myRank.rank,
                      }}
                      telegramUser={telegramUser}
                    />
                  </TabView>
                )}
                {activeTab === "wallet" && (
                  <TabView>
                    <Payout
                      balance={stats.balance}
                      payoutHistory={payoutHistory}
                      onSubmitPayout={handleWithdrawalRequest}
                      onSimulateApprove={handlePayoutApproval}
                      appConfig={appConfig}
                    />
                  </TabView>
                )}
              </div>

              {/* BOTTOM NAV */}
              <nav
                aria-label="Primary navigation"
                className="absolute left-4 right-4 bg-white/90 backdrop-blur border border-slate-200/80 rounded-2xl p-1.5 flex justify-around items-center z-40 shadow-md"
                style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
              >
                {[
                  { id: "home", label: "Earn", Icon: Play },
                  { id: "tasks", label: "Missions", Icon: CheckSquare },
                  { id: "friends", label: "Friends", Icon: Users },
                  { id: "arena", label: "Arena", Icon: Trophy },
                  { id: "wallet", label: "Wallet", Icon: Wallet },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleNavigateTab(id)}
                    aria-label={label}
                    aria-current={activeTab === id ? "page" : undefined}
                    className={`flex flex-col items-center justify-center gap-1.5 min-h-[52px] py-2 px-3 rounded-xl transition cursor-pointer flex-1 ${
                      activeTab === id ? "text-emerald-600 bg-emerald-50/80 font-black" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    <span className="text-[11px] font-bold tracking-tight uppercase">{label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="hidden lg:block lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm font-mono">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Postback Stream</span>
            </div>
            <div className="h-[210px] overflow-y-auto text-[10px] text-slate-600 space-y-2 select-all leading-relaxed">
              {postbackLogs.length === 0 ? (
                <div className="text-slate-400 text-[9px] font-medium italic">Waiting for ad postbacks…</div>
              ) : (
                postbackLogs.map((log, i) => {
                  const hi = log.includes("✓") || log.includes("200") || log.includes("+") || log.includes("credited");
                  const sys = log.includes("[SYSTEM]");
                  return (
                    <div key={i} className={`break-all whitespace-pre-wrap ${sys ? "text-indigo-600 font-semibold" : hi ? "text-emerald-600 font-bold" : "text-slate-500"}`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Security</span>
            </div>
            <div className="space-y-2 text-[11px] text-slate-600 font-medium">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-normal">initData HMAC</span>
                <span className="font-bold text-emerald-600">{authed ? "verified" : "—"}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-t border-slate-50">
                <span className="text-slate-500 font-normal">Daily streak</span>
                <span className="font-semibold text-slate-700">{streak} day{streak === 1 ? "" : "s"}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-t border-slate-50">
                <span className="text-slate-500 font-normal">Reward crediting</span>
                <span className="font-semibold text-slate-700">S2S postback</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-t border-slate-50">
                <span className="text-slate-500 font-normal">Session</span>
                <span className="font-bold text-emerald-600">@{telegramUser.username}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LEVEL UP MODAL */}
      {levelUpData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white font-extrabold flex items-center justify-center text-3xl shadow-lg mx-auto animate-bounce">
              🏆
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{language === "en" ? "LEVEL UP!" : "НОВЫЙ УРОВЕНЬ!"}</h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === "en" ? "Congratulations! You are climbing the ranks." : "Поздравляем! Вы продвигаетесь по рангам."}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-[10px] text-slate-400 uppercase font-extrabold">{language === "en" ? "Previous" : "Прошлый"}</div>
                <div className="text-2xl font-black text-slate-400">Lvl {levelUpData.oldLevel}</div>
              </div>
              <div className="text-2xl text-emerald-500 font-bold animate-pulse">➔</div>
              <div className="text-center">
                <div className="text-[10px] text-emerald-600 uppercase font-extrabold">{language === "en" ? "New Level" : "Новый Лвл"}</div>
                <div className="text-3xl font-black text-emerald-600">Lvl {levelUpData.newLevel}</div>
              </div>
            </div>
            <button
              onClick={() => { setLevelUpData(null); playClickSound(); }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer"
            >
              {language === "en" ? "Awesome, Let's Continue!" : "Отлично, продолжаем!"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
