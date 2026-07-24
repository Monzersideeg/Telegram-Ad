/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { TrendingUp, Users } from 'lucide-react';
import { ReferredFriend } from '../types';

interface ReferralChartProps {
  friends: ReferredFriend[];
}

/**
 * Lightweight, dependency-free 30-day signups chart. The previous implementation
 * pulled in `recharts` (a very heavy library) which caused jank / freezes and could
 * white-screen the Friends tab on low-end devices. This renders real referral counts
 * with plain CSS bars — no charting dependency.
 */
export const ReferralChart: React.FC<ReferralChartProps> = ({ friends }) => {
  const chartData = useMemo(() => {
    const data: { date: string; label: string; signups: number; isToday: boolean }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const signups = friends.filter((f) => f.joinDate === dateStr).length;
      data.push({ date: dateStr, label, signups, isToday: i === 0 });
    }
    return data;
  }, [friends]);

  const total = useMemo(() => chartData.reduce((a, c) => a + c.signups, 0), [chartData]);
  const peak = useMemo(() => Math.max(1, ...chartData.map((d) => d.signups)), [chartData]);
  const avg = (total / 30).toFixed(1);

  return (
    <div id="referrals-chart-card" className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <span className="truncate">Signups Trend</span>
              <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">30 Days</span>
            </h4>
            <p className="text-[9px] text-slate-400 truncate">Real new referrals per day</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[8px] font-mono text-slate-400">TOTAL</span>
          <div className="text-[10px] font-extrabold text-slate-800 flex items-center gap-0.5 justify-end">
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span>+{total}</span>
          </div>
        </div>
      </div>

      {/* Pure-CSS bar chart */}
      <div className="flex items-end gap-[2px] h-24 pt-2">
        {chartData.map((d) => (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center justify-end h-full"
            title={`${d.label}: ${d.signups} signup(s)`}
          >
            <div
              className={`w-full rounded-t-sm ${d.isToday ? 'bg-emerald-500' : 'bg-emerald-300'}`}
              style={{ height: `${Math.max(d.signups > 0 ? 10 : 3, (d.signups / peak) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-slate-400 font-mono px-0.5">
        <span>{chartData[0]?.label}</span>
        <span>{chartData[15]?.label}</span>
        <span>{chartData[29]?.label}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
        <div className="text-center">
          <div className="text-[8px] text-slate-400 uppercase font-bold">Total</div>
          <div className="text-sm font-extrabold text-slate-800">{total}</div>
        </div>
        <div className="text-center">
          <div className="text-[8px] text-slate-400 uppercase font-bold">Daily avg</div>
          <div className="text-sm font-extrabold text-emerald-600">{avg}</div>
        </div>
        <div className="text-center">
          <div className="text-[8px] text-slate-400 uppercase font-bold">Peak day</div>
          <div className="text-sm font-extrabold text-amber-600">{peak}</div>
        </div>
      </div>
    </div>
  );
};
