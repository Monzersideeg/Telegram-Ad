/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { TrendingUp, Users, Award, Calendar } from 'lucide-react';
import { ReferredFriend } from '../types';

interface ReferralChartProps {
  friends: ReferredFriend[];
}

export const ReferralChart: React.FC<ReferralChartProps> = ({ friends }) => {
  // Generate the last 30 days of data ending today
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`; // Format YYYY-MM-DD
      
      // Format readable label e.g., "Jul 16"
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Real signups only — friends who actually joined on this day (no synthetic data).
      const realCount = friends.filter(f => f.joinDate === dateStr).length;
      const isToday = i === 0;

      data.push({
        date: dateStr,
        label,
        signups: realCount,
        realSignups: realCount,
        isToday,
      });
    }
    
    return data;
  }, [friends]);

  // Compute stats based on the 30-day window
  const totalSignups = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.signups, 0);
  }, [chartData]);

  const peakSignups = useMemo(() => {
    return Math.max(...chartData.map(d => d.signups), 1);
  }, [chartData]);

  const avgSignups = useMemo(() => {
    return (totalSignups / 30).toFixed(1);
  }, [totalSignups]);

  // Custom Tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-xl text-[10px] font-mono border border-slate-800 shadow-md">
          <div className="font-bold border-b border-slate-800 pb-1 mb-1">{data.label} {data.isToday ? "(Today)" : ""}</div>
          <div className="text-emerald-400 font-bold">Total: {data.signups} signups</div>
          {data.realSignups > 0 && (
            <div className="text-amber-400 text-[9px] mt-0.5">👥 Direct: +{data.realSignups} user(s)</div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="referrals-chart-card" className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-3.5">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <span>Signups Trend</span>
              <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">30 Days</span>
            </h4>
            <p className="text-[9px] text-slate-400">Chronological analysis of new user signups</p>
          </div>
        </div>
        
        <div className="text-right">
          <span className="text-[8px] font-mono text-slate-400">GROWTH VELOCITY</span>
          <div className="text-[10px] font-extrabold text-slate-800 flex items-center gap-0.5 justify-end">
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span>+{totalSignups} net</span>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="h-[110px] w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="label" 
              tickLine={false} 
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 500 }}
              // Only show every 6th tick to prevent overlapping
              interval={6}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 500 }}
              allowDecimals={false}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="signups" 
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorSignups)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100">
        <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-1.5 text-center">
          <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Total Registrations</span>
          <div className="text-xs font-black text-slate-800 font-mono mt-0.5">{totalSignups} users</div>
        </div>

        <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-1.5 text-center">
          <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Daily Average</span>
          <div className="text-xs font-black text-emerald-600 font-mono mt-0.5">{avgSignups}/day</div>
        </div>

        <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-1.5 text-center">
          <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Peak Signup Spike</span>
          <div className="text-xs font-black text-amber-600 font-mono mt-0.5">{peakSignups} users</div>
        </div>
      </div>
    </div>
  );
};
