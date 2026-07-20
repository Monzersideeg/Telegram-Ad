/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { AppConfig } from '../../types';

interface PrivacyPolicyProps {
  appConfig: AppConfig;
  onNavigate: (path: string) => void;
  language: 'en' | 'ru';
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ appConfig, onNavigate, language }) => {
  const isEn = language === 'en';

  return (
    <div className="bg-slate-950 text-white min-h-screen font-sans flex flex-col">
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <button 
          onClick={() => onNavigate('/')}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-emerald-400 transition"
        >
          <ArrowLeft className="w-4 h-4" /> {isEn ? "Back to Home" : "Назад"}
        </button>
        <span className="font-extrabold text-sm tracking-tight text-white">{appConfig.appName}</span>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20 space-y-8 leading-relaxed font-light text-sm text-slate-300">
        <div className="flex items-center gap-3 border-b border-slate-900 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{isEn ? "Privacy Policy" : "Политика Конфиденциальности"}</h1>
            <p className="text-xs text-slate-500">{isEn ? "Last updated: July 16, 2026" : "Последнее обновление: 16 июля 2026 г."}</p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">{isEn ? "1. Data Collection" : "1. Сбор Данных"}</h2>
          <p>
            {isEn 
              ? "We collect limited user information necessary to provide decentralized earning services, including Telegram account identifiers, usernames, IP addresses, country locations, and device types to prevent bot operations and ensure high CPM fill-rates."
              : "Мы собираем ограниченную информацию о пользователях, необходимую для предоставления услуг по заработку, включая идентификаторы Telegram, имена пользователей, IP-адреса, страны и типы устройств для предотвращения активности ботов."}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">{isEn ? "2. How We Use Data" : "2. Как мы используем данные"}</h2>
          <p>
            {isEn
              ? "Your data is used to secure your ad-watch sessions, credit coin balances, track passive referral commissions, prevent payment fraud, and dispatch requested crypto withdrawals to TON / TRON wallets."
              : "Ваши данные используются для защиты сессий просмотра рекламы, начисления монет, отслеживания реферальных комиссий, предотвращения мошенничества и выплаты криптовалюты на кошельки TON / TRON."}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">{isEn ? "3. Advertising Partners" : "3. Рекламные партнеры"}</h2>
          <p>
            {isEn
              ? "We work with reputable third-party advertising networks (such as Monetag, Adsterra, CPX Research) to mediate ad campaigns. These networks may process your IP address and country details to render geographically targeted ads."
              : "Мы работаем с надежными рекламными сетями (например, Monetag, Adsterra, CPX Research). Эти сети могут обрабатывать ваш IP-адрес и данные о стране для показа географически ориентированной рекламы."}
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6 text-slate-500 text-center text-xs space-y-4 max-w-7xl mx-auto w-full">
        <p>© 2026 {appConfig.appName}. All rights reserved.</p>
      </footer>
    </div>
  );
};
