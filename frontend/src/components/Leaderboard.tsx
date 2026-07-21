/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Award, Search, Trophy, TrendingUp, Sparkles, User, 
  Flame, Medal, ShieldCheck, Users, Coins 
} from 'lucide-react';
import { LeaderboardUser } from '../types';

interface LeaderboardProps {
  users: LeaderboardUser[];
  currentUserStats: { 
    balance: number; 
    adsCount: number;
    referralCount: number;
    activeReferralCount: number;
    rank?: number;
  };
  telegramUser: { username: string; fullName: string };
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  users,
  currentUserStats,
  telegramUser,
}) => {
  const [activeTab, setActiveTab] = useState<'earners' | 'referrers' | 'inviters'>('earners');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort candidates dynamically and calculate rank positions
  const rankedList = React.useMemo(() => {
    let sorted = [...users];
    if (activeTab === 'earners') {
      sorted.sort((a, b) => b.totalEarned - a.totalEarned);
    } else if (activeTab === 'referrers') {
      sorted.sort((a, b) => b.referralCount - a.referralCount);
    } else {
      sorted.sort((a, b) => b.activeReferralCount - a.activeReferralCount);
    }
    return sorted.map((user, index) => ({
      ...user,
      computedRank: index + 1
    }));
  }, [users, activeTab]);

  // Filter list by search query
  const filteredList = rankedList.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Split top 3 for the beautiful visual podium and rest for list
  const podiumUsers = filteredList.slice(0, 3);
  const listUsers = filteredList.slice(3);

  // Position index mapping for standard podium: [2nd, 1st, 3rd]
  const renderPodiumOrder = () => {
    if (podiumUsers.length < 3) return podiumUsers;
    return [podiumUsers[1], podiumUsers[0], podiumUsers[2]];
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <span className="w-5.5 h-5.5 bg-amber-400 text-slate-900 rounded-full flex items-center justify-center font-black text-xs border border-amber-300 shadow">
            🥇
          </span>
        );
      case 2:
        return (
          <span className="w-5.5 h-5.5 bg-slate-200 text-slate-800 rounded-full flex items-center justify-center font-black text-xs border border-slate-300 shadow">
            🥈
          </span>
        );
      case 3:
        return (
          <span className="w-5.5 h-5.5 bg-amber-600 text-white rounded-full flex items-center justify-center font-black text-xs border border-amber-500 shadow">
            🥉
          </span>
        );
      default:
        return (
          <span className="text-slate-400 font-mono text-[10px] font-bold">
            #{rank.toString().padStart(2, '0')}
          </span>
        );
    }
  };

  // Compute dynamic user status rank details based on active tab
  const userRankDetails = React.useMemo(() => {
    const me =
      rankedList.find((u) => u.isCurrentUser) ||
      rankedList.find((u) => u.username === telegramUser.username);
    const rank = me ? me.computedRank : currentUserStats.rank || 0;
    const rankStr = rank ? `#${rank}` : '—';
    if (activeTab === 'earners') {
      return {
        rank: rankStr,
        score: `${Math.round(currentUserStats.balance * 1000).toLocaleString()} ACN`,
        label: 'Global earners rank',
      };
    } else if (activeTab === 'referrers') {
      return {
        rank: rankStr,
        score: `${currentUserStats.referralCount} referrals`,
        label: 'Ranked by referrals',
      };
    } else {
      return {
        rank: rankStr,
        score: `${currentUserStats.activeReferralCount} active refs`,
        label: 'Ranked by active referrals',
      };
    }
  }, [activeTab, currentUserStats, rankedList, telegramUser.username]);

  return (
    <div id="leaderboard-view" className="scroll-area flex-1 overflow-y-auto pb-28 px-5 pt-3 space-y-4">
      
      {/* Dynamic Arena Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4.5 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center space-x-3.5 relative">
          <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center shrink-0 shadow shadow-emerald-500/5 animate-pulse">
            <Trophy className="w-5.5 h-5.5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <span>Ecosystem Arena Champions</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </h2>
            <p className="text-[10px] text-slate-400 leading-relaxed font-light mt-0.5">
              Compete with global users. The top 3 weekly active earners automatically receive a permanent <strong>1.5x reward boost</strong>!
            </p>
          </div>
        </div>
      </div>

      {/* Modern Tabs Toggle (Earners vs Referrers vs Inviters) */}
      <div role="tablist" aria-label="Leaderboard categories" className="p-1 bg-white border border-slate-200 rounded-2xl flex shadow-sm gap-0.5">
        <button
          role="tab"
          aria-selected={activeTab === 'earners'}
          aria-label="Top earners"
          onClick={() => {
            setActiveTab('earners');
            setSearchQuery('');
          }}
          className={`flex-1 py-2.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            activeTab === 'earners'
              ? 'bg-emerald-500 text-white shadow-sm font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Coins className="w-3 h-3" aria-hidden="true" />
          <span>Earners</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'referrers'}
          aria-label="Top referrers"
          onClick={() => {
            setActiveTab('referrers');
            setSearchQuery('');
          }}
          className={`flex-1 py-2.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            activeTab === 'referrers'
              ? 'bg-emerald-500 text-white shadow-sm font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Users className="w-3 h-3" aria-hidden="true" />
          <span>Referrers</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'inviters'}
          aria-label="Top inviters"
          onClick={() => {
            setActiveTab('inviters');
            setSearchQuery('');
          }}
          className={`flex-1 py-2.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            activeTab === 'inviters'
              ? 'bg-emerald-500 text-white shadow-sm font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Award className="w-3 h-3" aria-hidden="true" />
          <span>Inviters</span>
        </button>
      </div>

      {/* Elegant 3D Podium Display for Top 3 */}
      {filteredList.length >= 3 && searchQuery === '' && (
        <div className="pt-2 pb-1.5 flex items-end justify-center space-x-2.5 px-1">
          {renderPodiumOrder().map((user) => {
            const isFirst = user.computedRank === 1;
            const isSecond = user.computedRank === 2;
            const isThird = user.computedRank === 3;

            return (
              <div 
                key={user.username}
                className="flex flex-col items-center flex-1 transition-all duration-300"
              >
                {/* Profile Avatar and Badges */}
                <div className="relative mb-2">
                  <div className={`rounded-full flex items-center justify-center relative shadow ${
                    isFirst 
                      ? 'w-13 h-13 bg-gradient-to-tr from-amber-400 to-yellow-500 ring-2 ring-yellow-300 p-0.5' 
                      : isSecond
                      ? 'w-10 h-10 bg-gradient-to-tr from-slate-200 to-slate-300 ring-1 ring-slate-200'
                      : 'w-10 h-10 bg-gradient-to-tr from-amber-600 to-amber-700 ring-1 ring-amber-500'
                  }`}>
                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-extrabold text-slate-800 text-xs">
                      {user.fullName.split(' ').map(n => n[0]).join('')}
                    </div>
                  </div>
                  
                  {/* Position Badge Overlay */}
                  {isFirst && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-base">👑</span>
                  )}
                  <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black font-mono px-1.5 py-0.2 rounded-full border shadow ${
                    isFirst 
                      ? 'bg-yellow-400 text-slate-950 border-yellow-200' 
                      : isSecond
                      ? 'bg-slate-200 text-slate-800 border-slate-300'
                      : 'bg-amber-600 text-white border-amber-500'
                  }`}>
                    {user.computedRank}
                  </span>
                </div>

                {/* Name details */}
                <div className="text-center w-full px-1">
                  <div className="text-[10px] font-extrabold text-slate-800 truncate max-w-[80px] mx-auto">
                    {user.fullName.split(' ')[0]}
                  </div>
                  <div className="text-[8px] text-slate-400 font-mono truncate max-w-[80px] mx-auto">
                    @{user.username}
                  </div>
                </div>

                {/* 3D Glass Podium Block */}
                <div className={`w-full mt-2 rounded-t-2xl border border-slate-200 flex flex-col items-center justify-center p-2 relative overflow-hidden bg-white/80 shadow-sm ${
                  isFirst 
                    ? 'h-24 border-b-2 border-b-amber-400' 
                    : isSecond
                    ? 'h-18 border-b-2 border-b-slate-300'
                    : 'h-14 border-b-2 border-b-amber-600'
                }`}>
                  <div className="text-center">
                    {activeTab === 'earners' ? (
                      <>
                        <span className="text-[10px] font-mono font-extrabold text-emerald-600">
                          {Math.round(user.totalEarned * 1000).toLocaleString()}
                        </span>
                        <div className="text-[8px] text-slate-400 font-mono">
                          {user.referralCount} refs
                        </div>
                      </>
                    ) : activeTab === 'referrers' ? (
                      <>
                        <span className="text-[10px] font-mono font-extrabold text-indigo-600">
                          {user.referralCount} refs
                        </span>
                        <div className="text-[8px] text-slate-400 font-mono">
                          {user.activeReferralCount} active
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-mono font-extrabold text-purple-600">
                          {user.activeReferralCount} active
                        </span>
                        <div className="text-[8px] text-slate-400 font-mono">
                          {user.referralCount} total
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Search Input bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search the leaderboard"
          placeholder={`Search ${
            activeTab === 'earners' ? 'global earners' : 
            activeTab === 'referrers' ? 'referrals list' : 'active inviters'
          }...`}
          className="w-full text-sm bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-slate-800 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500/50"
        />
      </div>

      {/* User's current rank snippet */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-extrabold text-xs shadow-sm">
            {userRankDetails.rank}
          </div>
          <div>
            <span className="text-[8px] text-emerald-600 uppercase tracking-widest font-black font-mono">Your Rank</span>
            <div className="text-xs font-bold text-slate-800">@{telegramUser.username} (You)</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono font-extrabold text-emerald-600">
            {userRankDetails.score}
          </div>
          <span className="text-[9px] text-slate-400 font-bold font-mono">{userRankDetails.label}</span>
        </div>
      </div>

      {/* Leaderboard user rows list */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-slate-400 text-[9px] uppercase font-bold tracking-widest font-mono">
          <span>Rank & Username</span>
          <span>{
            activeTab === 'earners' ? 'Earned (ACN)' :
            activeTab === 'referrers' ? 'Referrals' : 'Active Referrals'
          }</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
          {(searchQuery !== '' ? filteredList : rankedList).length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <User className="w-10 h-10 text-slate-300 mx-auto opacity-40 mb-2" />
              <div className="text-xs font-semibold">No creators found</div>
              <p className="text-[10px] text-slate-400">Try refining search parameters.</p>
            </div>
          ) : (
            (searchQuery !== '' ? filteredList : rankedList).map((user) => {
              return (
                <div
                  key={user.username}
                  className={`p-3.5 flex items-center justify-between transition hover:bg-slate-50 ${
                    user.isCurrentUser ? 'bg-emerald-50/50 border-l-2 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className="w-6 shrink-0 flex justify-center">
                      {getRankBadge(user.computedRank)}
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-[11px] border border-slate-200 shrink-0">
                      {user.fullName.split(' ').map((n) => n[0]).join('')}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[125px]">
                          {user.fullName}
                        </span>
                        {user.referralCount >= 30 && (
                          <span className="text-[8px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-mono font-bold flex items-center">
                            <Flame className="w-2.5 h-2.5 mr-0.5 fill-current" /> PRO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">@{user.username}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {activeTab === 'earners' ? (
                      <>
                        <div className="text-xs font-mono font-extrabold text-slate-800">
                          {Math.round(user.totalEarned * 1000).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          {user.referralCount} referrals
                        </div>
                      </>
                    ) : activeTab === 'referrers' ? (
                      <>
                        <div className="text-xs font-mono font-extrabold text-slate-800">
                          {user.referralCount} refs
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          {user.activeReferralCount} active
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-mono font-extrabold text-slate-800">
                          {user.activeReferralCount} active
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          {user.referralCount} total refs
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Security Shield warning */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center space-x-2.5 text-slate-400">
        <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
        <div className="text-[10px] leading-relaxed text-slate-500 font-light">
          Ecosystem anti-cheat engines are running. Fraudulent click farms and automation tools will trigger automatic balance resets.
        </div>
      </div>
    </div>
  );
};
