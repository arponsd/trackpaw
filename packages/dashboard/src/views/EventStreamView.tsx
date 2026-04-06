import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { DataTable } from '../components/data/DataTable';
import { Pagination } from '../components/data/Pagination';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useEventStream } from '../api/hooks';
import { formatRelativeTime } from '../utils/formatters';

export function EventStreamView() {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const limit = 50;

  const stream = useEventStream(
    { event: filter || undefined, limit, offset },
    5000, // auto-refresh every 5s
  );

  return (
    <PageShell title="Event Stream">
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Filter by event name..."
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setOffset(0); }}
          style={{ padding: '8px 12px', border: '1px solid var(--tp-border, #e2e8f0)', borderRadius: 'var(--tp-radius, 8px)', fontSize: 13, width: 300 }}
        />
      </div>

      {stream.isLoading ? <LoadingSpinner /> :
       !stream.data?.events.length ? <EmptyState message="No events found" /> : (
        <>
          <DataTable
            columns={[
              { key: 'event', label: 'Event', width: '20%' },
              { key: 'userId', label: 'User', render: (r) => r.userId || r.anonymousId?.slice(0, 12) || '—' },
              { key: 'timestamp', label: 'Time', render: (r) => formatRelativeTime(r.timestamp) },
              { key: 'properties', label: 'Properties', render: (r) => {
                const keys = Object.keys(r.properties || {});
                return keys.length > 0 ? keys.join(', ') : '—';
              }},
              { key: 'context', label: 'Device', render: (r) => [r.context?.browser, r.context?.os].filter(Boolean).join(' / ') || '—' },
            ]}
            data={stream.data.events}
          />
          <Pagination total={stream.data.total} limit={limit} offset={offset} onChange={setOffset} />
        </>
      )}
    </PageShell>
  );
}
