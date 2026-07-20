type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, msg: string, meta?: unknown) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta !== undefined ? { meta } : {}),
  };
  // eslint-disable-next-line no-console
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

export const logger = {
  debug: (m: string, meta?: unknown) => log("debug", m, meta),
  info: (m: string, meta?: unknown) => log("info", m, meta),
  warn: (m: string, meta?: unknown) => log("warn", m, meta),
  error: (m: string, meta?: unknown) => log("error", m, meta),
};
