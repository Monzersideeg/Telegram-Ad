/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Play, Tv, Coins, ShieldAlert, Sparkles, CheckCircle2, Clock, VolumeX, Volume2, ShieldCheck, ExternalLink } from 'lucide-react';
import { AdCampaign, AdType, MonetagConfig } from '../types';
import { SIMULATED_AD_CAMPAIGNS } from '../data';

interface AdWatcherProps {
  monetagConfig: MonetagConfig;
  onAdCompleted: (reward: number, title: string) => void;
}

export const AdWatcher: React.FC<AdWatcherProps> = ({
  monetagConfig,
  onAdCompleted,
}) => {
  const [activeAd, setActiveAd] = useState<AdCampaign | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [adStep, setAdStep] = useState<'loading' | 'playing' | 'claim' | 'completed'>('loading');
  const [countdownPercent, setCountdownPercent] = useState(100);
  const [humanVerifyCode, setHumanVerifyCode] = useState('');
  const [humanInput, setHumanInput] = useState('');
  const [humanError, setHumanError] = useState(false);

  // Generate a random captcha code for reward claim verification
  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setHumanVerifyCode(code);
    setHumanInput('');
    setHumanError(false);
  };

  // Launch Ad Watch flow
  const handleStartSimulatedAd = (campaign: AdCampaign) => {
    setActiveAd(campaign);
    setIsPlaying(true);
    setAdStep('loading');
    setSecondsRemaining(campaign.durationSeconds);
    setCountdownPercent(100);
    
    // Simulate loading for 1.2s then play
    setTimeout(() => {
      setAdStep('playing');
    }, 1200);
  };

  // Ad playing timer loop
  useEffect(() => {
    if (!isPlaying || adStep !== 'playing' || !activeAd) return;

    if (secondsRemaining <= 0) {
      setAdStep('claim');
      generateCaptcha();
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        setCountdownPercent((next / activeAd.durationSeconds) * 100);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, adStep, secondsRemaining, activeAd]);

  // Handle Humanity verification & Claim reward
  const handleVerifyAndClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAd) return;

    if (humanInput.trim().toUpperCase() === humanVerifyCode) {
      setAdStep('completed');
      setTimeout(() => {
        onAdCompleted(activeAd.rewardAmount, activeAd.title);
        setIsPlaying(false);
        setActiveAd(null);
      }, 1500);
    } else {
      setHumanError(true);
      setHumanInput('');
    }
  };

  // Simulate Popunder or Monetag live link click
  const handleLiveMonetagClick = () => {
    if (monetagConfig.smartlinkUrl) {
      window.open(monetagConfig.smartlinkUrl, '_blank', 'noopener,noreferrer');
      // Give a dynamic simulation reward for checking real publisher link!
      onAdCompleted(0.05, 'Monetag Smartlink Visit');
    }
  };

  return (
    <div id="ad-watcher-view" className="space-y-5 px-4 py-4 max-w-lg mx-auto">
      {/* Header Banner */}
      <div className="text-center space-y-1 py-1">
        <h2 className="text-base font-bold text-white flex items-center justify-center space-x-1.5">
          <Tv className="w-5 h-5 text-amber-400" />
          <span>Active Ad Stream</span>
        </h2>
        <p className="text-xs text-slate-400">
          Watch video stream, complete captcha, earn cash instantly.
        </p>
      </div>

      {/* Real Monetag Live Status Banner */}
      {monetagConfig.isEnabled ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div>
              <div className="text-xs font-semibold text-emerald-400">Real Monetag Publisher Ads Active</div>
              <div className="text-[10px] text-slate-400">Direct Smartlinks will trigger real income on your dashboard.</div>
            </div>
          </div>
          <button
            onClick={handleLiveMonetagClick}
            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-lg text-[10px] flex items-center space-x-1 transition cursor-pointer"
          >
            <span>Open Link</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span className="text-[11px] text-slate-400">
              Running simulated ads. Toggle real monetization in settings.
            </span>
          </div>
          <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
            TEST MODE
          </span>
        </div>
      )}

      {/* Campaigns Listing */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
          Available Campaigns
        </h3>

        <div className="space-y-3">
          {SIMULATED_AD_CAMPAIGNS.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between shadow-sm transition group"
            >
              <div className="space-y-1 pr-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white group-hover:text-sky-400 transition">
                    {campaign.title}
                  </span>
                  <span className="bg-slate-800 text-slate-400 text-[8px] px-1 py-0.2 rounded uppercase tracking-wider font-mono">
                    {campaign.type}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-normal max-w-[260px]">
                  {campaign.description}
                </p>
                <div className="flex items-center space-x-3.5 pt-1.5 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    {campaign.durationSeconds}s
                  </span>
                  <span className="flex items-center text-emerald-500/90 font-semibold">
                    <Coins className="w-3.5 h-3.5 mr-1 text-amber-500/80" />
                    +${campaign.rewardAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleStartSimulatedAd(campaign)}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-gradient-to-r hover:from-amber-400 hover:to-amber-500 hover:text-slate-950 text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-95 shrink-0 shadow-sm flex items-center space-x-1 border border-slate-700/30 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FULL SCREEN DYNAMIC AD WATCH PLAYER MODAL */}
      {isPlaying && activeAd && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col justify-between">
          {/* Player Header */}
          <div className="p-4 bg-gradient-to-b from-slate-950 to-transparent flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <div className="text-xs font-semibold text-slate-300 font-mono">
                Ad Stream: {activeAd.advertiserName}
              </div>
            </div>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Player Video / Ad Simulation Body */}
          <div className="flex-1 flex items-center justify-center p-4">
            {adStep === 'loading' && (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs text-slate-400 font-mono">Connecting securely to ad network...</div>
              </div>
            )}

            {adStep === 'playing' && (
              <div className="w-full max-w-sm aspect-video bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative shadow-2xl flex flex-col justify-between p-4">
                {/* Simulated visual video stream container */}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-indigo-950/20 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center mb-3 border border-slate-700 animate-pulse">
                    <Sparkles className="w-8 h-8 text-amber-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{activeAd.title}</h4>
                  <p className="text-[10px] text-slate-400 max-w-[200px]">
                    Promotional clip by {activeAd.advertiserName}. Keep watching to credit your wallet.
                  </p>
                </div>

                {/* Simulated live telemetry overlay to look highly refined */}
                <div className="relative z-10 flex items-center justify-between text-[8px] font-mono text-slate-500">
                  <span>REWARD MULTIPLIER: 1.0X</span>
                  <span>BITRATE: 4.8MBPS</span>
                </div>

                {/* Progress bar overlay */}
                <div className="relative z-10 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1 text-slate-400 animate-spin" />
                      {secondsRemaining}s remaining
                    </span>
                    <span>{Math.round(100 - countdownPercent)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${countdownPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {adStep === 'claim' && (
              <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Stream Complete!</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Please confirm below to claim your rewards.</p>
                </div>

                {/* Humanity Captcha Verification */}
                <form onSubmit={handleVerifyAndClaim} className="space-y-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-center space-x-3">
                    <span className="text-slate-500 text-[10px] font-mono tracking-wider">CODE:</span>
                    <span className="text-amber-400 font-mono font-black text-lg tracking-widest select-none line-through decoration-slate-600 italic">
                      {humanVerifyCode}
                    </span>
                    <button
                      type="button"
                      onClick={generateCaptcha}
                      className="text-[10px] text-slate-400 hover:text-white"
                      title="New Code"
                    >
                      ⟳
                    </button>
                  </div>

                  <input
                    type="text"
                    value={humanInput}
                    onChange={(e) => setHumanInput(e.target.value)}
                    placeholder="Enter Code"
                    className="w-full text-center text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                    maxLength={4}
                    required
                  />

                  {humanError && (
                    <div className="text-[10px] text-red-400 font-semibold">
                      Invalid code. Please try again.
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:opacity-90 text-slate-950 font-black rounded-xl text-xs shadow transition active:scale-95"
                  >
                    Claim +${activeAd.rewardAmount.toFixed(2)} USD
                  </button>
                </form>
              </div>
            )}

            {adStep === 'completed' && (
              <div className="text-center space-y-3 animate-in zoom-in-95 duration-150">
                <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-slate-950 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8 stroke-[3]" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Reward Credited!</h4>
                  <p className="text-xs text-emerald-400 font-mono font-bold mt-1">+${activeAd.rewardAmount.toFixed(2)} added to balance</p>
                </div>
              </div>
            )}
          </div>

          {/* Player Footer */}
          <div className="p-4 bg-gradient-to-t from-slate-950 to-transparent flex items-center justify-center">
            <div className="text-[10px] text-slate-500 flex items-center space-x-1 font-mono">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
              <span>Verified Secure Ad Loop</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
