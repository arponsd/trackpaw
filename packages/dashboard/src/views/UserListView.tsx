import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { DataTable } from '../components/data/DataTable';
import { Pagination } from '../components/data/Pagination';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useUserList } from '../api/hooks';
import { useExport } from '../hooks/useExport';
import { formatRelativeTime, formatNumber } from '../utils/formatters';

export interface UserListViewProps {
  onSelectUser?: (userId: string) => void;
}

export function UserListView({ onSelectUser }: UserListViewProps) {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { exportCSV } = useExport();

  const users = useUserList({ search: search || undefined, sort: 'last_seen', order: 'desc', limit, offset });

  return (
    <PageShell
      title="Users"
      actions={
        <button
          onClick={() => users.data?.users && exportCSV(users.data.users, 'users.csv')}
          style={{ padding: '6px 12px', border: '1px solid var(--tp-border)', borderRadius: 'var(--tp-radius, 8px)', background: 'var(--tp-surface)', cursor: 'pointer', fontSize: 13 }}
        >
          Export CSV
        </button>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          style={{ padding: '8px 12px', border: '1px solid var(--tp-border)', borderRadius: 'var(--tp-radius, 8px)', fontSize: 13, width: 300 }}
        />
      </div>

      {users.isLoading ? <LoadingSpinner /> :
       !users.data?.users.length ? <EmptyState message="No users found" /> : (
        <>
          <DataTable
            columns={[
              { key: 'userId', label: 'User ID' },
              { key: 'traits', label: 'Name', render: (r) => r.traits?.name || '—' },
              { key: 'totalEvents', label: 'Events', render: (r) => formatNumber(r.totalEvents) },
              { key: 'lastSeen', label: 'Last Seen', render: (r) => formatRelativeTime(r.lastSeen) },
            ]}
            data={users.data.users}
            onRowClick={(row) => onSelectUser?.(row.userId)}
          />
          <Pagination total={users.data.total} limit={limit} offset={offset} onChange={setOffset} />
        </>
      )}
    </PageShell>
  );
}
