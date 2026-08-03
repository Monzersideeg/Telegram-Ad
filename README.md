# AcEarn Telegram Mini App

AcEarn is a Telegram Mini App where users watch AdsGram rewarded ads, complete AdsGram task ads, keep streaks, invite friends, and withdraw ACN coins.

## Ads

The app is AdsGram-only:

- Rewarded ads: large green WATCH AD button.
- Interstitial ads: shown at natural app transitions.
- Task ads: rendered through `<adsgram-task>` below the watch button.

Rewards are credited server-side only after the AdsGram SDK confirms completion and the backend validates the session.
