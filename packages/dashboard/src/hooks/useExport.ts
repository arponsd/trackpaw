import { useCallback } from 'react';

export function useExport() {
  const exportCSV = useCallback((data: Record<string, any>[], filename = 'export.csv') => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]!);
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','),
    );

    const csv = [headers.join(','), ...rows].join('\n');
    downloadBlob(csv, filename, 'text/csv');
  }, []);

  const exportJSON = useCallback((data: any, filename = 'export.json') => {
    downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
  }, []);

  return { exportCSV, exportJSON };
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
