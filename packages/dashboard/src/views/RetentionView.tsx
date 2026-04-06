import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { IntervalPicker, type Interval } from '../components/filters/IntervalPicker';
import { RetentionGrid } from '../components/charts/RetentionGrid';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useRetentionQuery, useMetadata } from '../api/hooks';
import { useDateRange } from '../context/DateRangeContext';
import { useTheme } from '../context/ThemeContext';

export function RetentionView() {
  const { dateRange } = useDateRange();
  const { mode } = useTheme();
  const metadata = useMetadata();
  const [startEvent, setStartEvent] = useState('');
  const [returnEvent, setReturnEvent] = useState('');
  const [interval, setInterval] = useState<Interval>('week');
  const [periods, setPeriods] = useState(8);

  const eventNames = metadata.data?.eventNames ?? [];

  const retention = useRetentionQuery(
    startEvent && returnEvent
      ? { startEvent, returnEvent, dateRange, interval: interval as 'day' | 'week' | 'month', periods }
      : null,
  );

  return (
    <PageShell title="Retention" actions={<IntervalPicker value={interval} onChange={setInterval} />}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--tp-text-secondary)', display: 'block', marginBottom: 4 }}>Start event</span>
          <select value={startEvent} onChange={(e) => setStartEvent(e.target.value)} style={{ padding: '6px 10px', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border)', fontSize: 13, minWidth: 150 }}>
            <option value="">Select...</option>
            {eventNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--tp-text-secondary)', display: 'block', marginBottom: 4 }}>Return event</span>
          <select value={returnEvent} onChange={(e) => setReturnEvent(e.target.value)} style={{ padding: '6px 10px', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border)', fontSize: 13, minWidth: 150 }}>
            <option value="">Select...</option>
            {eventNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--tp-text-secondary)', display: 'block', marginBottom: 4 }}>Periods</span>
          <input type="number" min={1} max={52} value={periods} onChange={(e) => setPeriods(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border)', fontSize: 13, width: 70 }} />
        </label>
      </div>

      {!startEvent || !returnEvent ? <EmptyState message="Select start and return events" /> :
       retention.isLoading ? <LoadingSpinner /> :
       retention.data?.cohorts.length ? <RetentionGrid cohorts={retention.data.cohorts} mode={mode} /> :
       <EmptyState message="No retention data" />}
    </PageShell>
  );
}
