import React from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({ columns, data, onRowClick }: DataTableProps<T>) {
  return (
    <div style={{ overflow: 'auto', border: '1px solid var(--tp-border, #e2e8f0)', borderRadius: 'var(--tp-radius, 8px)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--tp-bg, #f8fafc)' }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tp-text-secondary, #64748b)', borderBottom: '1px solid var(--tp-border, #e2e8f0)', width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{ borderBottom: '1px solid var(--tp-border, #e2e8f0)', cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '10px 12px', color: 'var(--tp-text, #0f172a)' }}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
