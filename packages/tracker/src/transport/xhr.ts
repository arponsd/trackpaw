import type { Transport, TransportPayload, TransportResult } from './transport';

export class XHRTransport implements Transport {
  send(url: string, payload: TransportPayload, apiKey: string): Promise<TransportResult> {
    return new Promise((resolve) => {
      if (typeof XMLHttpRequest === 'undefined') {
        resolve({ success: false });
        return;
      }

      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-API-Key', apiKey);

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            resolve({
              success: xhr.status >= 200 && xhr.status < 300,
              statusCode: xhr.status,
            });
          }
        };

        xhr.onerror = () => resolve({ success: false });
        xhr.send(JSON.stringify(payload));
      } catch {
        resolve({ success: false });
      }
    });
  }
}
