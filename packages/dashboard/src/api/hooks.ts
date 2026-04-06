import { useQuery } from '@tanstack/react-query';
import { useAnalytics } from '../context/AnalyticsProvider';
import type {
  TrendsQuery, FunnelQuery, RetentionQuery, DateRange,
} from '@trackpaw/types';

export function useTrendsQuery(query: Omit<TrendsQuery, 'type'> | null) {
  const { client } = useAnalytics();
  return useQuery({
    queryKey: ['trends', query],
    queryFn: () => client.queryTrends(query!),
    enabled: !!query,
    staleTime: 30000,
  });
}

export function useFunnelQuery(query: Omit<FunnelQuery, 'type'> | null) {
  const { client } = useAnalytics();
  return useQuery({
    queryKey: ['funnel', query],
    queryFn: () => client.queryFunnel(query!),
    enabled: !!query,
    staleTime: 30000,
  });
}

export function useRetentionQuery(query: Omit<RetentionQuery, 'type'> | null) {
  const { client } = useAnalytics();
  return useQuery({
    queryKey: ['retention', query],
    queryFn: () => client.queryRetention(query!),
    enabled: !!query,
    staleTime: 30000,
  });
}

export function useEventStream(params?: {
  event?: string; userId?: string; limit?: number; offset?: number;
}, refetchInterval?: number) {
  const { client } = useAnalytics();
  return useQuery({
    queryKey: ['eventStream', params],
    queryFn: () => client.getEventStream(params),
    staleTime: 5000,
    refetchInterval: refetchInterval || undefined,
  });
}

export function useUserList(params?: {
  search?: string; sort?: string; order?: string; limit?: number; offset?: number;
}) {
  const { client } = useAnalytics();
  return useQuery({
    queryKey: ['userList', params],
    queryFn: () => client.getUserList(params),
    staleTime: 30000,
  });
}

export function useUserProfile(userId: string | null) {
  const { client } = useAnalytics();
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => client.getUserProfile(userId!),
    enabled: !!userId,
    staleTime: 30000,
  });
}

export function useMetadata() {
  const { client } = useAnalytics();
  return useQuery({
    queryKey: ['metadata'],
    queryFn: () => client.getMetadata(),
    staleTime: 60000,
  });
}

export function useEventProperties(eventName: string | null) {
  const { client } = useAnalytics();
  return useQuery({
    queryKey: ['eventProperties', eventName],
    queryFn: () => client.getEventProperties(eventName!),
    enabled: !!eventName,
    staleTime: 60000,
  });
}
