declare module 'pg' {
  export class Pool {
    constructor(config: any);
    query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
    end(): Promise<void>;
  }
}

declare module 'mysql2' {
  export function createPool(config: any): {
    promise(): {
      query(sql: string, params?: any[]): Promise<any>;
      end(): Promise<void>;
    };
  };
}

declare module '@clickhouse/client' {
  export function createClient(config: any): {
    query(opts: { query: string; format?: string }): Promise<{ json(): Promise<any[]> }>;
    exec(opts: { query: string }): Promise<void>;
    insert(opts: { table: string; values: any[]; format: string }): Promise<void>;
    close(): Promise<void>;
  };
}
