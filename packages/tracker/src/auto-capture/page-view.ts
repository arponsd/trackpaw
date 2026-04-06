type TrackPageFn = (pageName?: string, properties?: Record<string, any>) => void;

export class PageViewCapture {
  private lastPath: string = '';
  private cleanup: (() => void)[] = [];

  constructor(private trackPage: TrackPageFn) {}

  start(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Track initial page view
    this.trackCurrentPage();

    // SPA: intercept pushState / replaceState
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      originalPushState(...args);
      this.onRouteChange();
    };

    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      originalReplaceState(...args);
      this.onRouteChange();
    };

    // popstate fires on back/forward
    const onPopState = () => this.onRouteChange();
    window.addEventListener('popstate', onPopState);

    this.cleanup.push(() => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', onPopState);
    });
  }

  private onRouteChange(): void {
    // Debounce: skip if path hasn't changed
    const currentPath = location.pathname + location.search;
    if (currentPath === this.lastPath) return;
    this.trackCurrentPage();
  }

  private trackCurrentPage(): void {
    const path = location.pathname + location.search;
    this.lastPath = path;
    this.trackPage(path);
  }

  stop(): void {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
  }
}
