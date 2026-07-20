/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Award, Wallet, Coins, Plus, Clock, CheckCircle2, ShieldAlert, AlertCircle, RefreshCw, Calendar, HelpCircle, Landmark } from 'lucide-react';
import { UserStats, PayoutRequest } from '../types';

interface PayoutsProps {
  stats: UserStats;
  payouts: PayoutRequest[];
  onAddPayout: (amount: number, currency: string, address: string) => void;
  onProcessPayouts: () => void;
}

export const Payouts: React.FC<PayoutsProps> = ({
  stats,
  payouts,
  onAddPayout,
  onProcessPayouts,
}) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'TON' | 'TRX' | 'USDT' | 'STARS' | 'PAYEER'>('TON');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

  const MIN_PAYOUT = 5.00;

  // Placeholder addresses based on currency selection to help users test
  const handleCurrencyChange = (val: 'TON' | 'TRX' | 'USDT' | 'STARS' | 'PAYEER') => {
    setCurrency(val);
    setError('');
    if (val === 'TON') {
      setAddress('EQBvW8Z65F79...');
    } else if (val === 'TRX' || val === 'USDT') {
      setAddress('TY7r3qS62f92...');
    } else if (val === 'STARS') {
      setAddress('stars_user_account');
    } else {
      setAddress('P1049583726');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount < MIN_PAYOUT) {
      setError(`Minimum payout amount is $${MIN_PAYOUT.toFixed(2)} USD.`);
      return;
    }

    if (numericAmount > stats.balance) {
      setError('Insufficient balance in your wallet account.');
      return;
    }

    if (!address.trim() || address.length < 5) {
      setError('Please provide a valid wallet address or payout account ID.');
      return;
    }

    // Submit request
    setIsSubmitting(true);
    setTimeout(() => {
      onAddPayout(numericAmount, currency, address);
      setIsSubmitting(false);
      setSuccess(true);
      setAmount('');
      setAddress('');
      setTimeout(() => setSuccess(false), 2000);
    }, 1200);
  };

  const triggerProcess = () => {
    setIsProcessingLocal(true);
    setTimeout(() => {
      onProcessPayouts();
      setIsProcessingLocal(false);
    }, 1500);
  };

  const getCurrencyLogo = (cur: string) => {
    switch (cur) {
      case 'TON': return '💎';
      case 'TRX': return '🔴';
      case 'USDT': return '🟢';
      case 'STARS': return '★';
      default: return '🏦';
    }
  };

  return (
    <div id="payouts-view" className="space-y-5 px-4 py-4 max-w-lg mx-auto">
      {/* Header Banner */}
      <div className="text-center space-y-1 py-1">
        <h2 className="text-base font-bold text-white flex items-center justify-center space-x-1.5">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <span>Withdraw Earnings</span>
        </h2>
        <p className="text-xs text-slate-400">
          Request payout of your available ad balance to crypto or stars.
        </p>
      </div>

      {/* Available Balance Big Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Available Balance</span>
          <div className="text-2xl font-mono font-black text-emerald-400">
            ${stats.balance.toFixed(2)}
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Min Payout Threshold</span>
          <div className="text-sm font-mono font-bold text-white mt-1">
            ${MIN_PAYOUT.toFixed(2)} USD
          </div>
        </div>
      </div>

      {/* Request Withdrawal Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
          <Plus className="w-4 h-4 mr-1 text-emerald-400" />
          New Payout Request
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Method Selection */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
              Select Payout Method
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['TON', 'TRX', 'USDT', 'STARS', 'PAYEER'] as const).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => handleCurrencyChange(cur)}
                  className={`py-2 text-center text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    currency === cur
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs">{getCurrencyLogo(cur)}</span>
                  <span className="text-[9px] font-mono">{cur}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount and Address input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500 text-xs font-mono">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="5.00"
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl pl-6 pr-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Wallet Address / ID
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter Address"
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 flex items-start space-x-2 text-red-400 text-[10.5px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center space-x-2 text-emerald-400 text-[10.5px]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Withdrawal requested! Marked as **Pending**.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md transition active:scale-95 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Landmark className="w-4 h-4" />
                <span>Submit Withdrawal Request</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* History panel with Admin Simulator Button */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Request History ({payouts.length})
          </h3>

          {/* Simulate Process Payouts Admin Trigger */}
          {payouts.some(p => p.status === 'Pending') && (
            <button
              onClick={triggerProcess}
              disabled={isProcessingLocal}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 font-bold rounded-lg text-[9px] flex items-center space-x-1 transition cursor-pointer border border-slate-700/50"
            >
              <RefreshCw className={`w-3 h-3 ${isProcessingLocal ? 'animate-spin' : ''}`} />
              <span>Simulate Pay Out</span>
            </button>
          )}
        </div>

        {/* History rows */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 shadow">
          {payouts.length === 0 ? (
            <div className="p-6 text-center text-slate-500 space-y-1">
              <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-xs font-medium">No payout requested yet</div>
              <p className="text-[10px]">Your cashout requests will accumulate and display here.</p>
            </div>
          ) : (
            [...payouts].reverse().map((pay) => (
              <div key={pay.id} className="p-3.5 flex items-center justify-between hover:bg-slate-800/10 transition-colors">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center font-bold text-sm">
                    {getCurrencyLogo(pay.currency)}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>${pay.amount.toFixed(2)} USD</span>
                      <span className="text-[10px] text-slate-400 font-mono">({pay.currency})</span>
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono truncate max-w-[170px]">
                      Dest: {pay.address}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end space-y-1">
                  <span className="text-[9px] text-slate-500 font-mono flex items-center">
                    <Calendar className="w-2.5 h-2.5 mr-0.5" />
                    {pay.requestDate}
                  </span>
                  <span
                    className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      pay.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : pay.status === 'Pending'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {pay.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Security Disclaimer */}
      <div className="bg-slate-950/40 rounded-2xl p-3 border border-slate-800/60 flex items-start space-x-2">
        <ShieldAlert className="w-4 h-4 text-amber-500/80 shrink-0 mt-0.5" />
        <div className="text-[10px] text-slate-400 leading-relaxed">
          <span className="font-semibold text-slate-300">Audited System Integrity:</span> All withdrawal transaction hashes are logged securely to the server. Payouts are usually processed within 24 hours of submission.
        </div>
      </div>
    </div>
  );
};
