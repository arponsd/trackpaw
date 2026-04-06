'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getTracker } from '../lib/analytics';

export function AnalyticsTracker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const tracker = getTracker();
    tracker?.page(pathname);
  }, [pathname]);

  return <>{children}</>;
}
