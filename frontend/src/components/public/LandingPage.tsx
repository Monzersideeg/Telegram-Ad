/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Shield, HelpCircle, ArrowRight, Activity, Zap, Users, MessageSquare } from 'lucide-react';
import { AppConfig } from '../../types';

interface LandingPageProps {
  appConfig: AppConfig;
  onNavigate: (path: string) => void;
  language: 'en' | 'ru';
}

export const LandingPage: React.FC<LandingPageProps> = ({ appConfig, onNavigate, language }) => {
  const [supportName, setSupportName] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject || !supportMessage) return;

    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: supportName || 'Guest User',
          subject: supportSubject,
          message: supportMessage,
        }),
      });
      if (res.ok) {
        setSupportSubmitted(true);
        setSupportName('');
        setSupportSubject('');
        setSupportMessage('');
      }
    } catch (err) {
      console.error('Failed to submit support ticket', err);
    }
  };

  const isEn = language === 'en';

  const faqs = [
    {
      q: isEn ? "How do I earn with AdCoin?" : "Как мне зарабатывать с AdCoin?",
      a: isEn 
        ? "Simply browse high-CPM ad campaigns, complete rewarded video tasks, claim daily streak bonuses, or invite your friends to participate for a lifetime 10% commission on all their earnings."
        : "Просто просматривайте рекламные кампании с высоким CPM, выполняйте видео-задания, забирайте ежедневные бонусы за серии входов или приглашайте друзей и получайте пожизненную комиссию 10% от всех их доходов."
    },
    {
      q: isEn ? "What is the minimum withdrawal?" : "Какова минимальная сумма для вывода?",
      a: isEn
        ? `The threshold is currently set to $${appConfig.minWithdrawal.toFixed(2)} USD (convertible instantly to your chosen currency equivalent).`
        : `На данный момент порог установлен на уровне $${appConfig.minWithdrawal.toFixed(2)} USD (моментально конвертируется в эквивалент выбранной валюты).`
    },
    {
      q: isEn ? "Are payouts automatic?" : "Выплаты автоматические?",
      a: isEn
        ? "Yes! Payouts to secure Web3 wallets (TON, USDT, TRX) are batched and executed automatically daily once approved by S2S audits."
        : "Да! Выплаты на кошельки Web3 (TON, USDT, TRX) группируются и выполняются автоматически каждый день после успешной S2S-проверки."
    }
  ];

  return (
    <div className="bg-slate-950 text-white min-h-screen font-sans flex flex-col selection:bg-emerald-500 selection:text-black">
      
      {/* Top Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-slate-950 text-sm bg-gradient-to-br from-emerald-400 to-green-500 shadow shadow-emerald-500/25">
            AC
          </span>
          <span className="font-extrabold text-lg tracking-tight text-white">{appConfig.appName}</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('/privacy')}
            className="text-xs text-slate-400 hover:text-white transition hidden sm:inline"
          >
            {isEn ? "Privacy" : "Конфиденциальность"}
          </button>
          <button 
            onClick={() => onNavigate('/terms')}
            className="text-xs text-slate-400 hover:text-white transition hidden sm:inline"
          >
            {isEn ? "Terms" : "Правила"}
          </button>
          <button 
            onClick={() => onNavigate('/login')}
            className="px-4 py-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl transition"
          >
            {isEn ? "Sign In" : "Войти"}
          </button>
          <button 
            onClick={() => onNavigate('/dashboard')}
            className="px-4 py-2 text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow shadow-emerald-500/20 flex items-center gap-1 transition"
          >
            {isEn ? "Launch App" : "Запустить"} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 md:py-20 space-y-24">
        
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="bg-emerald-500/10 text-emerald-400 text-xs font-extrabold px-3.5 py-1.5 rounded-full border border-emerald-500/20 tracking-wider uppercase inline-flex items-center gap-1.5 animate-pulse">
              <Zap className="w-3.5 h-3.5 fill-current" /> Web3 Earning Node Active
            </span>
            <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight text-white">
              {isEn ? "Watch Ads." : "Смотри Рекламу."}<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">
                {isEn ? "Earn Crypto Currency." : "Зарабатывай Крипту."}
              </span><br />
              {isEn ? "Cash Out Daily." : "Выводи Деньги Каждый День."}
            </h1>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed font-light">
              {appConfig.appDescription}
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => onNavigate('/dashboard')}
                className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black rounded-xl transition shadow-lg shadow-emerald-500/10 flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> {isEn ? "Start Earning ACN" : "Начать зарабатывать ACN"}
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('support-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-bold rounded-xl transition border border-slate-800 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> {isEn ? "Contact Support" : "Связаться с поддержкой"}
              </button>
            </div>
          </div>

          {/* Interactive Stats Block visual */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl">
            <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-emerald-500/5 blur-[50px] pointer-events-none" />
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase">{isEn ? "Live System Feed" : "Лента Системы"}</h3>
                <p className="text-[11px] text-slate-500">{isEn ? "Real-time CPM updates" : "Обновления в реальном времени"}</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                <Activity className="w-3 h-3 animate-ping" /> S2S verified
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{isEn ? "Global Members" : "Всего Пользователей"}</div>
                <div className="text-xl font-black text-emerald-400">124.8K+</div>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{isEn ? "Active CPM" : "Текущий CPM"}</div>
                <div className="text-xl font-black text-emerald-400">$12.40</div>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{isEn ? "Paid Out" : "Выплачено"}</div>
                <div className="text-xl font-black text-emerald-400">$84.2K+</div>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{isEn ? "Ad Campaign Fill Rate" : "Заполняемость Рекламы"}</span>
                <span className="font-bold text-white">99.8%</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-emerald-500 h-full w-[99.8%] rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-3xl font-black">{isEn ? "How the Platform Operates" : "Как Работает Платформа"}</h2>
            <p className="text-slate-400 font-light text-xs md:text-sm">
              {isEn 
                ? "Experience a smooth, fully transparent cycle where advertisers pay for views, and rewards flow directly into your secure wallet." 
                : "Простой и прозрачный цикл: рекламодатели платят за просмотры, а вознаграждения поступают прямо на ваш кошелек."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900/30 border border-slate-800/80 hover:border-emerald-500/30 rounded-2xl p-6 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <h3 className="text-base font-bold mb-1.5">{isEn ? "1. Watch Video Ads" : "1. Смотри Видео"}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {isEn 
                  ? "Load short, interactive rewarded ad placements curated directly from global networks with maximum conversion fill-rates." 
                  : "Просматривайте короткие рекламные ролики от мировых сетей с максимальными ставками CPM."}
              </p>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/80 hover:border-emerald-500/30 rounded-2xl p-6 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-1.5">{isEn ? "2. Refer Teammates" : "2. Приглашай Друзей"}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {isEn 
                  ? "Share your custom link to build a continuous referral circle. Earn 10% commission on every ad campaign they complete, forever." 
                  : "Поделитесь ссылкой и получайте постоянную комиссию 10% от каждого выполненного ими задания."}
              </p>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/80 hover:border-emerald-500/30 rounded-2xl p-6 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-1.5">{isEn ? "3. Instant Cash Out" : "3. Быстрый Вывод"}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {isEn 
                  ? `Accumulate ${appConfig.currencySymbol} and cash out directly into TON, TRON or USDT with zero blockchain fees.` 
                  : `Накапливайте ${appConfig.currencySymbol} и заказывайте выплату на кошельки TON, TRON или USDT без скрытых комиссий.`}
              </p>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div id="support-section" className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black">{isEn ? "Support Center & Feedback" : "Центр Поддержки"}</h2>
            <p className="text-slate-400 font-light text-xs">
              {isEn ? "Have questions or need assistance with your payments? Submit a ticket directly." : "Есть вопросы или нужна помощь с выплатами? Создайте обращение."}
            </p>
          </div>

          {supportSubmitted ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-2">
              <span className="text-xl">🎉</span>
              <h3 className="text-emerald-400 font-bold text-sm">{isEn ? "Support Ticket Created!" : "Обращение Создано!"}</h3>
              <p className="text-xs text-slate-300">
                {isEn ? "Our security managers will review and reply within 12 hours." : "Наши менеджеры ответят вам в течение 12 часов."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSupportSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">{isEn ? "Your Name / Telegram Handle" : "Ваше Имя / Ник"}</label>
                  <input
                    type="text"
                    value={supportName}
                    onChange={e => setSupportName(e.target.value)}
                    placeholder="e.g. @alex_korolev"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">{isEn ? "Subject" : "Тема"}</label>
                  <input
                    type="text"
                    required
                    value={supportSubject}
                    onChange={e => setSupportSubject(e.target.value)}
                    placeholder="e.g. Withdrawal Help"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">{isEn ? "Detailed Message" : "Сообщение"}</label>
                <textarea
                  required
                  rows={4}
                  value={supportMessage}
                  onChange={e => setSupportMessage(e.target.value)}
                  placeholder="Explain your problem clearly..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-white focus:outline-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider transition"
              >
                {isEn ? "Submit Support Ticket" : "Отправить Обращение"}
              </button>
            </form>
          )}
        </div>

        {/* FAQs */}
        <div className="space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-2xl font-black">{isEn ? "Frequently Answered FAQs" : "Часто Задаваемые Вопросы"}</h2>
            <p className="text-slate-400 font-light text-xs">
              {isEn ? "Get instant guidance on common network interactions." : "Быстрые ответы на популярные вопросы пользователей."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <h4>{faq.q}</h4>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed font-light">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6 mt-20 text-slate-500 text-center text-xs space-y-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap justify-center gap-6 text-slate-400">
          <button onClick={() => onNavigate('/')} className="hover:text-emerald-400 transition">{isEn ? "Home" : "Главная"}</button>
          <button onClick={() => onNavigate('/privacy')} className="hover:text-emerald-400 transition">{isEn ? "Privacy Policy" : "Политика Конфиденциальности"}</button>
          <button onClick={() => onNavigate('/terms')} className="hover:text-emerald-400 transition">{isEn ? "Terms of Service" : "Условия использования"}</button>
          <button onClick={() => onNavigate('/support')} className="hover:text-emerald-400 transition">{isEn ? "Support" : "Поддержка"}</button>
        </div>
        <p className="font-light">
          © 2026 {appConfig.appName}. {isEn ? "All rights reserved. Powered by Server-to-Server high cpm ad mediation." : "Все права защищены."}
        </p>
      </footer>
    </div>
  );
};
