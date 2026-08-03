import React, { useEffect, useState } from "react";
import { Award, Check, Coins, Settings, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import type { AppConfig, UserStats } from "../types";
import { translations } from "../utils/translations";

interface HeaderProps {
  stats: UserStats;
  telegramUser: { username: string; fullName: string; isPremium: boolean; photoUrl: string | null };
  soundEnabled: boolean;
  onToggleSound: () => void;
  appConfig: AppConfig;
  language: "en" | "ru";
  onLanguageChange: (lang: "en" | "ru") => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  telegramUser,
  soundEnabled,
  onToggleSound,
  appConfig,
  language,
  onLanguageChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const t = translations[language] || translations.en;

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const initials =
    telegramUser.fullName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "TG";
  const displayName = telegramUser.fullName && telegramUser.fullName !== "Guest User" ? telegramUser.fullName : `@${telegramUser.username}`;
  const userLevel = Math.floor(stats.adsWatchedCount / 10) + 1;
  const adsInCurrentLevel = stats.adsWatchedCount % 10;
  const levelProgress = (adsInCurrentLevel / 10) * 100;

  return (
    <>
      <header className="bg-white/95 border-b border-slate-200/80 px-2.5 sm:px-5 py-2.5 sm:py-3 sticky top-0 z-40 shadow-sm flex items-center justify-between select-none">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="relative shrink-0">
            {telegramUser.photoUrl ? (
              <img src={telegramUser.photoUrl} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-sm border border-emerald-100 bg-emerald-50" />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-white text-xs sm:text-sm shadow-sm bg-gradient-to-br from-emerald-400 to-green-500">
                {initials}
              </div>
            )}
            {telegramUser.isPremium && (
              <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-900 rounded-full text-[8px] h-4 w-4 font-bold flex items-center justify-center shadow border border-white">★</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold leading-none uppercase tracking-wider mb-0.5 truncate">{t.welcomeBack}</div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-extrabold text-[10px] sm:text-xs text-slate-800 leading-none truncate max-w-[100px] sm:max-w-[160px]">{displayName}</span>
              <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-extrabold font-mono border shrink-0 ${isOnline ? "bg-emerald-50 text-emerald-600 border-emerald-100/60" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500 animate-ping"}`} />
                <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          <div className="text-right min-w-0">
            <div className="flex items-center justify-end text-emerald-600 font-mono font-extrabold text-xs sm:text-sm">
              <Coins className="w-3.5 h-3.5 mr-0.5 sm:mr-1 text-amber-500 shrink-0" />
              <span className="truncate max-w-[60px] sm:max-w-none">{Math.round(stats.balance * appConfig.usdToCoinRate).toLocaleString()}</span>
              <span className="ml-0.5 text-[9px] sm:text-xs text-slate-500 font-normal">{appConfig.currencySymbol}</span>
            </div>
            <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold font-mono leading-none mt-0.5">≈ ${stats.balance.toFixed(2)}</div>
          </div>

          <button onClick={() => onLanguageChange(language === "en" ? "ru" : "en")} className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-bold text-xs transition-all shadow-sm active:scale-95" aria-label="Switch language">
            {language === "en" ? "🇬🇧" : "🇷🇺"}
          </button>

          <button onClick={onToggleSound} className={`hidden sm:flex w-9 h-9 rounded-full items-center justify-center cursor-pointer border transition-all shrink-0 ${soundEnabled ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow" : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`} aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}>
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button onClick={() => setIsOpen(true)} className="w-9 h-9 rounded-full flex items-center justify-center border bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all shrink-0 shadow-sm active:scale-95" aria-label="Open profile and settings">
            <Settings className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </header>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <Settings className="w-5 h-5 text-emerald-500" />
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">{language === "en" ? "Profile & Settings" : "Профиль и Настройки"}</h3>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="w-11 h-11 -m-1.5 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer" aria-label="Close settings">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white font-extrabold flex items-center justify-center text-base shadow-sm shrink-0">{initials}</div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{telegramUser.fullName}</h4>
                    <p className="text-xs text-emerald-600 font-bold">@{telegramUser.username}</p>
                  </div>
                  <div className="ml-auto"><span className="bg-emerald-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">{t.pro}</span></div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-2">
                  <div className="flex justify-between items-center text-[11px] sm:text-xs">
                    <span className="font-extrabold text-slate-700 flex items-center gap-1"><Award className="w-4 h-4 text-emerald-500" />Level {userLevel}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">{adsInCurrentLevel}/10 ads to level up</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden relative">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{ width: `${levelProgress}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance</div>
                    <div className="text-sm font-black text-emerald-600 font-mono mt-0.5">{Math.round(stats.balance * appConfig.usdToCoinRate).toLocaleString()} {appConfig.currencySymbol}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Views</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{stats.adsWatchedCount}</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">Preferences</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => onLanguageChange("en")} className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${language === "en" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}><span>🇬🇧 English</span>{language === "en" && <Check className="w-4 h-4 text-emerald-600" />}</button>
                  <button onClick={() => onLanguageChange("ru")} className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${language === "ru" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}><span>🇷🇺 Russian</span>{language === "ru" && <Check className="w-4 h-4 text-emerald-600" />}</button>
                </div>
                <button onClick={onToggleSound} className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">{soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />} Sound effects</span>
                  <span className={soundEnabled ? "text-emerald-600" : "text-slate-400"}>{soundEnabled ? "On" : "Off"}</span>
                </button>
              </div>

              {!isOnline && (
                <div className="bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl p-3 text-xs font-semibold flex gap-2">
                  <WifiOff className="w-4 h-4 shrink-0" /> Some actions need an internet connection.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
