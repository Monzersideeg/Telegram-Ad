/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Award, Wallet, DollarSign, Send, CheckCircle, HelpCircle, 
  AlertCircle, RefreshCw, Layers, Sparkles, Star, Coins 
} from 'lucide-react';
import { PayoutRequest, AppConfig } from '../types';

interface PayoutProps {
  balance: number;
  payoutHistory: PayoutRequest[];
  onSubmitPayout: (amount: number, currency: string, address: string) => void;
  onSimulateApprove: (id: string) => void;
  appConfig: AppConfig;
}

type AllowedCurrency = 'TON' | 'USDT' | 'BTC' | 'TRX' | 'STARS' | 'PAYEER';

// Asset configurations for the gorgeous clickable card select
const BASE_ASSETS: { key: AllowedCurrency; name: string; tag: string; desc: string; icon: string; estTime: string }[] = [
  {
    key: 'TON',
    name: 'TON Network',
    tag: 'Toncoin',
    desc: 'Native Telegram gas',
    icon: '💎',
    estTime: 'Instant',
  },
  {
    key: 'USDT',
    name: 'USDT TRC-20',
    tag: 'Stablecoin',
    desc: '1:1 dollar parity',
    icon: '💵',
    estTime: '5-15m',
  },
  {
    key: 'BTC',
    name: 'Bitcoin Network',
    tag: 'BTC Core',
    desc: 'Digital gold standard',
    icon: '🪙',
    estTime: '15-60m',
  },
  {
    key: 'TRX',
    name: 'TRX Wallet',
    tag: 'TRON Gas',
    desc: 'Fast, minimal fees',
    icon: '🎈',
    estTime: 'Instant',
  },
  {
    key: 'STARS',
    name: 'TG Stars',
    tag: '★ Token',
    desc: 'Platform currencies',
    icon: '⭐',
    estTime: 'Instant',
  },
  {
    key: 'PAYEER',
    name: 'Payeer Port',
    tag: 'Fiat/Crypto',
    desc: 'Direct global payout',
    icon: '💼',
    estTime: 'Instant',
  },
];

