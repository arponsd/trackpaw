import { createAnalyticsServer, SQLiteAdapter } from '@trackpaw/server';

let instance: ReturnType<typeof createAnalyticsServer> | null = null;
let initialized = false;

export function getAnalyticsServer() {
  if (!instance) {
    instance = createAnalyticsServer({
      adapter: new SQLiteAdapter({
        filename: process.env.ANALYTICS_DB_PATH || './analytics.db',
      }),
      apiKey: process.env.ANALYTICS_API_KEY || 'demo-key',
    });
  }
  return instance;
}

export async function ensureInitialized() {
  if (!initialized) {
    const server = getAnalyticsServer();
    await server.migrate();
    initialized = true;
  }
}
