// Vercel serverless entry point.
//
// This catch-all route forwards every /api/* request to the Express app. The app is
// imported from the compiled `dist/` (produced by `npm run build`), which Vercel runs
// as the Build Command before bundling this function — this sidesteps esbuild's
// inability to resolve the ESM `.js`-extension imports used throughout src/.
//
// All backend routes live under /api (auth, ads, postback, ledger, withdrawals, games,
// admin), so this single catch-all handles the entire API, including the Monetag
// S2S postback at /api/postback/monetag.
import { app } from "../dist/index.js";

export default app;
