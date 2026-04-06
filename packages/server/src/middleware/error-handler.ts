import type { Request, Response, NextFunction } from 'express';

export function errorHandler() {
  return (err: any, _req: Request, res: Response, _next: NextFunction): void => {
    const status = err.status || err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'An unexpected error occurred';

    res.status(status).json({
      error: code,
      message,
      status,
      details: err.details || undefined,
    });
  };
}
