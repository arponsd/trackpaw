type TrackFn = (eventName: string, properties: Record<string, any>) => void;

export class ClickCapture {
  private handler: ((e: MouseEvent) => void) | null = null;

  constructor(private track: TrackFn) {}

  start(): void {
    if (typeof document === 'undefined') return;

    this.handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Walk up to find the nearest clickable element
      const el = target.closest('a, button, [role="button"], input[type="submit"]') as
        | HTMLElement
        | null;
      if (!el) return;

      const props: Record<string, any> = {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 255),
      };

      if (el.id) props.id = el.id;
      if (el instanceof HTMLAnchorElement) props.href = el.href;
      if (el.classList.length > 0) props.classes = Array.from(el.classList).join(' ');

      this.track('$click', props);
    };

    document.addEventListener('click', this.handler, true);
  }

  stop(): void {
    if (this.handler && typeof document !== 'undefined') {
      document.removeEventListener('click', this.handler, true);
      this.handler = null;
    }
  }
}
