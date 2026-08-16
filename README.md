# AcEarn Telegram Mini App

AcEarn uses Monetag ad formats:

- Rewarded Interstitial: main WATCH AD flow.
- Rewarded Popup: alternates with rewarded interstitial on WATCH AD.
- In-app Interstitial: initialized automatically with safe capping/frequency.

Coins are credited only after the backend receives a valid Monetag S2S postback for the watch session.
