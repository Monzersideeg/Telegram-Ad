/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, Copy, Check, UserPlus, Gift, TrendingUp, Calendar, 
  Coins, ArrowUpRight, Share2, Sparkles, Award 
} from 'lucide-react';
// (framer-motion removed — replaced the copy toast with a plain CSS transition for performance)
import { ReferredFriend } from '../types';
import { ReferralChart } from './ReferralChart';
import { playClickSound } from '../utils/soundEffects';

interface ReferralsProps {
  friends: ReferredFriend[];
  referralCode: string;
  referralEarnings: number;
}

export const Referrals: React.FC<ReferralsProps> = ({
  friends,
  referralCode,
  referralEarnings,
}) => {
  const [copied, setCopied] = useState(false);
  const inviteLink = referralCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    playClickSound();
    setTimeout(() => setCopied(false), 2000);
  };

  // Milestone bonus calculation (e.g. refer 5 friends)
  const milestoneTarget = 5;
  const milestonePercent = Math.min((friends.length / milestoneTarget) * 100, 100);

  return (
    <div id="referrals-view" className="scroll-area flex-1 overflow-y-auto pb-28 px-5 pt-3 space-y-4">
      
      {/* Referral Hero Panel (Vibrant light emerald design) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 relative overflow-hidden shadow-sm">
        <div className="absolute top-[-30px] right-[-30px] w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative space-y-3.5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <Gift className="w-5.5 h-5.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Invite friends & earn</h2>
              <p className="text-[10px] text-slate-400">Receive 10% lifetime commission from all their ad views</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed font-light">
            Build your passive income pool. When someone joins through your invitation link, <strong className="text-emerald-600 font-bold">10%</strong> of all their ad watched rewards is instantly credited to your wallet in real-time, forever.
          </p>

          {/* Copy Invite Link Input Widget */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                Your Personal Invite Link
              </span>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 flex items-center justify-between gap-2">
                <code className="text-[10px] text-emerald-700 truncate font-mono select-all flex-1 pl-1.5 font-bold">
                  {inviteLink}
                </code>
                <button
                  onClick={handleCopy}
                  aria-label="Copy your invite link"
                  className={`px-3 py-2.5 rounded-lg transition shrink-0 cursor-pointer text-xs font-bold flex items-center space-x-1 ${
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Prominent Dual Invite & Share Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <a
                id="share-telegram-btn"
                href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent("🚀 Join AcEarn! Watch rewarded ads, spin the daily wheel, and earn real ACN rewards instantly! 💎🎁")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playClickSound()}
                className="py-3 bg-[#24A1DE] hover:bg-[#208bbf] active:scale-[0.98] text-white font-extrabold rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider text-center"
              >
                <Share2 className="w-4 h-4 text-white" />
                <span>Invite Friends</span>
              </a>
              <button
                id="copy-referral-link-btn"
                onClick={handleCopy}
                className="py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-extrabold rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
              >
                {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Workflow Steps */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-3">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Three Easy Steps to passive rewards
        </h3>
        
        <div className="grid grid-cols-3 gap-2 text-center relative">
          <div className="bg-slate-50/50 rounded-2xl p-2.5 border border-slate-100">
            <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-[11px] font-extrabold mx-auto mb-1.5 border border-emerald-100">
              1
            </div>
            <h4 className="text-[9px] font-bold text-slate-800">Share Link</h4>
            <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">Send invitation to channels or chats</p>
          </div>

          <div className="bg-slate-50/50 rounded-2xl p-2.5 border border-slate-100">
            <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-[11px] font-extrabold mx-auto mb-1.5 border border-emerald-100">
              2
            </div>
            <h4 className="text-[9px] font-bold text-slate-800">Watch Ads</h4>
            <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">Your friend watches simple ad campaigns</p>
          </div>

          <div className="bg-slate-50/50 rounded-2xl p-2.5 border border-slate-100">
            <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[11px] font-extrabold mx-auto mb-1.5">
              3
            </div>
            <h4 className="text-[9px] font-bold text-emerald-600">Earn 10%</h4>
            <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">Get coins credited into your ledger balance</p>
          </div>
        </div>
      </div>

      {/* Referral Milestone Multiplier Goal Card */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-1.5">
            <Award className="w-4.5 h-4.5 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Milestone Rewards</h3>
          </div>
          <span className="text-[9px] bg-amber-50 border border-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-mono font-bold">
            Bonus unlocked at 5 refs
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold font-mono">
            <span>Invite {milestoneTarget} Friends</span>
            <span className="text-amber-600 font-bold">{friends.length} / {milestoneTarget}</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all duration-1000" 
              style={{ width: `${milestonePercent}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 leading-relaxed font-light">
            {friends.length >= milestoneTarget
              ? "🎉 Gold Milestone Reached! You have unlocked a permanent commission booster!"
              : `Refer ${milestoneTarget - friends.length} more friend(s) to unlock a +200 ACN direct milestone bonus.`
            }
          </p>
        </div>
      </div>

      {/* Dual Referral Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-sm">
          <div className="flex justify-center mb-1">
            <Users className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div className="text-lg font-extrabold text-slate-800 font-mono">{friends.length}</div>
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Total Invited</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-sm">
          <div className="flex justify-center mb-1">
            <Coins className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div className="text-lg font-extrabold text-emerald-600 font-mono">{Math.round(referralEarnings * 1000)}</div>
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">ACN Earned</div>
        </div>
      </div>

      {/* 30-Day New Referral Signups Trend Chart */}
      <ReferralChart friends={friends} />

      {/* Referred Friends Feed */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
          <span>Referred Friends ({friends.length})</span>
          <span>10% Share</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
          {friends.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Users className="w-9 h-9 text-slate-300 mx-auto" />
              <div className="text-xs font-semibold">No referrals yet</div>
              <p className="text-[10px] max-w-xs mx-auto text-slate-400 leading-relaxed font-light">
                Share your invite link above — when friends join and watch ads, you earn 10% of their rewards, for life.
              </p>
            </div>
          ) : (
            friends.map((friend) => (
              <div key={friend.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center font-extrabold text-white text-xs shrink-0 shadow-sm">
                    {friend.fullName.split(' ').map(n => n[0]).join('') || 'TG'}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{friend.fullName}</span>
                      <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-mono font-bold">
                        {friend.joinDate}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">@{friend.username}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-slate-800">
                    Total Earned: {Math.round(friend.totalEarned * 1000)} ACN
                  </div>
                  <div className="text-[10px] text-emerald-600 font-extrabold font-mono flex items-center justify-end gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{Math.round(friend.commissionContributed * 1000)} ACN
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Copy confirmation toast (plain CSS — no animation library) */}
      {copied && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-xl shadow-emerald-500/20 flex items-center space-x-2.5 border border-slate-800 text-xs font-bold tracking-wide pointer-events-none whitespace-nowrap transition-all duration-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow shadow-emerald-500/30">
            <Check className="w-3.5 h-3.5 stroke-[3.5]" />
          </div>
          <span>Referral link copied successfully!</span>
        </div>
      )}
    </div>
  );
};
