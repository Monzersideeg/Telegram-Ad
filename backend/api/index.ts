/// <reference path="./dist.d.ts" />
// Vercel serverless entry point (single entry).
//
// All requests are forwarded here by the vercel.json rewrite (/(.*) -> /api), and
// the Express app handles all routing internally (/api/auth/me, /api/postback/monetag,
// /api/health, etc.). The app is imported from the compiled dist/ (built by `npm run build`).
import { app } from "../dist/index.js";

export default app;
