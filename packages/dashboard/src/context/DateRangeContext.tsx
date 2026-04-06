import React, { createContext, useContext, useState, useCallback } from 'react';
import type { DateRange } from '@trackpaw/types';

interface DateRangeContextValue {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({
  defaultRange = { preset: '30d' },
  children,
}: {
  defaultRange?: DateRange;
  children: React.ReactNode;
}) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);

  const set = useCallback((range: DateRange) => setDateRange(range), []);

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange: set }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within <DateRangeProvider>');
  return ctx;
}
