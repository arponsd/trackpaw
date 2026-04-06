'use client';

import { AnalyticsDashboard } from '@trackpaw/dashboard';

export default function AnalyticsPage() {
  return (
    <div style={{ height: '100vh' }}>
      <AnalyticsDashboard
        endpoint="/api/analytics"
        apiKey={process.env.NEXT_PUBLIC_ANALYTICS_KEY || 'demo-key'}
        theme="light"
      />
    </div>
  );
}
