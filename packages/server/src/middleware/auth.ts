import type { Request, Response, NextFunction } from 'express';

export type Permission = 'write' | 'read' | 'admin';

export interface AuthConfig {
  apiKey?: string;
  apiKeys?: {
    write: string[];
    read: string[];
    admin: string[];
  };
}

declare global {
  namespace Express {
    interface Request {
      analyticsPermission?: Permission;
    }
  }
}

export function authMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key =
      (req.headers['x-api-key'] as string) ||
      (req.query['api_key'] as string);

    if (!key) {
      res.status(401).json({ error: 'INVALID_API_KEY', message: 'API key required', status: 401 });
      return;
    }

    const permission = resolvePermission(key, config);

    if (!permission) {
      res.status(403).json({ error: 'INVALID_API_KEY', message: 'Invalid API key', status: 403 });
      return;
    }

    req.analyticsPermission = permission;
    next();
  };
}

function resolvePermission(key: string, config: AuthConfig): Permission | null {
  // Simple single-key mode
  if (config.apiKey) {
    return key === config.apiKey ? 'admin' : null;
  }

  // Multi-key mode
  if (config.apiKeys) {
    if (config.apiKeys.admin.includes(key)) return 'admin';
    if (config.apiKeys.read.includes(key)) return 'read';
    if (config.apiKeys.write.includes(key)) return 'write';
  }

  return null;
}

/** Require a minimum permission level */
export function requirePermission(...allowed: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.analyticsPermission || !allowed.includes(req.analyticsPermission)) {
      res.status(403).json({
        error: 'INVALID_API_KEY',
        message: `Insufficient permissions. Required: ${allowed.join(' or ')}`,
        status: 403,
      });
      return;
    }
    next();
  };
}
