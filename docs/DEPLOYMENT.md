# Deployment

Deploy `backend/` to the API Vercel project and `frontend/` to the web Vercel project.

Required Monetag variables:

- `MONETAG_ZONE_ID=11590144`
- `MONETAG_POSTBACK_SECRET`

Supported Monetag formats in the app:

- Rewarded Interstitial: SDK type `end`, session passed as `ymid`.
- Rewarded Popup: SDK type `pop`, session passed as `ymid`.
- In-app Interstitial: SDK type `inApp` with capping/frequency settings; no coin reward.

Postback URL template to paste in Monetag:

```text
https://acearn-api.vercel.app/api/postback/monetag?secret=YOUR_SECRET&ymid={ymid}&event={event_type}&value={reward_event_type}&price={estimated_price}&telegram_id={telegram_id}&source={request_var}
```
