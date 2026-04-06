import { Trackpaw } from '@trackpaw/tracker';

let tracker: ReturnType<typeof Trackpaw.init> | null = null;

export function getTracker() {
  if (!tracker && typeof window !== 'undefined') {
    tracker = Trackpaw.init({
      endpoint: '/api/analytics',
      apiKey: process.env.NEXT_PUBLIC_ANALYTICS_KEY || 'demo-key',
      autoTrack: { pageViews: false }, // track manually for SPA
    });
  }
  return tracker;
}
