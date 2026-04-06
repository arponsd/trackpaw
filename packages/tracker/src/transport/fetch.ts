import type { Transport, TransportPayload, TransportResult } from './transport';

export class FetchTransport implements Transport {
  async send(url: string, payload: TransportPayload, apiKey: string): Promise<TransportResult> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });

      return {
        success: response.ok,
        statusCode: response.status,
      };
    } catch {
      return { success: false };
    }
  }
}
