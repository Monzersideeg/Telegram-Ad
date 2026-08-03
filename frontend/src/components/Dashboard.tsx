import React, { useEffect, useRef, useState } from "react";
import { Check, Eye, Flame, Lock, Play, RefreshCw, Users, Zap } from "lucide-react";
import type { AdWatchLog, AppConfig, UserStats } from "../types";
import { translations } from "../utils/translations";
import { LuckySpin } from "./LuckySpin";

interface DashboardProps {
  stats: UserStats;
  watchHistory: AdWatchLog[];
  onNavigateTab: (tab: string) => void;
  telegramUser: { username: string; fullName: string; isPremium: boolean };
  onWatchAd: () => Promise<void>;
  rewardPerAdCoins: number;
  adWatching: boolean;
  adMsg: string | null;
  adCooldownLeft: number;
  maxAdsPerDay: number;
  streakWeek: { dow: string; done: boolean }[];
  streakDays: number;
  taskBlockId: string;
  taskRewardCoins: number;
  onTaskReward: (blockId: string) => Promise<void>;
  appConfig: AppConfig;
  language: "en" | "ru";
  onSpin: () => Promise<{ ok: boolean; rewardCoins?: number; cooldownLeft?: number }>;
  spinCooldownLeft: number;
  feed: string[];
}

