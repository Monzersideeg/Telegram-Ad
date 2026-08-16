# Deployment

Deploy `backend/` to the API Vercel project and `frontend/` to the web Vercel project.

Required Monetag variables:

- `MONETAG_ZONE_ID=11590144`
- `MONETAG_POSTBACK_SECRET`

Postback URL template:

```text
https://acearn-api.vercel.app/api/postback/monetag?secret=YOUR_SECRET&ymid={ymid}&event={event_type}&value={reward_event_type}&price={estimated_price}&telegram_id={telegram_id}
```
