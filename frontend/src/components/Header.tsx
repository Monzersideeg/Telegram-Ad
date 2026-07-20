/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, HelpCircle, Coins, ExternalLink, Sliders, X, Check, Award, Eye, Sparkles, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { UserStats, MonetagConfig, AppConfig } from '../types';
import { translations } from '../utils/translations';

interface HeaderProps {
  stats: UserStats;
  monetagConfig: MonetagConfig;
  onUpdateMonetag: (config: MonetagConfig) => void;
  telegramUser: { username: string; fullName: string; isPremium: boolean };
  soundEnabled: boolean;
  onToggleSound: () => void;
  appConfig: AppConfig;
  language: 'en' | 'ru';
  onLanguageChange: (lang: 'en' | 'ru') => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  monetagConfig,
  onUpdateMonetag,
  telegramUser,
  soundEnabled,
  onToggleSound,
  appConfig,
  language,
  onLanguageChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [smartlink, setSmartlink] = useState(monetagConfig.smartlinkUrl);
  const [popunder, setPopunder] = useState(monetagConfig.popunderZoneId);
  const [pushZone, setPushZone] = useState(monetagConfig.inPagePushZoneId);
  const [interstitial, setInterstitial] = useState(monetagConfig.interstitialZoneId);
  const [isEnabled, setIsEnabled] = useState(monetagConfig.isEnabled);
  const [isSaved, setIsSaved] = useState(false);

  const t = translations[language] || translations.en;

