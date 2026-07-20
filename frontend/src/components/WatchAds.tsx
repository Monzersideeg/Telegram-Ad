/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Play, Sparkles, AlertCircle, HelpCircle, Flame, Gift, 
  CheckCircle, ExternalLink, RefreshCw, Smartphone, Shield, Star 
} from 'lucide-react';
import { AdCampaign, AdType, MonetagConfig } from '../types';
import { SIMULATED_AD_CAMPAIGNS } from '../data';

interface WatchAdsProps {
  monetagConfig: MonetagConfig;
  onAdWatched: (reward: number, title: string) => void;
}

export const WatchAds: React.FC<WatchAdsProps> = ({ monetagConfig, onAdWatched }) => {
  const [activeCampaign, setActiveCampaign] = useState<AdCampaign | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState(100);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Interactive ad state variables
  const [clickerCount, setClickerCount] = useState(0);
  const [clickParticles, setClickParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [monetagStep, setMonetagStep] = useState(0);
  const [tonWalletConnected, setTonWalletConnected] = useState(false);

  // Verification CAPTCHA
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [verificationError, setVerificationError] = useState(false);

  // Trigger countdown when ad is playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          const percentage = (next / (activeCampaign?.durationSeconds || 15)) * 100;
          setProgress(percentage);
          
          // Switch steps periodically for monetag banner ad slide
          if (activeCampaign?.id === 'camp_monetag_push') {
            setMonetagStep((s) => (s + 1) % 4);
          }
          
          return next;
        });
      }, 1000);
    } else if (isPlaying && timeLeft === 0) {
      setIsPlaying(false);
      setIsCompleted(true);
      generateVerificationChallenge();
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeLeft, activeCampaign]);

  const generateVerificationChallenge = () => {
    const num1 = Math.floor(Math.random() * 8) + 2;
    const num2 = Math.floor(Math.random() * 8) + 1;
    setCorrectAnswer(num1 + num2);
    setUserAnswer('');
    setVerificationError(false);
  };

  const handleStartAd = (campaign: AdCampaign) => {
    setActiveCampaign(campaign);
    setTimeLeft(campaign.durationSeconds);
    setProgress(100);
    setIsPlaying(true);
    setIsCompleted(false);
    
    // Reset interactive states
    setClickerCount(0);
    setClickParticles([]);
    setWheelRotation(0);
    setMonetagStep(0);
    setTonWalletConnected(false);

    // If Monetag is enabled and has a smartlink, launch real-world redirect in new tab safely
    if (monetagConfig.isEnabled && monetagConfig.smartlinkUrl) {
      try {
        window.open(monetagConfig.smartlinkUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Popunder blocked or failed: ', err);
      }
    }
  };

  const handleVerifyAndClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(userAnswer) === correctAnswer) {
      if (activeCampaign) {
        onAdWatched(activeCampaign.rewardAmount, activeCampaign.title);
        // Reset states
        setActiveCampaign(null);
        setIsCompleted(false);
      }
    } else {
      setVerificationError(true);
    }
  };

  // Interactive Clicker simulated tapping
  const handleSimulatedTap = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isPlaying) return;
    setClickerCount(c => c + 1);
    
    // Spawn floating number particle at mouse relative coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newParticle = { id: Date.now(), x, y };
    setClickParticles(p => [...p, newParticle]);
    
    // Clear particles after 1s
    setTimeout(() => {
      setClickParticles(p => p.filter(item => item.id !== newParticle.id));
    }, 1000);
  };

  // Simulated Fortune Wheel trigger
  const handleWheelSpin = () => {
    if (!isPlaying) return;
    setWheelRotation(prev => prev + 1440 + Math.floor(Math.random() * 360));
  };

  const getCampaignIcon = (id: string) => {
    switch (id) {
      case 'camp_ton_quest':
        return <RefreshCw className="w-5 h-5 text-sky-400" />;
      case 'camp_monetag_push':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'camp_crypto_clicker':
        return <Flame className="w-5 h-5 text-amber-400 animate-pulse" />;
      case 'camp_spin_win':
        return <Gift className="w-5 h-5 text-purple-400" />;
      case 'camp_durov_tribute':
        return <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />;
      default:
        return <Sparkles className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div id="watch-ads-view" className="space-y-4 px-4 py-4 max-w-lg mx-auto">
      
      {/* Monetag Active Status Banner */}
      {monetagConfig.isEnabled && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-emerald-400 font-mono tracking-wider">
              REAL MONETAG ENGINE ONLINE
            </span>
          </div>
          <span className="text-[9px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-black uppercase tracking-wider">
            Reward: 1.5x Boost
          </span>
        </div>
      )}

      {/* Main Play Screen / Active Ad Canvas */}
      {activeCampaign ? (
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 relative overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {/* Glowing Top Progress indicator */}
          <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400 transition-all duration-1000 shadow-sm" style={{ width: `${progress}%` }} />
          
          <div className="flex justify-between items-start mb-4 pt-1">
            <div>
              <span className="text-[9px] uppercase font-mono font-bold tracking-widest text-sky-400">
                Active Ad Task • {activeCampaign.type.toUpperCase()}
              </span>
              <h3 className="text-sm font-display font-bold text-white mt-0.5">{activeCampaign.title}</h3>
            </div>
            <div className="bg-white/5 px-2.5 py-1 rounded-xl border border-white/15 text-xs font-mono font-extrabold text-emerald-400">
              +${(monetagConfig.isEnabled ? activeCampaign.rewardAmount * 1.5 : activeCampaign.rewardAmount).toFixed(3)}
            </div>
          </div>

          {/* Interactive Simulated Video Screen */}
          <div className="bg-slate-950/80 aspect-[16/10] rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden p-4 group select-none">
            
            {/* Ad Content Playback Loop */}
            {isPlaying && (
              <div className="w-full h-full flex flex-col justify-between relative z-10">
                {/* 1. TON QUEST INTERACTIVE GRAPHICS */}
                {activeCampaign.id === 'camp_ton_quest' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center border-2 border-sky-300 shadow-xl animate-bounce">
                        <Smartphone className="w-8 h-8 text-white" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 bg-sky-400 text-slate-900 text-[8px] font-black px-1 rounded-full border border-sky-200">TON</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">TON Ecosystem Quest</h4>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Click connect to simulate Web3 wallet connection inside the Telegram sandbox!</p>
                    </div>
                    <button 
                      onClick={() => setTonWalletConnected(true)}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-extrabold tracking-wider uppercase transition-all ${
                        tonWalletConnected 
                          ? 'bg-emerald-500 text-slate-950 border border-emerald-300' 
                          : 'bg-sky-500 hover:bg-sky-400 text-white border border-sky-300 animate-pulse'
                      }`}
                    >
                      {tonWalletConnected ? '✓ TON Wallet Linked' : '🔗 Connect TON Wallet'}
                    </button>
                  </div>
                )}

                {/* 2. MONETAG NATIVE SMART REWARDS SLIDE */}
                {activeCampaign.id === 'camp_monetag_push' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2.5">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 text-emerald-400">
                      <Shield className="w-6 h-6 animate-pulse" />
                    </div>
                    
                    <div className="h-12 flex items-center justify-center">
                      {monetagStep === 0 && (
                        <div className="animate-in fade-in slide-in-from-right-3 text-[11px] text-slate-300">
                          <strong>High Fill Rate</strong>: Real monetized scripts payout maximum CPM instantly.
                        </div>
                      )}
                      {monetagStep === 1 && (
                        <div className="animate-in fade-in slide-in-from-right-3 text-[11px] text-slate-300">
                          <strong>No Interruptions</strong>: Users earn with clean, non-obtrusive, fast elements.
                        </div>
                      )}
                      {monetagStep === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-3 text-[11px] text-slate-300">
                          <strong>Easy Integration</strong>: Replace standard clips with your own custom Zone ID.
                        </div>
                      )}
                      {monetagStep === 3 && (
                        <div className="animate-in fade-in slide-in-from-right-3 text-[11px] text-slate-300 text-emerald-400 font-bold">
                          CPM multiplier is 1.5x when active!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. CLICKER GAME MINI PLAYABLE AD */}
                {activeCampaign.id === 'camp_crypto_clicker' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 relative">
                    <div className="absolute top-0 right-0 bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg text-[9px] font-mono text-amber-400 font-bold">
                      Coins Tapped: {clickerCount}
                    </div>

                    <p className="text-[10px] text-slate-400">Tap the Golden coin inside the ad preview to play!</p>
                    
                    <button 
                      onClick={handleSimulatedTap}
                      className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-yellow-500 rounded-full border-4 border-amber-300 shadow-2xl flex items-center justify-center text-slate-900 font-black text-2xl active:scale-90 hover:scale-105 transition-all outline-none focus:outline-none cursor-pointer relative"
                    >
                      🪙
                      
                      {/* Floating particles map */}
                      {clickParticles.map(p => (
                        <span 
                          key={p.id}
                          className="absolute text-[11px] font-black font-mono text-amber-300 animate-out fade-out slide-out-to-top-8 duration-700 pointer-events-none"
                          style={{ left: p.x - 10, top: p.y - 10 }}
                        >
                          +1
                        </span>
                      ))}
                    </button>
                    <span className="text-[8px] uppercase tracking-widest text-slate-500 font-mono font-bold animate-pulse">Tap active</span>
                  </div>
                )}

                {/* 4. SPIN WHEEL MINI PLAYABLE AD */}
                {activeCampaign.id === 'camp_spin_win' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                    <p className="text-[10px] text-slate-400">Spin the high-yield advertiser fortune wheel!</p>
                    
                    <div className="relative">
                      <div 
                        className="w-18 h-18 rounded-full border-4 border-purple-500 bg-slate-900 flex items-center justify-center font-bold text-base shadow-xl transition-transform duration-[3000ms] ease-out"
                        style={{ transform: `rotate(${wheelRotation}deg)` }}
                      >
                        <div className="absolute w-0.5 h-18 bg-purple-500/30" />
                        <div className="absolute h-0.5 w-18 bg-purple-500/30" />
                        <div className="absolute h-18 w-18 flex items-center justify-between text-[10px] px-2 font-mono">
                          <span>$5</span>
                          <span>$1</span>
                        </div>
                        <div className="absolute h-18 w-18 rotate-90 flex items-center justify-between text-[10px] px-2 font-mono">
                          <span>$10</span>
                          <span>$2</span>
                        </div>
                        <div className="w-5 h-5 bg-white rounded-full border border-purple-600 flex items-center justify-center text-[10px]">
                          ⭐
                        </div>
                      </div>
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45 border-b border-r border-slate-900" />
                    </div>

                    <button 
                      onClick={handleWheelSpin}
                      className="px-4 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-bold tracking-wider uppercase border border-purple-400 transition shadow active:scale-95"
                    >
                      Spin
                    </button>
                  </div>
                )}

                {/* 5. DUROV TRIBUTE Constellation */}
                {activeCampaign.id === 'camp_durov_tribute' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-yellow-500/30 flex items-center justify-center shadow-lg relative overflow-hidden animate-pulse">
                      <Star className="w-8 h-8 text-yellow-400 fill-current animate-pulse" />
                      <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-white tracking-wider font-display uppercase">Telegram Creator Stars</h4>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Digital tokens, premium services, and secure decentralized rewards.</p>
                    </div>
                  </div>
                )}

                {/* Stream Footer info & countdown timer */}
                <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono border-t border-white/5 pt-1.5">
                  <span>Advertiser: {activeCampaign.advertiserName}</span>
                  <div className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-emerald-400 font-bold">Remaining: {timeLeft}s</span>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Form after completed watching */}
            {isCompleted && (
              <div className="text-center z-10 w-full max-w-xs space-y-4 p-1 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle className="w-6 h-6 text-emerald-400 animate-bounce" />
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-sm font-display font-bold text-white">Ad Complete!</h4>
                  <p className="text-[11px] text-slate-300">Complete the calculation below to unlock your rewards immediately.</p>
                </div>

                <form onSubmit={handleVerifyAndClaim} className="space-y-3">
                  <div className="flex items-center justify-center space-x-3">
                    <span className="text-xs font-bold text-slate-300 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                      What is {correctAnswer - 3} + 3?
                    </span>
                    <input
                      type="number"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Answer"
                      className="w-20 text-center bg-slate-900 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-400"
                      required
                    />
                  </div>
                  {verificationError && (
                    <p className="text-[10px] text-rose-400 font-medium">Calculation incorrect. Please try again!</p>
                  )}
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer"
                  >
                    Claim Reward
                  </button>
                </form>
              </div>
            )}

            {/* Subtle background particle design */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/20 pointer-events-none" />
          </div>

          {/* Close overlay feed */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setActiveCampaign(null);
                setIsPlaying(false);
                setIsCompleted(false);
              }}
              className="text-slate-400 hover:text-white text-xs font-semibold px-4 py-2 hover:bg-white/5 rounded-xl transition"
            >
              Cancel Feed
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Main call to watch */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-900 border border-white/10 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
            
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-lg shadow-indigo-500/5">
              <Play className="w-8 h-8 text-sky-400 fill-current animate-pulse" />
            </div>
            
            <h2 className="text-base font-display font-bold text-white uppercase tracking-wider">Earning Channel</h2>
            <p className="text-xs text-slate-300 max-w-sm mx-auto mt-1 leading-relaxed font-light">
              Choose from our verified placements. Real live advertiser networks pay high-CPM rates based on format length.
            </p>
          </div>

          {/* Ad Campaign offers list */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-display font-bold text-slate-400 uppercase tracking-widest px-1">
              Verified Ad Placements
            </h3>

            <div className="space-y-2.5">
              {SIMULATED_AD_CAMPAIGNS.map((campaign) => {
                const finalReward = monetagConfig.isEnabled ? campaign.rewardAmount * 1.5 : campaign.rewardAmount;
                return (
                  <div
                    key={campaign.id}
                    className="bg-slate-900/40 hover:bg-slate-900/70 border border-white/5 hover:border-white/15 rounded-2xl p-4 flex items-center justify-between transition-all hover:translate-y-[-1px] group shadow"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-11 h-11 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shrink-0 group-hover:scale-105 transition-transform">
                        {getCampaignIcon(campaign.id)}
                      </div>
                      
                      <div className="truncate">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-white truncate max-w-[130px] md:max-w-[180px]">
                            {campaign.title}
                          </h4>
                          <span className="text-[8px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                            {campaign.durationSeconds}s
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-[180px] md:max-w-[220px]">
                          {campaign.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-black text-emerald-400">
                        +${finalReward.toFixed(2)}
                      </div>
                      <button
                        onClick={() => handleStartAd(campaign)}
                        aria-label={`Launch ${campaign.title} ad`}
                        className="mt-1.5 px-4 py-2.5 bg-white text-slate-950 font-black rounded-lg text-[11px] uppercase tracking-wider hover:bg-slate-200 active:scale-95 transition shadow cursor-pointer font-display"
                      >
                        Launch
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
