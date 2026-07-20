/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { AppConfig } from '../../types';

interface TermsOfServiceProps {
  appConfig: AppConfig;
  onNavigate: (path: string) => void;
  language: 'en' | 'ru';
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ appConfig, onNavigate, language }) => {
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
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{isEn ? "Terms of Service" : "Условия Использования"}</h1>
            <p className="text-xs text-slate-500">{isEn ? "Last updated: July 16, 2026" : "Последнее обновление: 16 июля 2026 г."}</p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">{isEn ? "1. Terms Acceptance" : "1. Согласие с условиями"}</h2>
          <p>
            {isEn 
              ? "By accessing and using our application, you agree to comply with these terms, our anti-fraud rules, and payment policies. Virtual rewards hold no real currency value until validated and processed through secure Web3 S2S audits."
              : "Получая доступ к нашему приложению, вы соглашаетесь соблюдать настоящие условия, наши правила борьбы с мошенничеством и платежные политики. Виртуальные вознаграждения не имеют ценности реальной валюты до проверки посредством аудита S2S."}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">{isEn ? "2. User Conduct & Fraud" : "2. Поведение пользователей и мошенничество"}</h2>
          <p>
            {isEn
              ? "We strictly prohibit any attempts to simulate ad views, use click farms, auto-clickers, multi-accounts, emulator programs, or modify server network packets. Violating these actions triggers automatic wallet freezes and permanent IP address ban bans."
              : "Мы строго запрещаем любые попытки симулировать просмотры рекламы, использовать клик-фермы, автокликеры, несколько аккаунтов или изменять сетевые пакеты. Нарушение этих условий ведет к автоматической заморозке кошелька."}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">{isEn ? "3. Withdrawal Safeguards" : "3. Лимиты и Безопасность Выплат"}</h2>
          <p>
            {isEn
              ? `Users can submit withdrawal requests once they reach the minimum payout threshold of $${appConfig.minWithdrawal.toFixed(2)} USD. Payments undergo manual S2S verification within 24-48 hours to confirm ad-network impressions.`
              : `Пользователи могут заказать выплату по достижении минимального порога в $${appConfig.minWithdrawal.toFixed(2)} USD. Выплаты проходят ручную проверку S2S в течение 24-48 часов.`}
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6 text-slate-500 text-center text-xs space-y-4 max-w-7xl mx-auto w-full">
        <p>© 2026 {appConfig.appName}. All rights reserved.</p>
      </footer>
    </div>
  );
};