const AdsGramTaskCard: React.FC<{
  blockId: string;
  rewardCoins: number;
  currencySymbol: string;
  onReward: (blockId: string) => Promise<void>;
}> = ({ blockId, rewardCoins, currencySymbol, onReward }) => {
  const taskRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setReady(typeof customElements !== "undefined" && !!customElements.get("adsgram-task"));
    const timer = setTimeout(() => setReady(typeof customElements !== "undefined" && !!customElements.get("adsgram-task")), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const task = taskRef.current;
    if (!task) return;

    const reward = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const rewardedBlockId = typeof detail === "string" ? detail : blockId;
      setMsg("Task completed. Crediting reward…");
      try {
        await onReward(rewardedBlockId);
        setMsg("Task reward credited.");
      } catch {
        setMsg("Task completed, but reward could not be credited. Try refreshing.");
      }
    };
    const notFound = () => setMsg("No channel task is available right now.");
    const tooLong = () => setMsg("Session is too long. Please restart the app to get tasks.");
    const error = () => setMsg("Could not load task. Try again later.");

    task.addEventListener("reward", reward);
    task.addEventListener("onBannerNotFound", notFound);
    task.addEventListener("onTooLongSession", tooLong);
    task.addEventListener("onError", error);
    return () => {
      task.removeEventListener("reward", reward);
      task.removeEventListener("onBannerNotFound", notFound);
      task.removeEventListener("onTooLongSession", tooLong);
      task.removeEventListener("onError", error);
    };
  }, [blockId, onReward]);

  if (!blockId) {
    return (
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600">
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 text-xs">Join Telegram channel</div>
          <div className="text-[10px] text-slate-400 mt-0.5">AdsGram task block is not configured yet.</div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center text-xs text-slate-400 font-semibold">
        Loading channel task…
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-1.5">
      {React.createElement(
        "adsgram-task",
        {
          ref: taskRef as React.Ref<HTMLElement>,
          "data-block-id": blockId,
          "data-debug": "false",
          "data-debug-console": "false",
          className: "adsgram-task-card",
        },
        <span slot="reward" className="adsgram-task-reward">+{rewardCoins.toLocaleString()} {currencySymbol}</span>,
        <div slot="button" className="adsgram-task-button">Join</div>,
        <div slot="claim" className="adsgram-task-button adsgram-task-claim">Claim</div>,
        <div slot="done" className="adsgram-task-button adsgram-task-done">Done</div>
      )}
      {msg && <p className="text-[10px] text-center text-slate-500 font-semibold">{msg}</p>}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  watchHistory,
  onNavigateTab,
  onWatchAd,
  rewardPerAdCoins,
  adWatching,
  adMsg,
  adCooldownLeft,
  maxAdsPerDay,
  streakWeek,
  streakDays,
  taskBlockId,
  taskRewardCoins,
  onTaskReward,
  appConfig,
  language,
  onSpin,
  spinCooldownLeft,
  feed,
}) => {
  const t = translations[language] || translations.en;
  const [floatingCoins, setFloatingCoins] = useState<{ id: number; amount: string }[]>([]);
  const prevBalRef = useRef<number | null>(null);
  const feedItems = feed && feed.length ? feed : ["Watch a rewarded ad to earn ACN 🚀", "Complete a channel task for bonus coins ✨"];
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTickerIndex((i) => (i + 1) % feedItems.length), 4500);
    return () => clearInterval(timer);
  }, [feedItems.length]);

  useEffect(() => {
    if (prevBalRef.current === null) {
      prevBalRef.current = stats.balance;
      return;
    }
    if (stats.balance > prevBalRef.current) {
      const deltaCoins = Math.round((stats.balance - prevBalRef.current) * (appConfig.usdToCoinRate || 1000));
      const id = Date.now();
      setFloatingCoins((prev) => [...prev, { id, amount: `+${deltaCoins}` }]);
      setTimeout(() => setFloatingCoins((prev) => prev.filter((x) => x.id !== id)), 1600);
    }
    prevBalRef.current = stats.balance;
  }, [stats.balance, appConfig.usdToCoinRate]);

  const acnBalance = Math.round(stats.balance * appConfig.usdToCoinRate);
  const minWithdrawalCoins = Math.round(appConfig.minWithdrawal * appConfig.usdToCoinRate);
  const progressPercent = Math.min((acnBalance / Math.max(1, minWithdrawalCoins)) * 100, 100);
  const disabled = adWatching || adCooldownLeft > 0;

  return (
    <main className="space-y-4 p-4 relative">
      <div className="bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 rounded-[1.75rem] p-5 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-25 bg-white pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-xs opacity-90 mb-1 font-bold tracking-wide">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/35 animate-pulse" />
            {t.totalBalance}
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-extrabold tracking-tight">{acnBalance.toLocaleString("en-US")}</span>
            <span className="text-sm font-semibold opacity-90 font-mono">{appConfig.currencySymbol}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/10">
            <div className="opacity-90 font-semibold font-mono">≈ ${stats.balance.toFixed(2)} USD</div>
            <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20">{stats.adsWatchedCount} views</div>
          </div>
        </div>
      </div>

      <section className="flex flex-col items-center py-2 relative">
        <div className="relative">
          <button
            id="watchAdBtn"
            onClick={onWatchAd}
            disabled={disabled}
            aria-label={adWatching ? "Loading ad" : adCooldownLeft > 0 ? `Locked ${adCooldownLeft}s` : "Watch ad"}
            className={`relative w-44 h-44 rounded-[2rem] flex flex-col items-center justify-center gap-2 font-black transition-all duration-300 select-none shadow-2xl border border-white/20 active:scale-95 outline-none ${
              disabled ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "bg-gradient-to-br from-emerald-400 to-green-600 text-white hover:scale-[1.02] cursor-pointer shadow-emerald-500/25"
            }`}
          >
            {adWatching ? (
              <>
                <RefreshCw className="w-10 h-10 text-white mb-1 animate-spin" />
                <span className="text-xs tracking-wider uppercase">Loading…</span>
              </>
            ) : adCooldownLeft > 0 ? (
              <>
                <Lock className="w-9 h-9 text-slate-300 mb-1" />
                <span className="text-xl tracking-wider uppercase font-mono">{adCooldownLeft}s</span>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mb-1">
                  <Play className="w-8 h-8 fill-current text-white translate-x-0.5" />
                </div>
                <span className="text-xl tracking-widest uppercase">WATCH AD</span>
                <span className="text-xs opacity-90 font-mono">+{rewardPerAdCoins || 10} {appConfig.currencySymbol}</span>
              </>
            )}
          </button>

          <div className="absolute left-1/2 top-1/2 pointer-events-none w-0 h-0">
            {floatingCoins.map((coin) => (
              <div key={coin.id} className="coin-float absolute font-black text-xl text-emerald-500 font-mono tracking-tight shrink-0 flex items-center space-x-0.5" style={{ transform: "translateX(-50%)" }}>
                <span>🪙</span><span>{coin.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 font-semibold">
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${adCooldownLeft > 0 ? "animate-spin text-amber-500" : "text-emerald-500"}`} />
            <span>{t.cooldown}:</span>
            <span className={`font-bold ${adCooldownLeft > 0 ? "text-amber-500 font-mono" : "text-emerald-500"}`}>{adCooldownLeft > 0 ? `${adCooldownLeft}s` : t.ready}</span>
          </div>
          <div className="w-px h-3 bg-slate-300" />
          <div>{t.adsWatchedToday}: <span className="font-bold text-slate-800">{stats.adsWatchedCount}/{maxAdsPerDay || 20}</span></div>
        </div>
        {adMsg && <p className="mt-2 text-[11px] text-center text-amber-600 font-semibold px-3 leading-snug">{adMsg}</p>}
      </section>

      <AdsGramTaskCard blockId={taskBlockId} rewardCoins={taskRewardCoins} currencySymbol={appConfig.currencySymbol} onReward={onTaskReward} />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100"><Eye className="w-4 h-4 text-emerald-600" /></div><span className="text-xs font-semibold text-slate-400">{t.totalViews}</span></div>
          <div className="text-xl font-extrabold text-slate-800">{stats.adsWatchedCount} {t.ads}</div>
          <div className="text-[10px] font-bold text-emerald-500 mt-0.5 uppercase tracking-wide">server verified</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100"><Users className="w-4 h-4 text-emerald-600" /></div><span className="text-xs font-semibold text-slate-400">{t.referrals}</span></div>
          <div className="text-xl font-extrabold text-slate-800">{stats.referralCount} {t.friends}</div>
          <div className="text-[10px] font-bold text-emerald-500 mt-0.5 uppercase tracking-wide">+{Math.round(stats.referralEarnings * appConfig.usdToCoinRate)} {appConfig.currencySymbol}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4.5">
        <div className="flex items-center justify-between mb-3.5">
          <div><div className="font-extrabold text-slate-800 text-sm">Daily Streak</div><div className="text-[11px] text-slate-400">Watch ads to keep your streak alive</div></div>
          <span className="bg-amber-50 text-amber-800 border border-amber-100 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"><Flame className="w-3 h-3" /> {streakDays} DAY</span>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          {(streakWeek && streakWeek.length ? streakWeek : Array.from({ length: 7 }, (_, i) => ({ dow: ["S", "M", "T", "W", "T", "F", "S"][i], done: false }))).map((d, idx) => (
            <div key={idx} className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-[10px] font-extrabold ${d.done ? "bg-emerald-500 text-white shadow" : "bg-slate-50 text-slate-400 border border-slate-200/40"}`}>{d.dow}</div>
          ))}
        </div>
      </div>

      <LuckySpin onSpin={onSpin} initialCooldownLeft={spinCooldownLeft} />

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>Progress to withdrawal</span><span className="text-slate-800">{acnBalance} / {minWithdrawalCoins} {appConfig.currencySymbol}</span></div>
        <div className="h-2 rounded-full bg-slate-100 relative overflow-hidden border border-slate-200/40"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" style={{ width: `${progressPercent}%` }} /></div>
        <button onClick={() => onNavigateTab("wallet")} className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition">Open Wallet</button>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-emerald-500" /><div className="font-extrabold text-sm text-slate-800">Activity</div></div>
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 p-2.5 text-[11px] font-bold text-center">{feedItems[tickerIndex]}</div>
        {watchHistory.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs font-semibold">No transactions recorded</div>
        ) : (
          <div className="relative border-l border-slate-100 ml-3.5 pl-5 space-y-4 py-1">
            {watchHistory.slice(0, 4).map((log) => {
              const isPayout = log.reward < 0;
              return (
                <div key={log.id} className="relative flex items-center justify-between gap-3 text-left">
                  <div className={`absolute -left-[27px] w-3 h-3 rounded-full border-2 border-white shadow-sm ${isPayout ? "bg-rose-500" : "bg-emerald-500"}`} />
                  <div className="flex-1 min-w-0"><div className="font-bold text-slate-800 text-xs truncate">{log.title}</div><div className="text-[9px] text-slate-400 font-medium mt-0.5 font-mono">{log.timestamp ? log.timestamp.split("T")[0] : "Today"}</div></div>
                  <div className={`font-extrabold text-xs sm:text-sm font-mono shrink-0 ${isPayout ? "text-rose-600" : "text-emerald-600"}`}>{isPayout ? "-" : "+"}{Math.abs(Math.round(log.reward * appConfig.usdToCoinRate))}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};
