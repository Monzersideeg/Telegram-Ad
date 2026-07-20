import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export class HttpError extends Error {
  status: number;
  code: string;
  meta?: unknown;
  constructor(status: number, code: string, message?: string, meta?: unknown) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

/** Wrap async route handlers so rejections reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "not_found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, meta: err.meta });
    return;
  }
  logger.error("Unhandled error", err instanceof Error ? err.stack : String(err));
  res.status(500).json({ error: "internal_error" });
}
