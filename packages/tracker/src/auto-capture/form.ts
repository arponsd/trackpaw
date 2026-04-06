type TrackFn = (eventName: string, properties: Record<string, any>) => void;

export class FormCapture {
  private handler: ((e: SubmitEvent) => void) | null = null;

  constructor(private track: TrackFn) {}

  start(): void {
    if (typeof document === 'undefined') return;

    this.handler = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.tagName !== 'FORM') return;

      const props: Record<string, any> = {
        action: form.action || '',
        method: (form.method || 'GET').toUpperCase(),
      };

      if (form.id) props.id = form.id;
      if (form.name) props.name = form.name;

      this.track('$form_submit', props);
    };

    document.addEventListener('submit', this.handler, true);
  }

  stop(): void {
    if (this.handler && typeof document !== 'undefined') {
      document.removeEventListener('submit', this.handler, true);
      this.handler = null;
    }
  }
}
