import React from 'react';
import { PageShell } from '../components/layout/PageShell';
import { MetricCard } from '../components/shared/MetricCard';
import { LineChart } from '../components/charts/LineChart';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useTrendsQuery, useMetadata } from '../api/hooks';
import { useDateRange } from '../context/DateRangeContext';

export function OverviewView() {
  const { dateRange } = useDateRange();
  const metadata = useMetadata();
  const trends = useTrendsQuery({
    events: [{ name: '$pageview', aggregation: 'total' }],
    interval: 'day',
    dateRange,
  });

  if (metadata.isLoading) return <PageShell title="Overview"><LoadingSpinner /></PageShell>;

  return (
    <PageShell title="Overview">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard label="Total Events" value={metadata.data?.eventCount ?? 0} />
        <MetricCard label="Total Users" value={metadata.data?.userCount ?? 0} />
        <MetricCard label="Event Types" value={metadata.data?.eventNames?.length ?? 0} />
        <MetricCard label="Sessions" value={metadata.data?.sessionCount ?? 0} />
      </div>

      <div style={{ background: 'var(--tp-surface, #fff)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border, #e2e8f0)', padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: 'var(--tp-text)' }}>Event Trend</h3>
        {trends.isLoading ? <LoadingSpinner /> :
         trends.data?.series.length ? <LineChart series={trends.data.series} /> :
         <EmptyState message="No event data yet" />}
      </div>
    </PageShell>
  );
}
