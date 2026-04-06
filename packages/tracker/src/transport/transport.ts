export interface TransportPayload {
  batch: any[];
  sentAt: string;
}

export interface TransportResult {
  success: boolean;
  statusCode?: number;
}

export interface Transport {
  send(url: string, payload: TransportPayload, apiKey: string): Promise<TransportResult>;
}
