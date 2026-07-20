/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum AdType {
  VIDEO = 'video',
  INTERSTITIAL = 'interstitial',
  POPUNDER = 'popunder',
  BANNER = 'banner',
}

export interface UserStats {
  balance: number;
  lifetimeEarnings: number;
  adsWatchedCount: number;
  referralCount: number;
  referralEarnings: number;
  totalPayouts: number;
}

export interface MonetagConfig {
  smartlinkUrl: string;
  popunderZoneId: string;
  inPagePushZoneId: string;
  interstitialZoneId: string;
  isEnabled: boolean;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  currency: 'TRX' | 'TON' | 'USDT' | 'STARS' | 'PAYEER' | 'BTC';
  address: string;
  requestDate: string;
  status: 'Pending' | 'Completed' | 'Rejected';
}

export interface ReferredFriend {
  id: string;
  username: string;
  fullName: string;
  joinDate: string;
  totalEarned: number;
  commissionContributed: number;
}

export interface LeaderboardUser {
  rank: number;
  username: string;
  fullName: string;
  avatarSeed: string;
  totalEarned: number;
  referralCount: number;
  activeReferralCount: number;
  isCurrentUser?: boolean;
}

export interface AdCampaign {
  id: string;
  title: string;
  description: string;
  type: AdType;
  rewardAmount: number;
  durationSeconds: number;
  cpmValue: number;
  advertiserName: string;
  iconName: string;
}

export interface AppConfig {
  appName: string;
  appDescription: string;
  currencySymbol: string;
  usdToCoinRate: number; // e.g. 1000
  enableTasks: boolean;
  enableFriends: boolean;
  enableArena: boolean;
  enableWallet: boolean;
  enableCaptcha: boolean;
  joinTelegramReward: number; // in USD
  watch10AdsReward: number; // in USD
  invite3FriendsReward: number; // in USD
  minWithdrawal: number; // in USD
  allowedCurrencies: ('TRX' | 'TON' | 'USDT' | 'STARS' | 'PAYEER' | 'BTC')[];
}

export interface AdWatchLog {
  id: string;
  campaignId: string;
  title: string;
  reward: number;
  timestamp: string;
}
