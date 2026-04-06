import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { IntervalPicker, type Interval } from '../components/filters/IntervalPicker';
import { LineChart } from '../components/charts/LineChart';
import { DataTable } from '../components/data/DataTable';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useTrendsQuery, useMetadata } from '../api/hooks';
import { useDateRange } from '../context/DateRangeContext';
import { formatNumber } from '../utils/formatters';

export function TrendsView() {
  const { dateRange } = useDateRange();
  const metadata = useMetadata();
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [interval, setInterval] = useState<Interval>('day');

  const eventNames = metadata.data?.eventNames ?? [];

  // Select first event by default
  const events = selectedEvents.length > 0 ? selectedEvents : eventNames.slice(0, 1);

  const trends = useTrendsQuery(
    events.length > 0
      ? { events: events.map((name) => ({ name, aggregation: 'total' as const })), interval, dateRange }
      : null,
  );

  return (
    <PageShell
      title="Trends"
      actions={<IntervalPicker value={interval} onChange={setInterval} />}
    >
      <div style={{ marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {eventNames.map((name) => (
          <button
            key={name}
            onClick={() => {
              setSelectedEvents((prev) =>
                prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
              );
            }}
            style={{
              padding: '5px 12px', borderRadius: 'var(--tp-radius, 8px)', fontSize: 13, cursor: 'pointer',
              border: '1px solid var(--tp-border, #e2e8f0)',
              background: events.includes(name) ? 'var(--tp-accent, #6366f1)' : 'var(--tp-surface, #fff)',
              color: events.includes(name) ? '#fff' : 'var(--tp-text, #0f172a)',
            }}
          >
            {name}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--tp-surface, #fff)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border, #e2e8f0)', padding: 20, marginBottom: 16 }}>
        {trends.isLoading ? <LoadingSpinner /> :
         trends.data?.series.length ? <LineChart series={trends.data.series} /> :
         <EmptyState message="Select events to see trends" />}
      </div>

      {trends.data?.series && trends.data.series.length > 0 && (
        <DataTable
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'value', label: 'Count', render: (row) => formatNumber(row.value) },
          ]}
          data={trends.data.series[0]?.data ?? []}
        />
      )}
    </PageShell>
  );
}
