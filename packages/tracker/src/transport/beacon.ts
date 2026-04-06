import type { Transport, TransportPayload, TransportResult } from './transport';

export class BeaconTransport implements Transport {
  async send(url: string, payload: TransportPayload, _apiKey: string): Promise<TransportResult> {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
      return { success: false };
    }

    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const success = navigator.sendBeacon(url, blob);
      return { success };
    } catch {
      return { success: false };
    }
  }
}
