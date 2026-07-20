/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Users, MessageSquare, Award, CheckCircle, Sparkles, Flame, Check } from 'lucide-react';
import { UserStats, AppConfig } from '../types';
import { translations } from '../utils/translations';

interface TasksProps {
  stats: UserStats;
  joinedTelegram: boolean;
  onJoinTelegram: () => void;
  claimedWatch10: boolean;
  onClaimWatch10: () => void;
  claimedInvite3: boolean;
  onClaimInvite3: () => void;
  onNavigateTab: (tab: string) => void;
  appConfig: AppConfig;
  language: 'en' | 'ru';
}

export const Tasks: React.FC<TasksProps> = ({
  stats,
  joinedTelegram,
  onJoinTelegram,
  claimedWatch10,
  onClaimWatch10,
  claimedInvite3,
  onClaimInvite3,
  onNavigateTab,
  appConfig,
  language,
}) => {
  const t = translations[language] || translations.en;

  // Goal parameters
  const watchGoal = 10;
  const inviteGoal = 3;

  const watchProgress = Math.min((stats.adsWatchedCount / watchGoal) * 100, 100);
  const inviteProgress = Math.min((stats.referralCount / inviteGoal) * 100, 100);

  // Dynamic Rewards from config
  const watchRewardCoins = Math.round(appConfig.watch10AdsReward * appConfig.usdToCoinRate);
  const joinRewardCoins = Math.round(appConfig.joinTelegramReward * appConfig.usdToCoinRate);
  const inviteRewardCoins = Math.round(appConfig.invite3FriendsReward * appConfig.usdToCoinRate);

  return (
    <div id="tasks-view" className="space-y-4 px-5 pb-24 pt-3">
      {/* Task Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t.todaysMissions}</h2>
          <p className="text-xs text-slate-500">{t.completeTasksDaily}</p>
        </div>
        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center font-mono">
          <Flame className="w-3.5 h-3.5 mr-0.5 fill-current text-emerald-500" /> {t.bonusXp}
        </span>
      </div>

      {/* Missions List */}
      <div className="space-y-3">
        
        {/* Mission 1: Watch 10 Ads */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:shadow transition">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
            <Play className="w-5.5 h-5.5 fill-current" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-sm">{t.watch10Ads}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.watchRealRewardedPlacements}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-emerald-500 to-green-400" 
                  style={{ width: `${watchProgress}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                {stats.adsWatchedCount}/{watchGoal}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{t.reward}</div>
            <div className="font-extrabold text-sm text-emerald-600">+{watchRewardCoins} {appConfig.currencySymbol}</div>
            
            {claimedWatch10 ? (
              <span className="inline-flex items-center text-[10px] text-slate-400 font-bold mt-1">
                <Check className="w-3 h-3 mr-0.5 text-emerald-500 stroke-[3]" /> {t.claimed}
              </span>
            ) : stats.adsWatchedCount >= watchGoal ? (
              <button
                onClick={onClaimWatch10}
                aria-label={`Claim reward: watch ${watchGoal} ads`}
                className="mt-1.5 px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-lg transition shadow"
              >
                {t.claim}
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab('home')}
                aria-label="Go to the Earn tab to watch ads"
                className="mt-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition"
              >
                {t.go}
              </button>
            )}
          </div>
        </div>

        {/* Mission 2: Join Telegram Channel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:shadow transition">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
            <MessageSquare className="w-5.5 h-5.5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-slate-800 text-sm">{t.joinTelegramChannel}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.oneTimeChannelJoinBonus}</p>
            <span className="text-[10px] bg-sky-50 text-sky-700 font-bold px-1.5 py-0.5 rounded font-mono mt-1 inline-block">
              @AdCoinEarnChannel
            </span>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{t.reward}</div>
            <div className="font-extrabold text-sm text-emerald-600">+{joinRewardCoins} {appConfig.currencySymbol}</div>
            
            {joinedTelegram ? (
              <span className="inline-flex items-center text-[10px] text-slate-400 font-bold mt-1">
                <Check className="w-3 h-3 mr-0.5 text-emerald-500 stroke-[3]" /> {t.claimed}
              </span>
            ) : (
              <button
                onClick={onJoinTelegram}
                aria-label={`Claim reward: join Telegram channel (+${joinRewardCoins} ${appConfig.currencySymbol})`}
                className="mt-1.5 px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-lg transition shadow"
              >
                +{joinRewardCoins}
              </button>
            )}
          </div>
        </div>

        {/* Mission 3: Invite 3 Friends */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:shadow transition">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
            <Users className="w-5.5 h-5.5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-sm">{t.invite3Friends}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.expandPassiveReferralPool}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-emerald-500 to-green-400" 
                  style={{ width: `${inviteProgress}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                {stats.referralCount}/{inviteGoal}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{t.reward}</div>
            <div className="font-extrabold text-sm text-emerald-600">+{inviteRewardCoins} {appConfig.currencySymbol}</div>
            
            {claimedInvite3 ? (
              <span className="inline-flex items-center text-[10px] text-slate-400 font-bold mt-1">
                <Check className="w-3 h-3 mr-0.5 text-emerald-500 stroke-[3]" /> {t.claimed}
              </span>
            ) : stats.referralCount >= inviteGoal ? (
              <button
                onClick={onClaimInvite3}
                aria-label={`Claim reward: invite ${inviteGoal} friends`}
                className="mt-1.5 px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-lg transition shadow"
              >
                {t.claim}
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab('friends')}
                aria-label="Go to the Friends tab to invite people"
                className="mt-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition"
              >
                {t.go}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Explanatory notes */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
          <Award className="w-4 h-4 text-emerald-500" />
          <span>{t.howDailyMissionsWork}</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed font-light">
          {t.dailyMissionsReset}
        </p>
      </div>
    </div>
  );
};
