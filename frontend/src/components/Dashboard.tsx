/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, Users, Award, Eye, Coins, Play, Info, HelpCircle, 
  ArrowRight, ExternalLink, Calendar, CheckSquare, Sparkles, 
  Flame, Check, ChevronDown, ChevronUp, Lock, RefreshCw, Trophy,
  Shield, Smartphone, Star, Gift
} from 'lucide-react';
import { UserStats, AdWatchLog, AdCampaign, AppConfig } from '../types';
import { translations, FAQ_ITEMS_TR, TICKER_EVENTS_TR } from '../utils/translations';
import { LuckySpin } from './LuckySpin';

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
  joinedTelegram: boolean;
  onJoinTelegram: () => void;
  monetagConfig: { isEnabled: boolean };
  appConfig: AppConfig;
  language: 'en' | 'ru';
  onSpin: () => Promise<{ ok: boolean; rewardCoins?: number; cooldownLeft?: number }>;
  spinCooldownLeft: number;
  feed: string[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  watchHistory,
  onNavigateTab,
  telegramUser,
  onWatchAd,
  rewardPerAdCoins,
  adWatching,
  adMsg,
  adCooldownLeft,
  maxAdsPerDay,
  streakWeek,
  streakDays,
  joinedTelegram,
  onJoinTelegram,
  monetagConfig,
  appConfig,
  language,
  onSpin,
  spinCooldownLeft,
  feed,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [tickerIndex, setTickerIndex] = useState(0);

  const t = translations[language] || translations.en;
  const FAQ_ITEMS = FAQ_ITEMS_TR[language] || FAQ_ITEMS_TR.en;
  const tickerEvents = TICKER_EVENTS_TR[language] || TICKER_EVENTS_TR.en;
  // Real activity feed from the server. Falls back to honest prompts when empty —
  // never fabricated user events. (tickerEvents is kept only as a last resort.)
  const feedItems =
    feed && feed.length
      ? feed
      : language === 'en'
      ? ['Be the first to earn ACN today 🚀', 'Watch a rewarded ad to keep your streak alive 🔥']
      : ['Заработайте первые ACN сегодня 🚀', 'Смотрите рекламу, чтобы поддерживать серию 🔥'];
  void tickerEvents;

  // Floating particle system for ad rewards. Driven by balance increases (see the
  // effect below) so the reward animation survives tab switches / remounts — the
  // watch-in-progress / status / cooldown state itself now lives in App.
  const [floatingCoins, setFloatingCoins] = useState<{ id: number; amount: string }[]>([]);
  const prevBalRef = useRef<number | null>(null);

  // Active Ad overlay play states
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<AdCampaign | null>(null);
  const [adTimeLeft, setAdTimeLeft] = useState(0);
  const [adProgress, setAdProgress] = useState(100);
  const [isAdCompleted, setIsAdCompleted] = useState(false);

  // Anti-bot CAPTCHA validation
  const [captchaAnswer, setCaptchaAnswer] = useState(0);
  const [userCaptcha, setUserCaptcha] = useState('');
  const [captchaError, setCaptchaError] = useState(false);

  // Playable micro ad states
  const [clickerCount, setClickerCount] = useState(0);
  const [clickParticles, setClickParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [monetagStep, setMonetagStep] = useState(0);
  const [tonWalletConnected, setTonWalletConnected] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % feedItems.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [feedItems.length]);

  // Float a coin reward whenever the balance grows (a confirmed ad, check-in, mission,
  // spin…). The first read just seeds the baseline so the initial /me load doesn't
  // animate a fake "+balance" coin.
  useEffect(() => {
    if (prevBalRef.current === null) {
      prevBalRef.current = stats.balance;
      return;
    }
    if (stats.balance > prevBalRef.current) {
      const deltaCoins = Math.round(
        (stats.balance - prevBalRef.current) * (appConfig.usdToCoinRate || 1000)
      );
      const id = Date.now();
      setFloatingCoins((prev) => [...prev, { id, amount: `+${deltaCoins}` }]);
      setTimeout(() => setFloatingCoins((prev) => prev.filter((x) => x.id !== id)), 1600);
    }
    prevBalRef.current = stats.balance;
  }, [stats.balance, appConfig.usdToCoinRate]);

  // Active Ad countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlayingAd && adTimeLeft > 0) {
      interval = setInterval(() => {
        setAdTimeLeft((prev) => {
          const next = prev - 1;
          const percentage = (next / (activeCampaign?.durationSeconds || 5)) * 100;
          setAdProgress(percentage);

          // Cycle slideshow for monetization card
          if (activeCampaign?.id === 'camp_monetag_push') {
            setMonetagStep((s) => (s + 1) % 4);
          }
          return next;
        });
      }, 1000);
    } else if (isPlayingAd && adTimeLeft === 0) {
      setIsPlayingAd(false);
      setIsAdCompleted(true);
      generateCaptcha();
    }
    return () => clearInterval(interval);
  }, [isPlayingAd, adTimeLeft, activeCampaign]);

  const generateCaptcha = () => {
    const val1 = Math.floor(Math.random() * 7) + 2;
    const val2 = Math.floor(Math.random() * 6) + 1;
    setCaptchaAnswer(val1 + val2);
    setUserCaptcha('');
    setCaptchaError(false);
  };

  // Click on the massive circular "WATCH AD" trigger → opens a REAL Monetag ad.
  // In-progress / status / cooldown state is owned by App (controlled via props), so
  // it survives switching tabs — Dashboard no longer loses it on unmount/remount.
  const handleWatchAdClick = async () => {
    if (adCooldownLeft > 0 || adWatching) return;
    await onWatchAd();
  };

  const handleCaptchaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(userCaptcha) === captchaAnswer) {
      if (activeCampaign) {
        const rewardValue = activeCampaign.rewardAmount;
        
        // Trigger claim callback
        onAdWatched(rewardValue, activeCampaign.title);

        // Spawn a beautiful float particle
        const coinAmount = Math.round((monetagConfig.isEnabled ? rewardValue * 1.5 : rewardValue) * appConfig.usdToCoinRate);
        const particleId = Date.now();
        setFloatingCoins((prev) => [...prev, { id: particleId, amount: `+${coinAmount}` }]);
        
        setTimeout(() => {
          setFloatingCoins((prev) => prev.filter((item) => item.id !== particleId));
        }, 1500);

        // Reset overlay states
        setActiveCampaign(null);
        setIsAdCompleted(false);

        // Lock button into 30 seconds cooldown as described in reference sketch
        setCooldownTimeLeft(30);
      }
    } else {
      setCaptchaError(true);
    }
  };

  const handleInteractiveTap = (e: React.MouseEvent<HTMLButtonElement>) => {
    setClickerCount((c) => c + 1);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newParticle = { id: Date.now(), x, y };
    setClickParticles((p) => [...p, newParticle]);

    setTimeout(() => {
      setClickParticles((p) => p.filter((item) => item.id !== newParticle.id));
    }, 800);
  };

  const handleSpinWheel = () => {
    const extraRot = 720 + Math.floor(Math.random() * 360);
    setWheelRotation((prev) => prev + extraRot);
  };

  // Convert USD metrics to coins using dynamic conversion rate
  const acnBalance = Math.round(stats.balance * appConfig.usdToCoinRate);
  const cpmValue = stats.adsWatchedCount > 0 
    ? ((stats.lifetimeEarnings - stats.referralEarnings) / stats.adsWatchedCount * appConfig.usdToCoinRate).toFixed(2)
    : (0.0085 * appConfig.usdToCoinRate).toFixed(2);

  // Withdrawal boundary thresholds
  const minWithdrawal = appConfig.minWithdrawal;
  const withdrawProgress = Math.min((stats.balance / minWithdrawal) * 100, 100);

  const getCampaignIcon = (id: string) => {
    switch (id) {
      case 'camp_ton_quest':
        return <Smartphone className="w-6 h-6 text-sky-400" />;
      case 'camp_monetag_push':
        return <Shield className="w-6 h-6 text-emerald-400" />;
      case 'camp_crypto_clicker':
        return <Flame className="w-6 h-6 text-amber-500 animate-pulse" />;
      case 'camp_spin_win':
        return <Gift className="w-6 h-6 text-purple-400" />;
      case 'camp_durov_tribute':
        return <Star className="w-6 h-6 text-yellow-400" fill="currentColor" />;
      default:
        return <Sparkles className="w-6 h-6 text-indigo-400" />;
    }
  };

  return (
    <div id="dashboard-view" className="scroll-area flex-1 overflow-y-auto pb-28 px-5 pt-3 space-y-4">
      
      {/* Live Social Proof Ticker Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl px-3 py-1.5 shadow-sm overflow-hidden relative">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 shrink-0 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[9px] font-bold text-emerald-600 tracking-wider uppercase shrink-0 font-mono">Live Feed:</span>
          <div className="overflow-hidden relative w-full h-4">
            <div 
              className="absolute left-0 right-0 text-[10px] text-slate-600 font-bold truncate transition-all duration-500 ease-out flex items-center"
              key={tickerIndex}
            >
              <span className="animate-in slide-in-from-bottom-2 duration-300">
                {feedItems[tickerIndex % feedItems.length]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Total Balance Card (emerald gradient exactly matching the sketch) */}
      <div className="relative rounded-3xl p-5 overflow-hidden text-white shadow-lg shadow-emerald-500/10 bg-gradient-to-br from-emerald-500 to-green-600">
        {/* Dynamic circular highlights */}
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-25 bg-white pointer-events-none"></div>
        <div className="absolute -right-10 top-10 w-20 h-20 rounded-full opacity-15 bg-white pointer-events-none"></div>
        
        <div className="relative">
          <div className="flex items-center gap-1.5 text-xs opacity-90 mb-1 font-bold tracking-wide">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/35 animate-pulse" />
            {t.totalBalance}
          </div>
          
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-extrabold tracking-tight font-sans" id="balanceDisplay">
              {acnBalance.toLocaleString('en-US')}
            </span>
            <span className="text-sm font-semibold opacity-90 font-mono">ACN</span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/10">
            <div>
              <div className="opacity-90 font-semibold font-mono">≈ ${stats.balance.toFixed(2)} USD</div>
            </div>
            <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20">
              ↑ +{Math.round((stats.adsWatchedCount * 0.015) * 1000)} {t.today}
            </div>
          </div>
        </div>
      </div>

      {/* 2. WATCH AD big button section */}
      <div className="flex flex-col items-center py-2 relative">
        <div className="relative">
          {/* Main button styled exactly like sketch */}
          <button
            id="watchAdBtn"
            onClick={handleWatchAdClick}
            disabled={adCooldownLeft > 0 || adWatching}
            aria-label={adWatching ? "Loading ad" : adCooldownLeft > 0 ? `Watch ad locked, ${adCooldownLeft} seconds remaining` : "Watch ad to earn coins"}
            className={`relative w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 font-bold transition-all duration-300 select-none shadow-xl border border-emerald-400/20 active:scale-95 cursor-pointer outline-none ${
              adCooldownLeft > 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                : 'btn-primary bg-gradient-to-br from-emerald-400 to-green-500 text-white pulse-ring hover:scale-[1.02]'
            }`}
          >
            {adWatching ? (
              <>
                <RefreshCw className="w-8 h-8 text-white mb-1 animate-spin" />
                <span className="text-[10px] tracking-wider uppercase font-extrabold">{language === 'en' ? 'Loading ad…' : 'Загрузка…'}</span>
                <span className="text-[9px] opacity-90 font-mono">{language === 'en' ? 'stay here' : 'не закрывайте'}</span>
              </>
            ) : adCooldownLeft > 0 ? (
              <>
                <Lock className="w-7 h-7 text-slate-300 mb-1" />
                <span className="text-xs tracking-wider uppercase font-mono">{adCooldownLeft}s</span>
                <span className="text-[9px] text-slate-400 font-medium">{t.cooldown.toUpperCase()}</span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center mb-0.5">
                  <Play className="w-6 h-6 fill-current text-white translate-x-0.5" />
                </div>
                <span className="text-xs tracking-wider uppercase font-extrabold">{t.watchAd}</span>
                <span className="text-[9px] opacity-90 font-mono">+{rewardPerAdCoins || Math.round(0.01 * appConfig.usdToCoinRate)} {appConfig.currencySymbol}</span>
              </>
            )}
          </button>

          {/* Floating Coin Rewards Animation layer */}
          <div id="coinFloat" className="absolute left-1/2 top-1/2 pointer-events-none w-0 h-0">
            {floatingCoins.map((coin) => (
              <div
                key={coin.id}
                className="coin-float absolute font-black text-xl text-emerald-500 font-mono tracking-tight shrink-0 flex items-center space-x-0.5"
                style={{ transform: 'translateX(-50%)' }}
              >
                <span>🪙</span>
                <span>{coin.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cooldown labels row exactly matching reference sketch */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 font-semibold">
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${adCooldownLeft > 0 ? 'animate-spin text-amber-500' : 'text-emerald-500'}`} />
            <span>{t.cooldown}:</span>
            <span id="cooldown" className={`font-bold ${adCooldownLeft > 0 ? 'text-amber-500 font-mono' : 'text-emerald-500'}`}>
              {adCooldownLeft > 0 ? `${adCooldownLeft}s` : t.ready}
            </span>
          </div>
          <div className="w-px h-3 bg-slate-300"></div>
          <div>
            {t.adsWatchedToday}: <span className="font-bold text-slate-800">{stats.adsWatchedCount}/{maxAdsPerDay || 20}</span>
          </div>
        </div>
        {adMsg && (
          <p className="mt-2 text-[11px] text-center text-amber-600 font-semibold px-3 leading-snug">{adMsg}</p>
        )}
      </div>

      {/* 3. Dual Stats Grid (exactly matching sketch metadata counts) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Views Feature Card */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 hover:shadow transition">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100">
              <Eye className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-slate-400">{t.totalViews}</span>
          </div>
          <div className="text-xl font-extrabold text-slate-800">{stats.adsWatchedCount} {t.ads}</div>
          <div className="text-[10px] font-bold text-emerald-500 mt-0.5 uppercase tracking-wide">
            {t.verifiedS2SPlays}
          </div>
        </div>

        {/* Referrals Feature Card */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 hover:shadow transition">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100">
              <Users className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-slate-400">{t.referrals}</span>
          </div>
          <div className="text-xl font-extrabold text-slate-800">{stats.referralCount} {t.friends}</div>
          <div className="text-[10px] font-bold text-emerald-500 mt-0.5 uppercase tracking-wide">
            +{Math.round(stats.referralEarnings * appConfig.usdToCoinRate)} {appConfig.currencySymbol} {t.earned}
          </div>
        </div>
      </div>

      {/* Streak calendar */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4.5">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <div className="font-extrabold text-slate-800 text-sm">
              {language === 'en' ? 'Daily Streak' : 'Ежедневная серия'}
            </div>
            <div className="text-[11px] text-slate-400">
              {language === 'en' ? 'Watch ads to keep your multiplier alive' : 'Смотрите рекламу, чтобы сохранить буст'}
            </div>
          </div>
          <span className="bg-amber-50 text-amber-800 border border-amber-100 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            🔥 {streakDays >= 3 ? (language === 'en' ? 'ON FIRE' : 'В ОГНЕ') : `${streakDays} ${language === 'en' ? 'DAY' : 'ДН'}`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          {(streakWeek && streakWeek.length ? streakWeek : Array.from({ length: 7 }, () => ({ dow: '·', done: false }))).map((d, idx) => (
            <div
              key={idx}
              title={d.done ? (language === 'en' ? 'Checked in' : 'Отметка') : (language === 'en' ? 'Missed' : 'Пропущено')}
              className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-[10px] font-extrabold transition-all duration-300 ${
                d.done
                  ? 'bg-emerald-500 text-white shadow shadow-emerald-500/10'
                  : 'bg-slate-50 text-slate-400 border border-slate-200/40'
              }`}
            >
              {d.dow}
            </div>
          ))}
        </div>
      </div>

      {/* Lucky Spin Feature */}
      <LuckySpin onSpin={onSpin} initialCooldownLeft={spinCooldownLeft} />

      {/* 5. Daily Missions List Preview */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <div className="font-extrabold text-sm text-slate-800">{t.todaysMissions}</div>
          <button 
            onClick={() => onNavigateTab('tasks')}
            aria-label="See all missions"
            className="text-xs font-bold text-emerald-600 hover:underline px-1.5 py-1 -my-1 rounded"
          >
            {t.seeAll}
          </button>
        </div>

        <div className="space-y-2.5">
          {/* Mission 1: Watch 10 ads */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800 text-xs">{t.watch10Ads}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" 
                    style={{ width: `${Math.min((stats.adsWatchedCount / 10) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-[9px] font-bold text-slate-400 font-mono">
                  {stats.adsWatchedCount}/10
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">{t.reward}</div>
              <div className="font-extrabold text-xs text-emerald-600">+{Math.round(appConfig.watch10AdsReward * appConfig.usdToCoinRate)} {appConfig.currencySymbol}</div>
            </div>
          </div>

          {/* Mission 2: Join Telegram Channel */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-800 text-xs">{t.joinTelegramChannel}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t.instantOneTimeCoinBonus}</div>
            </div>
            {joinedTelegram ? (
              <span className="text-[10px] font-bold text-slate-400 flex items-center">
                <Check className="w-3.5 h-3.5 text-emerald-500 mr-0.5 stroke-[3]" /> {t.done}
              </span>
            ) : (
              <button
                onClick={onJoinTelegram}
                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg transition"
              >
                +{Math.round(appConfig.joinTelegramReward * appConfig.usdToCoinRate)}
              </button>
            )}
          </div>

          {/* Mission 3: Invite 3 Friends */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Gift className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800 text-xs">
                {language === 'en' ? 'Invite 3 Friends' : 'Пригласите 3 друзей'}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" 
                    style={{ width: `${Math.min((stats.referralCount / 3) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-[9px] font-bold text-slate-400 font-mono">
                  {stats.referralCount}/3
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">{t.reward}</div>
              <div className="font-extrabold text-xs text-emerald-600">+300 {appConfig.currencySymbol}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Referral banner widget */}
      <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-sm relative overflow-hidden flex items-center gap-3">
        <div className="absolute right-0 top-0 w-24 h-24 opacity-15 bg-radial from-emerald-500 to-transparent pointer-events-none"></div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600 shrink-0">
          <Users className="w-5.5 h-5.5" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-slate-800 text-sm">{t.earn10Forever}</div>
          <div className="text-[11px] text-slate-400">{t.fromEveryAdView}</div>
        </div>
        <button 
          onClick={() => onNavigateTab('friends')}
          aria-label="Invite friends"
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition shrink-0 shadow shadow-emerald-500/10"
        >
          {t.invite}
        </button>
      </div>

      {/* 7. Recent Transactions (Activity log ledger) */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5 text-slate-500 text-[10px] font-black uppercase tracking-wider font-mono">
          <span>{t.recentActivity}</span>
          <span>{t.history}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative">
          {watchHistory.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs font-semibold">
              {t.noTransactionsRecorded}
            </div>
          ) : (
            <div className="relative border-l border-slate-100 ml-3.5 pl-5 space-y-4 py-1">
              {watchHistory.slice(0, 4).map((log) => {
                const isPayout = log.reward < 0;
                return (
                  <div key={log.id} className="relative flex items-center justify-between gap-3 text-left">
                    {/* Timeline Node Point Dot */}
                    <div className={`absolute -left-[27px] w-3 h-3 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                      isPayout ? 'bg-rose-500' : 'bg-emerald-500'
                    }`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-xs truncate">{log.title}</div>
                      <div className="text-[9px] text-slate-400 font-medium mt-0.5 font-mono">
                        {log.timestamp ? log.timestamp.split('T')[0] : 'Today'} · confirmed
                      </div>
                    </div>
                    
                    <div className={`font-extrabold text-xs sm:text-sm font-mono shrink-0 ${isPayout ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isPayout ? '-' : '+'}{Math.abs(Math.round(log.reward * appConfig.usdToCoinRate))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 8. Withdrawal Progress CTA Card */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>{t.progressToWithdrawal}</span>
          <span className="text-slate-800">{acnBalance} / {Math.round(minWithdrawal * appConfig.usdToCoinRate)} {appConfig.currencySymbol}</span>
        </div>

        <div className="h-2 rounded-full bg-slate-100 relative overflow-hidden border border-slate-200/40">
          <div 
            className="progress-bar h-full rounded-full relative overflow-hidden" 
            style={{ width: `${withdrawProgress}%` }}
          >
            <div className="absolute inset-0 shine"></div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-400">
            {stats.balance >= minWithdrawal 
              ? t.cashoutThresholdReached
              : t.needMore.replace('{amount}', Math.round((minWithdrawal - stats.balance) * appConfig.usdToCoinRate).toString()).replace('{currency}', appConfig.currencySymbol)
            }
          </div>
          <button 
            onClick={() => onNavigateTab('wallet')}
            disabled={stats.balance < minWithdrawal}
            aria-label="Go to withdrawal"
            className={`text-xs font-black px-3.5 py-2.5 rounded-lg transition-all ${
              stats.balance >= minWithdrawal
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow shadow-emerald-500/10 cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t.withdraw}
          </button>
        </div>
      </div>

      {/* FAQs Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 px-1">
          <HelpCircle className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider font-mono">{t.frequentlyAskedQuestions}</h3>
        </div>

        <div className="space-y-2.5">
          {FAQ_ITEMS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div 
                key={index} 
                id={`faq-item-${index}`}
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 shadow-sm ${
                  isOpen ? 'border-emerald-500/30 ring-1 ring-emerald-500/5' : 'border-slate-200'
                }`}
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-label={`FAQ: ${faq.question}`}
                  className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-slate-50/50 transition cursor-pointer"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${faq.colorClass}`}>
                      {faq.category}
                    </span>
                    <h4 className="font-bold text-slate-800 text-xs leading-snug">
                      {faq.question}
                    </h4>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    {isOpen ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </button>

                <div 
                  className={`transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[200px] opacity-100 border-t border-slate-100' : 'max-h-0 opacity-0 pointer-events-none'
                  } overflow-hidden`}
                >
                  <p className="p-4 text-[11px] text-slate-500 leading-relaxed font-normal">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* ============ LIVE HIGH-FIDELITY AD OVERLAY ============== */}
      {/* ========================================================= */}
      {/* [DISABLED] old client-side fake ad overlay — replaced by the real Monetag
          interstitial opened from App.handleWatchAd. Kept as dead code (never renders). */}
      {false && activeCampaign && (isPlayingAd || isAdCompleted) && (
        <div className="ad-overlay fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-5 animate-in fade-in duration-200">
          
          {/* Main Ad Box */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 w-full max-w-xs space-y-4 relative overflow-hidden shadow-2xl">
            {/* Top countdown progress bar */}
            {isPlayingAd && (
              <div 
                className="absolute top-0 left-0 h-1 bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-1000" 
                style={{ width: `${adProgress}%` }}
              />
            )}

            <div className="flex justify-between items-start">
              <div>
                <span className="text-[8px] uppercase font-mono font-bold tracking-widest text-emerald-400">
                  {t.rewardedTask} • {activeCampaign.type.toUpperCase()}
                </span>
                <h3 className="text-xs font-bold text-white mt-0.5 leading-tight">{activeCampaign.title}</h3>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black text-emerald-400 font-mono">
                +{Math.round((monetagConfig.isEnabled ? activeCampaign.rewardAmount * 1.5 : activeCampaign.rewardAmount) * 1000)} ACN
              </div>
            </div>

            {/* Simulated Live Video / Playable Canvas Screen */}
            <div className="bg-slate-950 aspect-[16/10] rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden p-3 select-none">
              
              {/* Campaign Playing Content */}
              {isPlayingAd && (
                <div className="w-full h-full flex flex-col justify-between relative z-10 text-center">
                  
                  {/* 1. TON Wallet Interactive */}
                  {activeCampaign.id === 'camp_ton_quest' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center border border-sky-300 shadow animate-bounce">
                          <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 bg-sky-400 text-slate-900 text-[8px] font-black px-1 rounded-full border border-sky-100">TON</span>
                      </div>
                      <p className="text-[9px] text-slate-300 max-w-[200px] leading-tight">Link your Web3 wallet inside the sandbox!</p>
                      <button 
                        onClick={() => setTonWalletConnected(true)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition ${
                          tonWalletConnected 
                            ? 'bg-emerald-500 text-slate-950' 
                            : 'bg-sky-500 hover:bg-sky-400 text-white animate-pulse'
                        }`}
                      >
                        {tonWalletConnected ? '✓ Linked' : '🔗 Link TON Wallet'}
                      </button>
                    </div>
                  )}

                  {/* 2. Monetag pushzone info */}
                  {activeCampaign.id === 'camp_monetag_push' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                        <Shield className="w-5.5 h-5.5 animate-pulse" />
                      </div>
                      <div className="h-10 flex items-center justify-center">
                        {monetagStep === 0 && <span className="text-[10px] text-slate-300">High fill-rate direct redirect active.</span>}
                        {monetagStep === 1 && <span className="text-[10px] text-slate-300">Clean non-intrusive elements loaded.</span>}
                        {monetagStep === 2 && <span className="text-[10px] text-slate-300">Easy zone ID replacement script.</span>}
                        {monetagStep === 3 && <span className="text-[10px] text-emerald-400 font-extrabold">CPM boost enabled: +50%!</span>}
                      </div>
                    </div>
                  )}

                  {/* 3. Tapper Mini Game playable */}
                  {activeCampaign.id === 'camp_crypto_clicker' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-1.5 relative">
                      <div className="absolute top-0 right-0 bg-white/5 border border-white/5 px-1.5 py-0.2 rounded text-[8px] font-mono text-amber-400">
                        Coins Tapped: {clickerCount}
                      </div>
                      <p className="text-[8px] text-slate-400">Tap coin to test advertiser click postbacks!</p>
                      <button 
                        onClick={handleInteractiveTap}
                        className="w-14 h-14 bg-gradient-to-tr from-amber-400 to-yellow-500 rounded-full border-2 border-amber-300 flex items-center justify-center text-xl active:scale-90 transition-transform relative outline-none focus:outline-none cursor-pointer"
                      >
                        🪙
                        {clickParticles.map((p) => (
                          <span 
                            key={p.id}
                            className="absolute text-[10px] font-black font-mono text-amber-300 pointer-events-none animate-out fade-out slide-out-to-top-6 duration-500"
                            style={{ left: p.x - 5, top: p.y - 12 }}
                          >
                            +1
                          </span>
                        ))}
                      </button>
                    </div>
                  )}

                  {/* 4. Spinner playable */}
                  {activeCampaign.id === 'camp_spin_win' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-1.5">
                      <p className="text-[8px] text-slate-400 leading-none">{t.spinTheWheel}</p>
                      <div className="relative">
                        <div 
                          className="w-12 h-12 rounded-full border-2 border-purple-500 bg-slate-900 flex items-center justify-center font-bold text-[8px] shadow transition-transform duration-[3000ms] ease-out"
                          style={{ transform: `rotate(${wheelRotation}deg)` }}
                        >
                          ⭐
                        </div>
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rotate-45" />
                      </div>
                      <button 
                        onClick={handleSpinWheel}
                        className="px-2.5 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[8px] font-black uppercase tracking-wider transition"
                      >
                        {t.spin}
                      </button>
                    </div>
                  )}

                  {/* 5. Stars tribute */}
                  {activeCampaign.id === 'camp_durov_tribute' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-yellow-500/30 flex items-center justify-center shadow animate-pulse">
                        <Star className="w-6 h-6 text-yellow-400 fill-current" />
                      </div>
                      <p className="text-[9px] text-slate-300 max-w-[190px] leading-tight">{t.decentralizedStarsSystem}</p>
                    </div>
                  )}

                  {/* Progress bar info */}
                  <div className="flex justify-between items-center text-[8px] text-slate-500 font-mono border-t border-white/5 pt-1">
                    <span>Publisher: {activeCampaign.advertiserName}</span>
                    <div className="flex items-center space-x-1 text-emerald-400 font-bold">
                      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                      <span>{adTimeLeft}s</span>
                    </div>
                  </div>

                </div>
              )}

              {/* Math CAPTCHA verification to claim coins */}
              {isAdCompleted && (
                <div className="text-center w-full space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="w-10 h-10 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                    <Check className="w-5.5 h-5.5 text-emerald-400 stroke-[3]" />
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-bold text-white">{t.adFinished}!</h4>
                    <p className="text-[9px] text-slate-400 leading-tight">{t.completeSimpleCalculation}</p>
                  </div>

                  <form onSubmit={handleCaptchaSubmit} className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5 font-mono">
                        {captchaAnswer - 3} + 3 = ?
                      </span>
                      <input
                        type="number"
                        value={userCaptcha}
                        onChange={(e) => setUserCaptcha(e.target.value)}
                        placeholder="Ans"
                        className="w-16 text-center bg-slate-900 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono font-bold"
                        required
                        autoFocus
                      />
                    </div>
                    {captchaError && (
                      <p className="text-[8px] text-rose-400 font-bold">{t.incorrectCalculation}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-emerald-400 to-green-500 text-slate-950 font-black py-2 rounded-xl text-[10px] uppercase tracking-wider hover:opacity-90 active:scale-95 shadow cursor-pointer"
                    >
                      {t.verifyAndClaim}
                    </button>
                  </form>
                </div>
              )}

            </div>

            {/* Cancel/Skip trigger */}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => {
                  setActiveCampaign(null);
                  setIsPlayingAd(false);
                  setIsAdCompleted(false);
                }}
                className="text-slate-500 hover:text-slate-300 text-[10px] font-bold py-1 px-3 hover:bg-white/5 rounded-lg transition"
              >
                {t.skipTask}
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
