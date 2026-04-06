const express = require('express');
const path = require('path');
const { createAnalyticsServer, SQLiteAdapter } = require('@trackpaw/server');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Analytics Setup ─────────────────────────────────
const analytics = createAnalyticsServer({
  adapter: new SQLiteAdapter({
    filename: './analytics.db',
  }),
  apiKey: process.env.ANALYTICS_API_KEY || 'demo-key',
  cors: {
    origin: true,
  },
  privacy: {
    ipAnonymization: true,
  },
});

// Run migrations on startup
analytics.migrate().then(() => {
  console.log('Analytics database initialized');
});

// Mount analytics routes
app.use('/analytics', analytics.router);

// ─── Static files ────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Pages ───────────────────────────────────────────
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pricing', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
});

// ─── Start ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Express app running at http://localhost:${PORT}`);
  console.log(`Analytics API at http://localhost:${PORT}/analytics/v1/health`);
});
