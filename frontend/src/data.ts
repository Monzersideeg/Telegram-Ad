/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdCampaign, AdType, LeaderboardUser, ReferredFriend } from './types';

export const SIMULATED_AD_CAMPAIGNS: AdCampaign[] = [
  {
    id: 'camp_ton_quest',
    title: 'Toncoin Web3 Quest',
    description: 'Explore the TON Ecosystem and claim a dynamic reward multiplier.',
    type: AdType.VIDEO,
    rewardAmount: 0.15,
    durationSeconds: 15,
    cpmValue: 10.0,
    advertiserName: 'TON Ecosystem Foundation',
    iconName: 'Sparkles',
  },
  {
    id: 'camp_monetag_push',
    title: 'Monetag Smart Rewards',
    description: 'Learn how the Monetag ad system works and boost your CPM rate.',
    type: AdType.VIDEO,
    rewardAmount: 0.25,
    durationSeconds: 30,
    cpmValue: 12.50,
    advertiserName: 'Monetag Media Ads',
    iconName: 'Tv',
  },
  {
    id: 'camp_crypto_clicker',
    title: 'Telegram Clicker Game Promo',
    description: 'A quick 10-second interactive ad showcasing the new viral tap game.',
    type: AdType.INTERSTITIAL,
    rewardAmount: 0.08,
    durationSeconds: 10,
    cpmValue: 8.0,
    advertiserName: 'TapToRich Studio',
    iconName: 'Coins',
  },
  {
    id: 'camp_spin_win',
    title: 'Instant Fortune Wheel ad',
    description: 'Simulate a classic Monetag Popunder ad to instantly credited payouts.',
    type: AdType.POPUNDER,
    rewardAmount: 0.05,
    durationSeconds: 5,
    cpmValue: 5.0,
    advertiserName: 'SpinWheel Gaming Corp',
    iconName: 'TrendingUp',
  },
  {
    id: 'camp_durov_tribute',
    title: 'Telegram Stars Ecosystem',
    description: 'A 20-second premium reward clip about digital content and stars.',
    type: AdType.VIDEO,
    rewardAmount: 0.20,
    durationSeconds: 20,
    cpmValue: 9.50,
    advertiserName: 'Telegram Creator Fund',
    iconName: 'Star',
  }
];

export const MOCK_LEADERBOARD_USERS: LeaderboardUser[] = [
  { rank: 1, username: 'durov_fans', fullName: 'Pavel Enthusiast', avatarSeed: 'durov', totalEarned: 245.80, referralCount: 158, activeReferralCount: 124 },
  { rank: 2, username: 'ton_whale', fullName: 'TON Whale Account', avatarSeed: 'whale', totalEarned: 189.50, referralCount: 94, activeReferralCount: 78 },
  { rank: 3, username: 'ad_slayer', fullName: 'Alex Mercer', avatarSeed: 'slayer', totalEarned: 142.20, referralCount: 57, activeReferralCount: 45 },
  { rank: 4, username: 'monetag_king', fullName: 'Dave Gold', avatarSeed: 'king', totalEarned: 115.65, referralCount: 42, activeReferralCount: 38 },
  { rank: 5, username: 'crypto_earn', fullName: 'Evelyn Crypto', avatarSeed: 'earn', totalEarned: 94.30, referralCount: 31, activeReferralCount: 22 },
  { rank: 6, username: 'tg_stars_guy', fullName: 'Stars Collector', avatarSeed: 'stars', totalEarned: 78.40, referralCount: 19, activeReferralCount: 15 },
  { rank: 7, username: 'tap_tap_tap', fullName: 'Finger Warrior', avatarSeed: 'tapper', totalEarned: 64.15, referralCount: 12, activeReferralCount: 8 },
];

export const MOCK_REFERRED_FRIENDS: ReferredFriend[] = [
  {
    id: 'friend_1',
    username: 'cryptoboy_tg',
    fullName: 'Crypto Boy TG',
    joinDate: '2026-07-01',
    totalEarned: 35.50,
    commissionContributed: 3.55
  },
  {
    id: 'friend_2',
    username: 'ton_farmer',
    fullName: 'TON Farmer',
    joinDate: '2026-07-03',
    totalEarned: 18.20,
    commissionContributed: 1.82
  },
  {
    id: 'friend_3',
    username: 'ad_watcher_pro',
    fullName: 'Samantha Sparks',
    joinDate: '2026-07-05',
    totalEarned: 8.40,
    commissionContributed: 0.84
  }
];

export const MONETAG_INTEGRATION_GUIDE = `
### How to connect your Real Monetag Ad Account

Monetag is a leading ad network for publishers. Integrating it with your Telegram Mini App is simple and can turn your traffic into serious income!

1. **Sign Up at Monetag**
   Create a publisher account at [Monetag.com](https://monetag.com/).

2. **Add Your Web Site/App Domain**
   - Head to the **Sites** tab and add your web application domain (e.g. your hosted web URL or \`telegram.org\`).
   - If deploying inside Telegram, you can use **Smartlink** ads directly which do not require site validation.

3. **Generate Zone IDs**
   Inside the Monetag portal, click **Add Zone** on your site/smartlink. Select your desired formats:
   - **Smartlink**: Direct high-CPM redirection link.
   - **Popunder**: Background tab ads.
   - **In-Page Push**: Sleek push banner ads that fit inside the container.
   - **Vignette / Interstitial**: High-value overlays.

4. **Paste Zone IDs in the Settings Menu**
   Click the **Gear icon (⚙️)** in the app header and paste your actual direct Smartlink URL or Zone Script tags.
   Once enabled, real live ads will be loaded in your app container alongside simulated test ads, letting you earn real-world revenue!
`;
