import React from 'react';

export interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, onChange }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', fontSize: 13, color: 'var(--tp-text-secondary, #64748b)' }}>
      <span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button disabled={currentPage <= 1} onClick={() => onChange(Math.max(0, offset - limit))} style={{ padding: '4px 10px', border: '1px solid var(--tp-border, #e2e8f0)', borderRadius: 'var(--tp-radius, 8px)', background: 'var(--tp-surface, #fff)', cursor: currentPage <= 1 ? 'default' : 'pointer', opacity: currentPage <= 1 ? 0.5 : 1 }}>
          Prev
        </button>
        <button disabled={currentPage >= totalPages} onClick={() => onChange(offset + limit)} style={{ padding: '4px 10px', border: '1px solid var(--tp-border, #e2e8f0)', borderRadius: 'var(--tp-radius, 8px)', background: 'var(--tp-surface, #fff)', cursor: currentPage >= totalPages ? 'default' : 'pointer', opacity: currentPage >= totalPages ? 0.5 : 1 }}>
          Next
        </button>
      </div>
    </div>
  );
}
