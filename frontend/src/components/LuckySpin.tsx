/**
 * Lucky Spin — server-authoritative. The backend (/api/spin) picks the prize
 * (weighted), enforces the 24h cooldown, and credits the balance. This component
 * only animates the wheel to the backend-chosen segment and displays the result.
 */

import React, { useState, useEffect } from "react";
import { Gift, Clock, Sparkles, RefreshCw } from "lucide-react";
import { playSpinSound } from "../utils/soundEffects";

interface SpinResult {
  ok: boolean;
  rewardCoins?: number;
  cooldownLeft?: number;
}

interface LuckySpinProps {
  onSpin: () => Promise<SpinResult>;
  initialCooldownLeft?: number; // seconds, from GET /api/spin
}

const SPIN_PRIZES = [
  { value: 10, label: "10 ACN", color: "#10b981" },
  { value: 25, label: "25 ACN", color: "#3b82f6" },
  { value: 50, label: "50 ACN", color: "#8b5cf6" },
  { value: 100, label: "100 ACN", color: "#ec4899" },
  { value: 200, label: "200 ACN", color: "#f59e0b" },
  { value: 500, label: "500 ACN", color: "#ef4444" },
  { value: 150, label: "150 ACN", color: "#06b6d4" },
  { value: 1000, label: "JACKPOT", color: "#eab308" },
];

