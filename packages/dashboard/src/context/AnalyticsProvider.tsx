import React, { createContext, useContext, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsAPIClient } from '../api/client';

interface AnalyticsContextValue {
  client: AnalyticsAPIClient;
  endpoint: string;
  apiKey: string;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export interface AnalyticsProviderProps {
  endpoint: string;
  apiKey: string;
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function AnalyticsProvider({ endpoint, apiKey, children, queryClient }: AnalyticsProviderProps) {
  const client = useMemo(() => new AnalyticsAPIClient(endpoint, apiKey), [endpoint, apiKey]);
  const qc = queryClient || defaultQueryClient;

  return (
    <QueryClientProvider client={qc}>
      <AnalyticsContext.Provider value={{ client, endpoint, apiKey }}>
        {children}
      </AnalyticsContext.Provider>
    </QueryClientProvider>
  );
}

export function useAnalytics(): AnalyticsContextValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used within <AnalyticsProvider>');
  return ctx;
}
