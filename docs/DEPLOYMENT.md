# Deployment

Deploy `backend/` to the API Vercel project and `frontend/` to the web Vercel project.

Required backend ad variables:

- `ADSGRAM_REWARD_BLOCK_ID` — rewarded block for the WATCH AD button.
- `ADSGRAM_INTERSTITIAL_BLOCK_ID` — interstitial block, usually `int-xxx`.
- `ADSGRAM_TASK_BLOCK_ID` — task block, usually `task-xxx`.
- `ADSGRAM_TASK_REWARD` — coins credited when the task emits `reward`.

Also configure Telegram, database, economy, and admin variables from `.env.example`.