export const Payout: React.FC<PayoutProps> = ({
  balance,
  payoutHistory,
  onSubmitPayout,
  onSimulateApprove,
  appConfig,
}) => {
  // Dynamically filter and map assets based on appConfig
  const assets = BASE_ASSETS
    .filter(asset => appConfig.allowedCurrencies.includes(asset.key))
    .map(asset => ({
      ...asset,
      minAmount: appConfig.minWithdrawal,
    }));

  // Fallback to avoid empty array issues if admin disables all
  const activeAssets = assets.length > 0 ? assets : [{
    key: 'TON' as AllowedCurrency,
    name: 'TON Network',
    tag: 'Toncoin',
    desc: 'Native Telegram gas',
    icon: '💎',
    minAmount: appConfig.minWithdrawal,
    estTime: 'Instant',
  }];

  const [currency, setCurrency] = useState<AllowedCurrency>(activeAssets[0].key);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const selectedAsset = activeAssets.find(a => a.key === currency) || activeAssets[0];
  const minWithdrawal = selectedAsset.minAmount;
  const progressToMin = Math.min((balance / minWithdrawal) * 100, 100);

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid numeric amount.');
      return;
    }

    if (parsedAmount < minWithdrawal) {
      setErrorMsg(`Minimum withdrawal threshold is $${minWithdrawal.toFixed(2)} (${Math.round(minWithdrawal * appConfig.usdToCoinRate).toLocaleString()} ${appConfig.currencySymbol}).`);
      return;
    }

    if (parsedAmount > balance) {
      setErrorMsg(`Insufficient funds. Your active balance is $${balance.toFixed(2)} (${Math.round(balance * appConfig.usdToCoinRate).toLocaleString()} ${appConfig.currencySymbol}).`);
      return;
    }

    if (address.trim().length < 5) {
      setErrorMsg('Please input a valid destination address or account detail.');
      return;
    }

    onSubmitPayout(parsedAmount, currency, address);
    setSuccessMsg(`Withdrawal requested successfully! ${Math.round(parsedAmount * 1000).toLocaleString()} ACN has been queued.`);
    setAmount('');
    setAddress('');
  };

  return (
    <div id="payout-view" className="scroll-area flex-1 overflow-y-auto pb-28 px-5 pt-3 space-y-4">
      
      {/* Withdrawable Balance card with custom visual goal indicator */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Withdrawable Balance</span>
            <div className="text-xl font-extrabold text-emerald-600 mt-0.5">
              {Math.round(balance * appConfig.usdToCoinRate).toLocaleString()} {appConfig.currencySymbol}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">≈ ${balance.toFixed(2)} USD</div>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Min Threshold</span>
            <div className="text-sm font-extrabold text-slate-800 mt-0.5">
              {Math.round(minWithdrawal * appConfig.usdToCoinRate).toLocaleString()} {appConfig.currencySymbol}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">≈ ${minWithdrawal.toFixed(2)} USD</div>
          </div>
        </div>

        {/* Withdrawal limit progress meter */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100">
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold font-mono uppercase">
            <span>Progress to cashout limit</span>
            <span>{progressToMin.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full border border-slate-200/40 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-1000" 
              style={{ width: `${progressToMin}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 leading-none block font-light">
            {balance >= minWithdrawal 
              ? "🎉 You have achieved the minimum withdraw limit. You are eligible to cashout!"
              : `Accumulate ${Math.round((minWithdrawal - balance) * appConfig.usdToCoinRate).toLocaleString()} more ${appConfig.currencySymbol} to authorize secure withdrawal checkout.`
            }
          </span>
        </div>
      </div>

      {/* Main secure payment checkout portal form */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
          <Wallet className="w-4.5 h-4.5 text-emerald-500 mr-2" />
          Request Secure Checkout
        </h3>

        {errorMsg && (
          <div role="alert" className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3.5 py-2.5 rounded-2xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs px-3.5 py-2.5 rounded-2xl flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleWithdraw} className="space-y-4">
          
          {/* Visual Asset Selector Cards Grid */}
          <div className="space-y-2">
            <span id="asset-label" className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">
              Select Withdrawal Asset
            </span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="asset-label">
              {activeAssets.map((asset) => {
                const isSelected = currency === asset.key;
                return (
                  <button
                    key={asset.key}
                    type="button"
                    onClick={() => {
                      setCurrency(asset.key);
                      setAddress('');
                    }}
                    aria-pressed={isSelected}
                    aria-label={`${asset.name}${isSelected ? ' (selected)' : ''}`}
                    className={`rounded-2xl p-3 border text-left transition flex flex-col justify-between h-[90px] cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 scale-[1.01] shadow-sm' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">{asset.name.split(' ')[0]}</span>
                      <span className="text-sm">{asset.icon}</span>
                    </div>
                    <div>
                      <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono leading-none font-bold">
                        <span>{asset.tag}</span>
                        <span className="opacity-90 bg-emerald-100 text-emerald-800 px-1 rounded-sm text-[7px]">Min: ${asset.minAmount}</span>
                      </div>
                      <div className="text-[9px] font-light text-slate-500 mt-1.5 truncate leading-tight w-full">{asset.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {/* Displaying selected Asset detail */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 flex flex-col justify-between">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Checkout Asset</span>
              <div className="text-xs font-extrabold text-emerald-600 mt-1">{currency} Token</div>
              <span className="text-[8px] text-slate-400 mt-1 block">Est. Time: {selectedAsset.estTime}</span>
            </div>

            {/* Withdraw Amount widget */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-2.5 flex flex-col justify-between">
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                <label htmlFor="withdraw-amount">Amount ($ USD)</label>
                <button
                  type="button"
                  onClick={() => setAmount(balance.toFixed(2))}
                  aria-label="Set maximum amount"
                  className="text-emerald-600 hover:underline font-extrabold font-mono text-[11px] uppercase cursor-pointer px-1.5 py-0.5 -mr-1.5 rounded"
                >
                  Max
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-slate-500 text-xs font-mono font-bold" aria-hidden="true">$</span>
                <input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  aria-label="Withdrawal amount in USD"
                  className="w-full text-sm bg-transparent border-none text-slate-800 font-mono p-0 font-extrabold"
                  required
                />
              </div>
            </div>
          </div>

          {/* Destination Address details */}
          <div className="space-y-1.5">
            <label htmlFor="withdraw-address" className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">
              Destination Address Details ({currency})
            </label>
            <input
              id="withdraw-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              aria-label={`Destination ${currency} address`}
              aria-describedby="withdraw-address-hint"
              placeholder={
                currency === 'TON' ? 'UQBx_... (TON Wallet Address)' :
                currency === 'USDT' ? 'T... (TRC-20 Address)' :
                currency === 'TRX' ? 'T... (TRON Wallet Address)' :
                currency === 'BTC' ? '1... or bc1... (Bitcoin Wallet Address)' :
                currency === 'PAYEER' ? 'P1023847... (Payeer Account)' : 'Telegram username or ID'
              }
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-800 font-mono focus:ring-1 focus:ring-emerald-500"
              required
            />
            <span id="withdraw-address-hint" className="text-[11px] text-slate-500 leading-relaxed font-light mt-1.5 block">
              Double check destination parameters. Web3 transactions are permanent and cannot be reversed or refunded. Payments are processed in batches hourly.
            </span>
          </div>

          {/* Checkout transaction submit */}
          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow shadow-emerald-500/15 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Confirm & Withdraw Funds</span>
          </button>
        </form>
      </div>

      {/* Payout history transaction logs */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
          <span>Withdrawal Requests ({payoutHistory.length})</span>
          <span>Status</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
          {payoutHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-1">
              <Wallet className="w-10 h-10 text-slate-300 mx-auto opacity-40 mb-2" />
              <div className="text-xs font-semibold">No withdrawals requested</div>
              <p className="text-[10px] text-slate-400 font-light">
                Minimum withdraw is $5.00 USD (5,000 ACN).
              </p>
            </div>
          ) : (
            payoutHistory.map((payout) => (
              <div key={payout.id} className="p-4 flex flex-col space-y-2.5 hover:bg-slate-50/60 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-extrabold text-slate-800">
                      {Math.round(payout.amount * 1000).toLocaleString()} ACN
                    </span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                      {payout.currency}
                    </span>
                  </div>
                  
                  {/* Status label indicators */}
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        payout.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                          : payout.status === 'Rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-150'
                          : 'bg-amber-50 text-amber-700 border-amber-150'
                      }`}
                    >
                      {payout.status}
                    </span>

                    {/* Developer Mock Approvals trigger */}
                    {payout.status === 'Pending' && (
                      <button
                        onClick={() => onSimulateApprove(payout.id)}
                        className="text-[9px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-0.5 rounded flex items-center gap-0.5 transition cursor-pointer"
                        title="Simulate block verification and credit"
                      >
                        <RefreshCw className="w-2.5 h-2.5 mr-0.5 animate-spin" />
                        <span>Confirm</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono font-bold">
                  <span className="truncate max-w-[190px]" title={payout.address}>
                    Addr: {payout.address.slice(0, 8)}...{payout.address.slice(-6)}
                  </span>
                  <span>{payout.requestDate.split('T')[0]}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
