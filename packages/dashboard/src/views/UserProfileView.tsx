import React from 'react';
import { PageShell } from '../components/layout/PageShell';
import { DataTable } from '../components/data/DataTable';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useUserProfile } from '../api/hooks';
import { formatDate, formatNumber, formatRelativeTime } from '../utils/formatters';

export interface UserProfileViewProps {
  userId: string;
  onBack?: () => void;
}

export function UserProfileView({ userId, onBack }: UserProfileViewProps) {
  const { data: user, isLoading } = useUserProfile(userId);

  if (isLoading) return <PageShell title="User Profile"><LoadingSpinner /></PageShell>;
  if (!user) return <PageShell title="User Profile"><EmptyState message="User not found" /></PageShell>;

  const traits = user.traits || {};
  const traitEntries = Object.entries(traits);

  return (
    <PageShell
      title={traits.name || userId}
      actions={onBack ? <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid var(--tp-border)', borderRadius: 'var(--tp-radius, 8px)', background: 'var(--tp-surface)', cursor: 'pointer', fontSize: 13 }}>Back</button> : undefined}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 16, background: 'var(--tp-surface)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--tp-text-secondary)', marginBottom: 4 }}>User ID</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tp-text)', wordBreak: 'break-all' }}>{userId}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--tp-surface)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--tp-text-secondary)', marginBottom: 4 }}>First Seen</div>
          <div style={{ fontSize: 14, color: 'var(--tp-text)' }}>{formatDate(user.firstSeen, 'long')}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--tp-surface)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--tp-text-secondary)', marginBottom: 4 }}>Last Seen</div>
          <div style={{ fontSize: 14, color: 'var(--tp-text)' }}>{formatRelativeTime(user.lastSeen)}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--tp-surface)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--tp-text-secondary)', marginBottom: 4 }}>Total Events</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tp-text)' }}>{formatNumber(user.totalEvents)}</div>
        </div>
      </div>

      {traitEntries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--tp-text)' }}>Traits</h3>
          <DataTable
            columns={[
              { key: 'key', label: 'Property' },
              { key: 'value', label: 'Value', render: (r) => typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value) },
            ]}
            data={traitEntries.map(([key, value]) => ({ key, value }))}
          />
        </div>
      )}

      {(user as any).recentEvents?.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--tp-text)' }}>Recent Events</h3>
          <DataTable
            columns={[
              { key: 'event', label: 'Event' },
              { key: 'timestamp', label: 'Time', render: (r) => formatRelativeTime(r.timestamp) },
            ]}
            data={(user as any).recentEvents}
          />
        </div>
      )}
    </PageShell>
  );
}