  const tonRate = 7.35; // 1 TON = $7.35 USD
  const tonEquivalent = (stats.balance / tonRate).toFixed(3);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateMonetag({
      smartlinkUrl: smartlink,
      popunderZoneId: popunder,
      inPagePushZoneId: pushZone,
      interstitialZoneId: interstitial,
      isEnabled: isEnabled,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setIsOpen(false);
    }, 1200);
  };

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Derive initials
  const initials = telegramUser.fullName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'TG';

  // Level & progress calculation
  const userLevel = Math.floor(stats.adsWatchedCount / 10) + 1;
  const adsInCurrentLevel = stats.adsWatchedCount % 10;
  const levelProgress = (adsInCurrentLevel / 10) * 100;

  return (
    <>
      <header id="app-header" className="bg-white/95 border-b border-slate-200/80 px-2.5 sm:px-5 py-2.5 sm:py-3 sticky top-0 z-40 shadow-sm flex items-center justify-between select-none">
        
        {/* Left: User profile details */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-white text-xs sm:text-sm shadow-sm bg-gradient-to-br from-emerald-400 to-green-500">
              {initials}
            </div>
            {telegramUser.isPremium && (
              <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-900 rounded-full text-[7px] sm:text-[8px] h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 font-bold flex items-center justify-center shadow border border-white">
                ★
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold leading-none uppercase tracking-wider mb-0.5 truncate">{t.welcomeBack}</div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-extrabold text-[10px] sm:text-xs text-slate-800 leading-none truncate max-w-[65px] sm:max-w-[100px]">
                @{telegramUser.username}
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[8px] font-black font-mono px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded leading-none border border-emerald-100 shrink-0 scale-90 sm:scale-100 origin-left">
                {t.pro}
              </span>
              
              {/* Subtle network connection status badge */}
              <div
                id="network-status"
                className={`flex items-center gap-1 px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-extrabold font-mono transition-all border shrink-0 scale-90 sm:scale-100 origin-left ${
                  isOnline 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100/60' 
                    : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                }`}
                title={isOnline 
                  ? (language === 'en' ? 'Synced with active cloud backend' : 'Синхронизировано с активным облаком')
                  : (language === 'en' ? 'Offline: Actions cached locally' : 'Офлайн: Действия сохраняются локально')
                }
              >
                <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
                <span>{isOnline ? 'ONLINE' : 'CACHED'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Balance pill + Monetag connection gear */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          <div className="text-right min-w-0">
            <div className="flex items-center justify-end text-emerald-600 font-mono font-extrabold text-xs sm:text-sm">
              <Coins className="w-3.5 h-3.5 mr-0.5 sm:mr-1 text-amber-500 shrink-0" />
              <span className="truncate max-w-[50px] sm:max-w-none">
                {Math.round(stats.balance * appConfig.usdToCoinRate).toLocaleString()}
              </span>
              <span className="ml-0.5 text-[9px] sm:text-xs text-slate-500 font-normal">{appConfig.currencySymbol}</span>
            </div>
            <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold font-mono leading-none mt-0.5">
              ≈ ${stats.balance.toFixed(2)}
            </div>
          </div>

          {/* Language Switcher - hidden on mobile, controlled inside settings */}
          <button
            id="lang-toggle"
            onClick={() => onLanguageChange(language === 'en' ? 'ru' : 'en')}
            className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-full items-center justify-center border bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 cursor-pointer font-bold text-xs transition-all shadow-sm active:scale-95 shrink-0"
            title={language === 'en' ? "Переключить на Русский" : "Switch to English"}
            aria-label={language === 'en' ? "Switch language to Russian" : "Switch language to English"}
          >
            {language === 'en' ? '🇬🇧' : '🇷🇺'}
          </button>

          {/* Sound Effect Toggle Button - hidden on mobile, controlled inside settings */}
          <button
            id="sound-toggle"
            onClick={onToggleSound}
            className={`hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-full items-center justify-center relative cursor-pointer border transition-all shrink-0 ${
              soundEnabled 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow' 
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title={soundEnabled ? t.muteSound : t.unmuteSound}
            aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* User Settings & Profile trigger button - visible everywhere */}
          <button
            id="settings-trigger"
            onClick={() => setIsOpen(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all shrink-0 shadow-sm active:scale-95"
            title={language === 'en' ? "Profile & App Settings" : "Профиль и Настройки"}
            aria-label={language === 'en' ? "Open profile and settings" : "Открыть профиль и настройки"}
          >
            <Settings className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </header>

      {/* User Settings, Language & Profile Performance Drawer/Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            id="user-settings-modal"
            className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <Settings className="w-5 h-5 text-emerald-500" />
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider font-sans">
                  {language === 'en' ? "Profile & Settings" : "Профиль и Настройки"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={language === 'en' ? "Close settings" : "Закрыть настройки"}
                className="w-11 h-11 -m-1.5 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 overflow-y-auto">
              
              {/* Profile Card & Account Badge */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white font-extrabold flex items-center justify-center text-base shadow-sm shrink-0">
                    {initials}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{telegramUser.fullName}</h4>
                    <p className="text-xs text-emerald-600 font-bold">@{telegramUser.username}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="bg-emerald-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {t.pro}
                    </span>
                  </div>
                </div>

                {/* Level Up Progress Card */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-2">
                  <div className="flex justify-between items-center text-[11px] sm:text-xs">
                    <span className="font-extrabold text-slate-700 flex items-center gap-1">
                      <Award className="w-4 h-4 text-emerald-500" />
                      {language === 'en' ? `Level ${userLevel}` : `Уровень ${userLevel}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      {adsInCurrentLevel}/10 {language === 'en' ? "Ads to Level Up" : "Реклам до ЛВЛ"}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden relative">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${levelProgress}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.totalBalance}</div>
                    <div className="text-sm font-black text-emerald-600 font-mono mt-0.5">
                      {Math.round(stats.balance * appConfig.usdToCoinRate).toLocaleString()} {appConfig.currencySymbol}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === 'en' ? "Lifetime Views" : "Всего Просмотров"}</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">
                      {stats.adsWatchedCount} {language === 'en' ? "Ads" : "Рекламы"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.referrals}</div>
                    <div className="text-sm font-black text-indigo-600 font-mono mt-0.5">
                      {stats.referralCount} {language === 'en' ? "Friends" : "Друзей"}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === 'en' ? "Ref Commission" : "Реф. Комиссия"}</div>
                    <div className="text-sm font-black text-amber-600 font-mono mt-0.5">
                      {Math.round(stats.referralEarnings * appConfig.usdToCoinRate).toLocaleString()} {appConfig.currencySymbol}
                    </div>
                  </div>
                </div>
              </div>

              {/* Language Settings Section */}
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  {language === 'en' ? "Select Language" : "Выберите Язык"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onLanguageChange('en')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      language === 'en'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 shadow-sm font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🇬🇧</span>
                      <span className="text-xs">English</span>
                    </div>
                    {language === 'en' && <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onLanguageChange('ru')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      language === 'ru'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 shadow-sm font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🇷🇺</span>
                      <span className="text-xs">Русский</span>
                    </div>
                    {language === 'ru' && <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />}
                  </button>
                </div>
              </div>

              {/* Performance & Audio Toggles */}
              <div className="space-y-3">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  {language === 'en' ? "Feedback & Effects" : "Эффекты и Обратная связь"}
                </label>

                {/* Sound toggle iOS-style */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                      {soundEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {language === 'en' ? "Sound Effects" : "Звуковые Эффекты"}
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium">
                        {language === 'en' ? "Play sound effects on ad completed & click events" : "Звуки при завершении рекламы и кликах"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundEnabled}
                    aria-label={language === 'en' ? "Sound effects" : "Звуковые эффекты"}
                    onClick={onToggleSound}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      soundEnabled ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        soundEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Dynamic Connection Indicator */}
                <div className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 ${
                  isOnline 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                    : 'bg-amber-50 border-amber-200 text-amber-800 animate-pulse'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {isOnline 
                          ? (language === 'en' ? "Telegram API: Active & Synced" : "Телеграм API: Активен и Синхронизирован")
                          : (language === 'en' ? "Offline: Caching Active" : "Офлайн: Кэширование Активно")
                        }
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">
                      {isOnline ? 'Cloud Sync' : 'Local Cache'}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-500 text-left">
                    {isOnline 
                      ? (language === 'en' 
                          ? "Your balance updates, referral stats, and lucky wheel rewards are fully synchronized in real-time with the TON backend server." 
                          : "Ваш баланс, реферальная статистика и колесо фортуны синхронизируются в реальном времени с сервером TON.")
                      : (language === 'en' 
                          ? "No network detected. Your rewards, ad views, and spin history are being cached locally. They will sync automatically once connectivity is restored!" 
                          : "Сеть не найдена. Ваши награды, просмотры рекламы и спины кэшируются локально. Они синхронизируются автоматически при восстановлении сети!")
                    }
                  </p>
                </div>
              </div>

            </div>

            {/* Modal Footer Close button */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl transition uppercase tracking-wider cursor-pointer shadow-sm"
              >
                {language === 'en' ? "Close Options" : "Закрыть Настройки"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
