const express = require('express');
const { createAnalyticsServer, SQLiteAdapter } = require('@trackpaw/server');

const app = express();
const PORT = process.env.PORT || 4000;

const analytics = createAnalyticsServer({
  adapter: new SQLiteAdapter({ filename: './demo-analytics.db' }),
  apiKey: 'demo-key',
  cors: { origin: true },
});

analytics.migrate().then(() => {
  console.log('Database initialized');
});

app.use('/', analytics.router);

app.listen(PORT, () => {
  console.log(`Trackpaw standalone server running at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/v1/health`);
  console.log(`Metadata: http://localhost:${PORT}/v1/metadata?api_key=demo-key`);
});
