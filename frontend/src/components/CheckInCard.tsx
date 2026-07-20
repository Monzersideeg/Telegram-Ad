import React from "react";
import { Flame, Gift, Check } from "lucide-react";

interface CheckInCardProps {
  streakDays: number;
  checkedInToday: boolean;
  reward: number; // coins
  currencySymbol: string;
  busy: boolean;
  onCheckIn: () => void;
}

/** Daily check-in card — claims a streak bonus from the backend (once per day). */
export const CheckInCard: React.FC<CheckInCardProps> = ({
  streakDays,
  checkedInToday,
  reward,
  currencySymbol,
  busy,
  onCheckIn,
}) => {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 flex items-center gap-3.5">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
        <Flame className="w-5 h-5 fill-current" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-slate-800 text-sm">Daily Check-In</div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          <span className="font-bold text-amber-600">{streakDays}-day streak</span> · claim your daily bonus
        </p>
      </div>
      <div className="text-right shrink-0">
        {checkedInToday ? (
          <span className="inline-flex items-center text-[11px] text-slate-400 font-bold">
            <Check className="w-3.5 h-3.5 mr-0.5 text-emerald-500 stroke-[3]" /> Claimed
          </span>
        ) : (
          <button
            onClick={onCheckIn}
            disabled={busy}
            aria-label={`Claim daily check-in bonus: +${reward} ${currencySymbol}`}
            className="px-3.5 py-2.5 bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-extrabold text-xs rounded-xl transition shadow disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5" aria-hidden="true" /> +{reward} {currencySymbol}
          </button>
        )}
      </div>
    </div>
  );
};