export const LuckySpin: React.FC<LuckySpinProps> = ({ onSpin, initialCooldownLeft = 0 }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState<number>(initialCooldownLeft);
  const [wonPrize, setWonPrize] = useState<(typeof SPIN_PRIZES)[number] | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Sync cooldown from backend status (e.g. when the parent loads /api/spin).
  useEffect(() => {
    setCooldownLeft((c) => Math.max(c, initialCooldownLeft));
  }, [initialCooldownLeft]);

  // Tick the cooldown down every second.
  useEffect(() => {
    const t = setInterval(() => setCooldownLeft((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const formatCooldown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const getArcPath = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return ["M", x, y, "L", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y, "Z"].join(" ");
  };

  const handleSpinClick = async () => {
    if (isSpinning || cooldownLeft > 0) return;

    setIsSpinning(true);
    setWonPrize(null);
    setShowCelebration(false);
    playSpinSound();

    let res: SpinResult;
    try {
      res = await onSpin(); // backend decides prize + cooldown + credit
    } catch {
      setIsSpinning(false);
      return;
    }

    if (!res || !res.ok) {
      setIsSpinning(false);
      if (res?.cooldownLeft) setCooldownLeft(res.cooldownLeft);
      return;
    }

    const prize = SPIN_PRIZES.find((p) => p.value === res.rewardCoins) || SPIN_PRIZES[0];
    const winningIdx = SPIN_PRIZES.indexOf(prize);
    const segmentAngle = 45;
    const targetAngle = 360 - (winningIdx * segmentAngle + segmentAngle / 2);
    const newRotation = rotation + 1800 + (targetAngle - (rotation % 360));
    setRotation(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setWonPrize(prize);
      setShowCelebration(true);
      setCooldownLeft(res.cooldownLeft ?? 24 * 60 * 60);
    }, 4000);
  };

  return (
    <div id="lucky-spin-card" className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Gift className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 min-w-0">
              <span className="truncate">Daily Lucky Spin</span>
              <span className="text-[7px] sm:text-[8px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono uppercase font-black shrink-0">24H</span>
            </h4>
            <p className="text-[9px] text-slate-400 truncate">Spin the wheel once a day to win free bonus coins!</p>
          </div>
        </div>
        {cooldownLeft > 0 && (
          <span className="flex items-center space-x-1 text-amber-700 font-mono text-[9px] bg-amber-50 border border-amber-100 px-1.5 py-1 rounded shrink-0 whitespace-nowrap">
            <Clock className="w-3 h-3 text-amber-500" />
            <span className="font-bold">{formatCooldown(cooldownLeft)}</span>
          </span>
        )}
      </div>

      {/* Wheel */}
      <div className="relative flex flex-col items-center justify-center py-6">
        <div className="absolute w-60 h-60 sm:w-72 md:w-80 rounded-full bg-indigo-500/5 blur-xl pointer-events-none animate-pulse" />
        <div className="relative w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] md:w-[320px] md:h-[320px] rounded-full bg-slate-900 border-4 border-slate-800 shadow-2xl flex items-center justify-center p-1 select-none transition-all">
          <div className="absolute top-[-10px] z-20 flex flex-col items-center">
            <div className="w-4 h-4 bg-red-500 rotate-45 transform origin-center border border-white shadow shadow-red-500/20" />
            <div className="w-1 h-3 bg-red-600 -mt-1.5" />
          </div>

          <div
            className="w-full h-full rounded-full overflow-hidden transition-transform duration-[4000ms] ease-out relative"
            style={{ transform: `rotate(${rotation}deg)`, willChange: "transform", backfaceVisibility: "hidden" }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden="true" focusable="false">
              {SPIN_PRIZES.map((prize, idx) => {
                const startAngle = idx * 45;
                const endAngle = (idx + 1) * 45;
                const pathData = getArcPath(100, 100, 95, startAngle, endAngle);
                const midAngle = startAngle + 22.5;
                const textPos = polarToCartesian(100, 100, 62, midAngle);
                const isJackpot = prize.value === 1000;
                return (
                  <g key={idx}>
                    <path d={pathData} fill={prize.color} stroke="#0f172a" strokeWidth="1.5" opacity="0.9" />
                    <text
                      x={textPos.x}
                      y={textPos.y}
                      fill="#ffffff"
                      fontSize={isJackpot ? "6.5px" : "8px"}
                      fontWeight="900"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      transform={`rotate(${midAngle + 90}, ${textPos.x}, ${textPos.y})`}
                      className="font-sans select-none tracking-tight"
                    >
                      {prize.label}
                    </text>
                  </g>
                );
              })}
              {[...Array(12)].map((_, idx) => {
                const angle = idx * 30;
                const pos = polarToCartesian(100, 100, 96.5, angle);
                return <circle key={`dot-${idx}`} cx={pos.x} cy={pos.y} r="1.8" fill="#ffffff" opacity="0.85" className="pointer-events-none" />;
              })}
              <circle cx="100" cy="100" r="18" fill="#1e293b" stroke="#334155" strokeWidth="2.5" />
              <circle cx="100" cy="100" r="14" fill="#eab308" />
            </svg>
          </div>

          <button
            onClick={handleSpinClick}
            disabled={isSpinning || cooldownLeft > 0}
            aria-label={isSpinning ? "Spinning" : cooldownLeft > 0 ? `Spin locked, ${Math.ceil(cooldownLeft / 60)} minutes remaining` : "Spin the lucky wheel"}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center font-black transition active:scale-95 text-[10px] sm:text-xs uppercase shadow-md select-none border border-amber-300/40 cursor-pointer ${
              isSpinning
                ? "bg-slate-700 text-slate-400 border-slate-600"
                : cooldownLeft > 0
                ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                : "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
            }`}
          >
            {isSpinning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-300" />
            ) : cooldownLeft > 0 ? (
              <Clock className="w-4 h-4 text-slate-500" />
            ) : (
              <span className="font-extrabold leading-none tracking-tight">SPIN</span>
            )}
          </button>
        </div>

        {showCelebration && wonPrize && (
          <div className="mt-3.5 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-700 font-extrabold text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
              <span>Congratulations! Won {wonPrize.value} ACN!</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">Rewards are credited by the server after verification.</p>
          </div>
        )}

        {!showCelebration && !isSpinning && cooldownLeft === 0 && (
          <div className="mt-3.5 text-center flex items-center gap-1.5 text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100/50 px-3 py-1 rounded-full animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Spin to win up to 1,000 ACN jackpot instantly!</span>
          </div>
        )}
      </div>
    </div>
  );
};
