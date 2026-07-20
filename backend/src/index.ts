import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { adsRouter } from "./routes/ads.js";
import { postbackRouter } from "./routes/postback.js";
import { ledgerRouter } from "./routes/ledger.js";
import { referralsRouter } from "./routes/referrals.js";
import { withdrawalsRouter } from "./routes/withdrawals.js";
import { adminRouter } from "./routes/admin.js";
import { usersRouter } from "./routes/users.js";
import { gamesRouter } from "./routes/games.js";
import { devRouter } from "./routes/dev.js";

const app = express();

app.set("trust proxy", true); // needed for correct req.ip behind Railway/Render/Vercel
app.use(helmet());
app.use(
  cors({
    origin: [env.frontendUrl, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
app.use(cookieParser());

// Simple request log
app.use((req, _res, next) => {
  if (req.path !== "/health") logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRouter);
app.use("/api/ads", adsRouter);
app.use("/api/postback", postbackRouter);
app.use("/api/ledger", ledgerRouter);
app.use("/api/referrals", referralsRouter);
app.use("/api/withdrawals", withdrawalsRouter);
app.use("/api/users", usersRouter);
app.use("/api", gamesRouter);
app.use("/api/admin", adminRouter);

// Dev-only postback simulator (never mounted in production).
if (env.nodeEnv === "development") {
  app.use("/api/dev", devRouter);
  logger.warn("Dev routes enabled (/api/dev) — do not use in production");
}

app.use(notFoundHandler);
app.use(errorHandler);

export { app };

// Start listening when run as a normal server. On Vercel (serverless), VERCEL is set
// and the exported `app` is used as the request handler instead (see api/[...path].ts).
// Tests import { app } with START_SERVER=false and bind their own ephemeral port.
if (!process.env.VERCEL && process.env.START_SERVER !== "false") {
  app.listen(env.port, () => {
    logger.info(`API listening on :${env.port} (${env.nodeEnv})`);
  });
}
