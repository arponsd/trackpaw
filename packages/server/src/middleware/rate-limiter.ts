import type { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  enabled?: boolean;
  windowMs?: number;
  maxRequests?: number;
  maxEventsPerBatch?: number;
  keyGenerator?: (req: Request) => string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export function rateLimiter(config: RateLimitConfig = {}) {
  const enabled = config.enabled ?? true;
  const windowMs = config.windowMs ?? 60000;
  const maxRequests = config.maxRequests ?? 100;
  const keyGen = config.keyGenerator ?? ((req: Request) => req.ip || 'unknown');
  const windows = new Map<string, WindowEntry>();

  // Periodic cleanup
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (now > entry.resetAt) windows.delete(key);
    }
  }, windowMs);
  cleanup.unref?.();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enabled) { next(); return; }

    const key = keyGen(req);
    const now = Date.now();

    let entry = windows.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: `Too many requests. Try again in ${retryAfter} seconds.`,
        status: 429,
        retryAfter,
      });
      return;
    }

    next();
  };
}
