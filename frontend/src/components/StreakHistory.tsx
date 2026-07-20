/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine 
} from 'recharts';
import { Flame, Sparkles, TrendingUp, Award, Calendar } from 'lucide-react';
import { UserStats } from '../types';

interface StreakHistoryProps {
  stats: UserStats;
  streak: number;
}

export const StreakHistory: React.FC<StreakHistoryProps> = ({ stats, streak }) => {
  // Days of the week starting from Monday
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Current date details
  const today = new Date();
  const dayOfWeekIndex = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Convert Sunday (0) to 6, and Monday (1) to 0, etc.
  const currentDayIndex = dayOfWeekIndex === 0 ? 6 : dayOfWeekIndex - 1;

  // Stable seed-based historical values for past days so they don't jump on every state update
  const weeklyData = useMemo(() => {
    // Standard baseline mock data for past days in the week
    const baselinePastDays = [14, 18, 11, 15, 12, 16, 13];
    
    return daysOfWeek.map((day, idx) => {
      let count = 0;
      let isToday = idx === currentDayIndex;
      let isFuture = idx > currentDayIndex;
      
      if (isToday) {
        count = stats.adsWatchedCount;
      } else if (isFuture) {
        count = 0;
      } else {
        // For past days, we assign baseline counts, but make sure they match the streak
        // If streak is short (e.g. 1 day), earlier days in the week might have been inactive (0 views)
        const daysAgo = currentDayIndex - idx;
        if (daysAgo >= streak) {
          count = 0; // Missed check-in
        } else {
          count = baselinePastDays[idx % baselinePastDays.length];
        }
      }

      return {
        name: day,
        views: count,
        isToday,
        isFuture,
        // Day target is 10 ads for the mission bonus
        target: 10,
      };
    });
  }, [stats.adsWatchedCount, currentDayIndex, streak]);

  // Calculate consistency stats
  const totalViewsThisWeek = useMemo(() => {
    return weeklyData.reduce((acc, curr) => acc + curr.views, 0);
  }, [weeklyData]);

  const activeDaysCount = useMemo(() => {
    return weeklyData.filter(d => d.views > 0).length;
  }, [weeklyData]);

  const consistencyPercentage = useMemo(() => {
    // Max days up to today
    const possibleDays = currentDayIndex + 1;
    if (possibleDays === 0) return 0;
    const completedDays = weeklyData.slice(0, possibleDays).filter(d => d.views >= 10).length;
    return Math.round((completedDays / possibleDays) * 100);
  }, [weeklyData, currentDayIndex]);

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-2 rounded-xl text-[10px] font-mono border border-slate-800 shadow-md">
          <div className="font-bold">{data.isToday ? "Today" : data.name}</div>
          <div className="text-emerald-400 mt-0.5">Ad Views: {data.views}</div>
          <div className="text-slate-400">Target: {data.target}</div>
          {data.views >= data.target ? (
            <div className="text-amber-400 font-bold mt-0.5">⭐ Target Achieved!</div>
          ) : data.isToday ? (
            <div className="text-rose-400 font-bold mt-0.5">⚡ {data.target - data.views} more to go</div>
          ) : !data.isFuture ? (
            <div className="text-slate-500 mt-0.5">Target missed</div>
          ) : (
            <div className="text-slate-500 mt-0.5">Locked</div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="streak-history-card" className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-3.5">
      
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <span>Weekly Consistency</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </h4>
            <p className="text-[9px] text-slate-400">Your daily ad-watching consistency stats</p>
          </div>
        </div>
        
        {/* Streak indicator pill */}
        <div className="bg-amber-50 border border-amber-100 rounded-full px-2.5 py-0.5 flex items-center space-x-1">
          <Flame className="w-3.5 h-3.5 text-amber-500 fill-current animate-bounce" />
          <span className="text-[10px] font-black font-mono text-amber-700">{streak}d Streak</span>
        </div>
      </div>

      {/* Main Bar Chart Visualization */}
      <div className="h-[120px] w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <XAxis 
              dataKey="name" 
              tickLine={false} 
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 600 }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.04)' }} />
            
            {/* Target threshold line (10 ads) */}
            <ReferenceLine 
              y={10} 
              stroke="#fbbf24" 
              strokeDasharray="3 3" 
              strokeWidth={1}
              label={{ 
                value: 'Target', 
                position: 'right', 
                fill: '#d97706', 
                fontSize: 7, 
                fontWeight: 700 
              }} 
            />

            <Bar 
              dataKey="views" 
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            >
              {weeklyData.map((entry, index) => {
                let fill = '#e2e8f0'; // Future/inactive days
                
                if (!entry.isFuture) {
                  if (entry.views >= entry.target) {
                    // Reached target
                    fill = entry.isToday ? 'url(#activeTodayGradient)' : '#10b981';
                  } else {
                    // Under target but active
                    fill = entry.isToday ? '#34d399' : '#86efac';
                  }
                  
                  if (entry.views === 0) {
                    fill = '#cbd5e1'; // Missed check-in / inactive day
                  }
                }

                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={fill}
                    className={entry.isToday ? 'stroke-emerald-600 stroke-1' : ''}
                  />
                );
              })}
            </Bar>
            
            {/* Gradients declaration */}
            <defs>
              <linearGradient id="activeTodayGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Stat Badges Footer */}
      <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
        <div className="bg-slate-50 border border-slate-150 rounded-xl p-1.5 text-center">
          <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Consistency</span>
          <div className="text-xs font-black text-slate-800 font-mono mt-0.5">{consistencyPercentage}%</div>
        </div>

        <div className="bg-slate-50 border border-slate-150 rounded-xl p-1.5 text-center">
          <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Total Ads</span>
          <div className="text-xs font-black text-emerald-600 font-mono mt-0.5">{totalViewsThisWeek} ACN</div>
        </div>

        <div className="bg-slate-50 border border-slate-150 rounded-xl p-1.5 text-center">
          <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Active Days</span>
          <div className="text-xs font-black text-amber-600 font-mono mt-0.5">{activeDaysCount}/7</div>
        </div>
      </div>
    </div>
  );
};
