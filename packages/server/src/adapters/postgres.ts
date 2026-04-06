import type {
  StorageAdapter, InsertResult, DeleteResult, MigrationResult, CleanupResult,
  RetentionPolicy, PropertyDefinition, HealthCheckResult,
  ValidatedEvent, UserProfile, SessionUpdate,
  TrendsQuery, TrendsResult, FunnelQuery, FunnelResult,
  RetentionQuery, RetentionResult, EventStreamQuery, EventStreamResult,
  UserListQuery, UserListResult, SegmentQuery, SegmentResult,
  DateRange, PropertyFilter,
} from './types';

export interface PostgresAdapterConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  pool?: { min?: number; max?: number; idleTimeoutMs?: number };
  schema?: string;
  retention?: { events: string; sessions: string; users: string };
}

export class PostgresAdapter implements StorageAdapter {
  readonly engine = 'postgres' as const;
  private pool: any = null;
  private config: PostgresAdapterConfig;
  private schema: string;

  constructor(config: PostgresAdapterConfig) {
    this.config = config;
    this.schema = config.schema || 'public';
  }

  async initialize(): Promise<void> {
    const { Pool } = await import('pg');
    this.pool = new Pool({
      connectionString: this.config.connectionString,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      min: this.config.pool?.min ?? 2,
      max: this.config.pool?.max ?? 10,
      idleTimeoutMillis: this.config.pool?.idleTimeoutMs ?? 30000,
    });
    await this.runMigrations();
  }

  async disconnect(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async runMigrations(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    await this.query(`
      CREATE TABLE IF NOT EXISTS tp_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(256) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await this.query('SELECT migration_name FROM tp_migrations');
    const appliedSet = new Set(applied.map((r: any) => r.migration_name));

    const migrations: [string, string][] = [
      ['001_create_events', `
        CREATE TABLE IF NOT EXISTS tp_events (
          id TEXT PRIMARY KEY, event_name VARCHAR(256) NOT NULL, user_id VARCHAR(256),
          anonymous_id VARCHAR(256) NOT NULL, session_id VARCHAR(256) NOT NULL,
          properties JSONB DEFAULT '{}', timestamp TIMESTAMPTZ NOT NULL, received_at TIMESTAMPTZ NOT NULL,
          ip_address VARCHAR(45), user_agent TEXT, page_url TEXT, page_title VARCHAR(512),
          referrer TEXT, device_type VARCHAR(20), browser VARCHAR(100), os VARCHAR(100), country VARCHAR(2)
        );
        CREATE INDEX IF NOT EXISTS idx_events_event_name ON tp_events (event_name);
        CREATE INDEX IF NOT EXISTS idx_events_user_id ON tp_events (user_id);
        CREATE INDEX IF NOT EXISTS idx_events_anonymous_id ON tp_events (anonymous_id);
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON tp_events (timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_name_timestamp ON tp_events (event_name, timestamp);
      `],
      ['002_create_users', `
        CREATE TABLE IF NOT EXISTS tp_users (
          user_id VARCHAR(256) PRIMARY KEY, anonymous_ids JSONB DEFAULT '[]',
          traits JSONB DEFAULT '{}', first_seen TIMESTAMPTZ NOT NULL, last_seen TIMESTAMPTZ NOT NULL,
          total_events INTEGER DEFAULT 0, total_sessions INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `],
      ['003_create_sessions', `
        CREATE TABLE IF NOT EXISTS tp_sessions (
          session_id VARCHAR(256) PRIMARY KEY, user_id VARCHAR(256), anonymous_id VARCHAR(256) NOT NULL,
          started_at TIMESTAMPTZ NOT NULL, ended_at TIMESTAMPTZ, duration_ms INTEGER DEFAULT 0,
          event_count INTEGER DEFAULT 0, entry_page TEXT, exit_page TEXT, referrer TEXT,
          device_type VARCHAR(20), browser VARCHAR(100), os VARCHAR(100), country VARCHAR(2),
          is_bounce BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON tp_sessions (user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON tp_sessions (started_at);
      `],
    ];

    for (const [name, sql] of migrations) {
      if (appliedSet.has(name)) continue;
      await this.query(sql);
      await this.query('INSERT INTO tp_migrations (migration_name, applied_at) VALUES ($1, NOW())', [name]);
      results.push({ name, appliedAt: new Date().toISOString() });
    }

    return results;
  }

  // ─── Event Ingestion ───────────────────────────────

  async insertEvents(events: ValidatedEvent[]): Promise<InsertResult> {
    let inserted = 0, failed = 0;
    for (const e of events) {
      try {
        await this.query(
          `INSERT INTO tp_events (id, event_name, user_id, anonymous_id, session_id, properties, timestamp, received_at, ip_address, user_agent, page_url, page_title, referrer, device_type, browser, os, country)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [e.id, e.eventName, e.userId, e.anonymousId, e.sessionId, JSON.stringify(e.properties), e.timestamp, e.receivedAt, e.ipAddress, e.userAgent, e.pageUrl, e.pageTitle, e.referrer, e.deviceType, e.browser, e.os, e.country],
        );
        inserted++;
      } catch { failed++; }
    }
    return { inserted, failed };
  }

  // ─── User Management ──────────────────────────────

  async upsertUser(userId: string, traits: Record<string, any>, anonymousId?: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.getUserProfile(userId);

    if (existing) {
      const merged = { ...existing.traits, ...traits };
      const anonIds = [...existing.anonymousIds];
      if (anonymousId && !anonIds.includes(anonymousId)) anonIds.push(anonymousId);
      await this.query(
        'UPDATE tp_users SET traits = $1, anonymous_ids = $2, last_seen = $3, updated_at = $3 WHERE user_id = $4',
        [JSON.stringify(merged), JSON.stringify(anonIds), now, userId],
      );
    } else {
      const anonIds = anonymousId ? [anonymousId] : [];
      await this.query(
        'INSERT INTO tp_users (user_id, anonymous_ids, traits, first_seen, last_seen, created_at, updated_at) VALUES ($1,$2,$3,$4,$4,$4,$4)',
        [userId, JSON.stringify(anonIds), JSON.stringify(traits), now],
      );
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { rows } = await this.query('SELECT * FROM tp_users WHERE user_id = $1', [userId]);
    return rows[0] ? this.rowToProfile(rows[0]) : null;
  }

  async getUsersByAnonymousId(anonymousId: string): Promise<UserProfile[]> {
    const { rows } = await this.query("SELECT * FROM tp_users WHERE anonymous_ids @> $1::jsonb", [JSON.stringify([anonymousId])]);
    return rows.map((r: any) => this.rowToProfile(r));
  }

  async deleteUser(userId: string): Promise<DeleteResult> {
    const user = await this.getUserProfile(userId);
    const anonIds = user?.anonymousIds || [];

    let deletedEvents = 0;
    const r1 = await this.query('DELETE FROM tp_events WHERE user_id = $1', [userId]);
    deletedEvents += r1.rowCount || 0;
    for (const aid of anonIds) {
      const r = await this.query('DELETE FROM tp_events WHERE anonymous_id = $1 AND user_id IS NULL', [aid]);
      deletedEvents += r.rowCount || 0;
    }

    let deletedSessions = 0;
    const r2 = await this.query('DELETE FROM tp_sessions WHERE user_id = $1', [userId]);
    deletedSessions += r2.rowCount || 0;

    const r3 = await this.query('DELETE FROM tp_users WHERE user_id = $1', [userId]);
    return { events: deletedEvents, sessions: deletedSessions, userProfile: (r3.rowCount || 0) > 0 };
  }

  // ─── Session Management ────────────────────────────

  async upsertSession(session: SessionUpdate): Promise<void> {
    const now = new Date().toISOString();
    const { rows } = await this.query('SELECT * FROM tp_sessions WHERE session_id = $1', [session.sessionId]);

    if (rows[0]) {
      await this.query(
        `UPDATE tp_sessions SET user_id = COALESCE($1, user_id), ended_at = COALESCE($2, ended_at),
         event_count = event_count + $3, exit_page = COALESCE($4, exit_page), updated_at = $5 WHERE session_id = $6`,
        [session.userId, session.endedAt, session.eventCount || 0, session.exitPage, now, session.sessionId],
      );
    } else {
      await this.query(
        `INSERT INTO tp_sessions (session_id, user_id, anonymous_id, started_at, ended_at, event_count, entry_page, exit_page, referrer, device_type, browser, os, country, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
        [session.sessionId, session.userId, session.anonymousId, session.startedAt || now, session.endedAt, session.eventCount || 1, session.entryPage, session.exitPage, session.referrer, session.deviceType, session.browser, session.os, session.country, now],
      );
    }
  }

  // ─── Query Engine ──────────────────────────────────

  async queryTrends(query: TrendsQuery): Promise<TrendsResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const series: TrendsResult['series'] = [];

    for (const evt of query.events) {
      const agg = evt.aggregation || 'total';
      const bucket = this.dateTrunc(query.interval);
      const val = agg === 'unique_users' ? 'COUNT(DISTINCT COALESCE(user_id, anonymous_id))' : agg === 'unique_sessions' ? 'COUNT(DISTINCT session_id)' : 'COUNT(*)';

      let sql = `SELECT ${bucket} AS bucket, ${val} AS value`;
      const params: any[] = [evt.name, start, end];
      let paramIdx = 4;

      if (query.groupBy) {
        sql += `, properties->>'${query.groupBy.replace("properties.", "")}' AS group_value`;
      }

      sql += ` FROM tp_events WHERE event_name = $1 AND timestamp >= $2 AND timestamp < $3`;

      if (evt.filters) {
        for (const f of evt.filters) {
          const { clause, param } = this.buildFilter(f, paramIdx);
          sql += ` AND ${clause}`;
          if (param !== undefined) { params.push(param); paramIdx++; }
        }
      }

      sql += ` GROUP BY bucket`;
      if (query.groupBy) sql += `, group_value`;
      sql += ` ORDER BY bucket ASC`;

      const { rows } = await this.query(sql, params);

      if (query.groupBy) {
        const groups = new Map<string, any[]>();
        for (const r of rows) {
          const gv = String(r.group_value ?? '(none)');
          if (!groups.has(gv)) groups.set(gv, []);
          groups.get(gv)!.push({ date: r.bucket instanceof Date ? r.bucket.toISOString().slice(0, 10) : r.bucket, value: Number(r.value) });
        }
        for (const [gv, data] of groups) {
          series.push({ event: evt.name, groupValue: gv, data, total: data.reduce((s, d) => s + d.value, 0) });
        }
      } else {
        const data = rows.map((r: any) => ({ date: r.bucket instanceof Date ? r.bucket.toISOString().slice(0, 10) : r.bucket, value: Number(r.value) }));
        series.push({ event: evt.name, data, total: data.reduce((s: number, d: any) => s + d.value, 0) });
      }
    }

    return { type: 'trends', series, dateRange: { start, end }, queryTimeMs: 0 };
  }

  async queryFunnel(query: FunnelQuery): Promise<FunnelResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const window = query.conversionWindow || 86400 * 30;
    const names = query.steps.map(s => s.event);
    const params = [...names, start, end];

    const { rows } = await this.query(
      `SELECT COALESCE(user_id, anonymous_id) AS uid, event_name, timestamp FROM tp_events
       WHERE event_name = ANY($1) AND timestamp >= $2 AND timestamp < $3 ORDER BY timestamp`,
      [names, start, end],
    );

    const userEvents = new Map<string, any[]>();
    for (const r of rows) { if (!userEvents.has(r.uid)) userEvents.set(r.uid, []); userEvents.get(r.uid)!.push(r); }

    const counts = new Array(query.steps.length).fill(0);
    const times: number[][] = query.steps.map(() => []);

    for (const evts of userEvents.values()) {
      const stepTs: (number | null)[] = new Array(query.steps.length).fill(null);
      for (let i = 0; i < query.steps.length; i++) {
        for (const e of evts) {
          if (e.event_name !== query.steps[i]!.event) continue;
          const ts = new Date(e.timestamp).getTime();
          if (i === 0) { stepTs[i] = ts; break; }
          else if (stepTs[i-1] !== null && ts > stepTs[i-1]! && (ts - stepTs[0]!) / 1000 <= window) { stepTs[i] = ts; break; }
        }
      }
      for (let i = 0; i < query.steps.length; i++) {
        if (stepTs[i] !== null) { counts[i]++; if (i > 0 && stepTs[i-1] !== null) times[i]!.push((stepTs[i]! - stepTs[i-1]!) / 1000); }
      }
    }

    const steps = query.steps.map((s, i) => {
      const c = counts[i]!, prev = i === 0 ? c : counts[i-1]!, first = counts[0]!;
      const t = times[i]!.sort((a,b) => a-b);
      return { event: s.event, count: c, conversionRate: prev > 0 ? (c/prev)*100 : 0, overallRate: first > 0 ? (c/first)*100 : 0, dropoff: Math.max(0, prev-c), medianTimeBetween: t.length ? t[Math.floor(t.length/2)] : undefined };
    });

    return { type: 'funnel', steps, queryTimeMs: 0 };
  }

  async queryRetention(query: RetentionQuery): Promise<RetentionResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const bucket = this.dateTrunc(query.interval);
    const intMs = this.intervalMs(query.interval);

    const { rows: cohortRows } = await this.query(
      `SELECT COALESCE(user_id, anonymous_id) AS uid, ${bucket} AS cohort_date FROM tp_events WHERE event_name = $1 AND timestamp >= $2 AND timestamp < $3 GROUP BY uid`,
      [query.startEvent, start, end],
    );

    const userCohort = new Map<string, string>();
    for (const r of cohortRows) { const d = r.cohort_date instanceof Date ? r.cohort_date.toISOString().slice(0,10) : r.cohort_date; if (!userCohort.has(r.uid)) userCohort.set(r.uid, d); }

    const { rows: returnRows } = await this.query(
      'SELECT COALESCE(user_id, anonymous_id) AS uid, timestamp FROM tp_events WHERE event_name = $1 AND timestamp >= $2',
      [query.returnEvent, start],
    );

    const cohorts = new Map<string, { size: number; periods: Map<number, Set<string>> }>();
    for (const [uid, cd] of userCohort) { if (!cohorts.has(cd)) cohorts.set(cd, { size: 0, periods: new Map() }); cohorts.get(cd)!.size++; }

    for (const r of returnRows) {
      const cd = userCohort.get(r.uid); if (!cd) continue;
      const period = Math.floor((new Date(r.timestamp).getTime() - new Date(cd).getTime()) / intMs);
      if (period < 0 || period > query.periods) continue;
      const c = cohorts.get(cd)!; if (!c.periods.has(period)) c.periods.set(period, new Set()); c.periods.get(period)!.add(r.uid);
    }

    const result: RetentionResult['cohorts'] = [];
    for (const date of Array.from(cohorts.keys()).sort()) {
      const c = cohorts.get(date)!;
      const retention = [];
      for (let p = 0; p <= query.periods; p++) {
        const cnt = c.periods.get(p)?.size ?? 0;
        retention.push({ period: p, count: cnt, percentage: c.size > 0 ? (cnt/c.size)*100 : 0 });
      }
      result.push({ date, cohortSize: c.size, retention });
    }

    return { type: 'retention', cohorts: result, queryTimeMs: 0 };
  }

  async queryEventStream(query: EventStreamQuery): Promise<EventStreamResult> {
    const limit = Math.min(query.limit || 50, 200);
    const offset = query.offset || 0;
    const order = query.orderBy === 'timestamp_asc' ? 'ASC' : 'DESC';
    let where = '1=1'; const params: any[] = []; let idx = 1;

    if (query.filters?.eventNames?.length) { where += ` AND event_name = ANY($${idx})`; params.push(query.filters.eventNames); idx++; }
    if (query.filters?.userId) { where += ` AND user_id = $${idx}`; params.push(query.filters.userId); idx++; }
    if (query.filters?.dateRange) { const { start, end } = this.resolveDateRange(query.filters.dateRange); where += ` AND timestamp >= $${idx} AND timestamp < $${idx+1}`; params.push(start, end); idx += 2; }

    const { rows: [{ cnt }] } = await this.query(`SELECT COUNT(*) AS cnt FROM tp_events WHERE ${where}`, params);
    const { rows } = await this.query(`SELECT * FROM tp_events WHERE ${where} ORDER BY timestamp ${order} LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]);

    return { type: 'event_stream', events: rows.map((r: any) => ({ id: r.id, event: r.event_name, userId: r.user_id, anonymousId: r.anonymous_id, sessionId: r.session_id, properties: r.properties || {}, timestamp: r.timestamp, context: { browser: r.browser, os: r.os, deviceType: r.device_type } })), total: Number(cnt), limit, offset };
  }

  async queryUserList(query: UserListQuery): Promise<UserListResult> {
    const limit = Math.min(query.limit || 50, 200); const offset = query.offset || 0;
    const sort = query.sortBy || 'last_seen'; const order = query.order || 'desc';
    let where = '1=1'; const params: any[] = []; let idx = 1;
    if (query.search) { where += ` AND (user_id ILIKE $${idx} OR traits::text ILIKE $${idx})`; params.push(`%${query.search}%`); idx++; }

    const { rows: [{ cnt }] } = await this.query(`SELECT COUNT(*) AS cnt FROM tp_users WHERE ${where}`, params);
    const { rows } = await this.query(`SELECT * FROM tp_users WHERE ${where} ORDER BY ${sort} ${order} LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]);

    return { type: 'user_list', users: rows.map((r: any) => ({ userId: r.user_id, traits: r.traits || {}, firstSeen: r.first_seen, lastSeen: r.last_seen, totalEvents: r.total_events, totalSessions: r.total_sessions })), total: Number(cnt), limit, offset };
  }

  async querySegment(query: SegmentQuery): Promise<SegmentResult> {
    const matching = new Map<string, boolean>();
    for (let i = 0; i < query.conditions.length; i++) {
      const cond = query.conditions[i]!;
      const { start, end } = cond.dateRange ? this.resolveDateRange(cond.dateRange) : { start: '1970-01-01', end: '2099-12-31' };
      const { rows } = await this.query('SELECT COALESCE(user_id, anonymous_id) AS uid, COUNT(*) AS cnt FROM tp_events WHERE event_name = $1 AND timestamp >= $2 AND timestamp < $3 GROUP BY uid', [cond.event, start, end]);
      const has = new Set<string>();
      for (const r of rows) { let m = true; if (cond.count) { if (cond.count.operator === 'gte') m = Number(r.cnt) >= cond.count.value; else if (cond.count.operator === 'lte') m = Number(r.cnt) <= cond.count.value; else m = Number(r.cnt) === cond.count.value; } if (m) has.add(r.uid); }
      if (i === 0) { if (cond.operator === 'did') { for (const u of has) matching.set(u, true); } else { const { rows: all } = await this.query('SELECT DISTINCT COALESCE(user_id, anonymous_id) AS uid FROM tp_events'); for (const r of all) { if (!has.has(r.uid)) matching.set(r.uid, true); } } }
      else { if (query.combinator === 'and') { for (const u of matching.keys()) { const meets = cond.operator === 'did' ? has.has(u) : !has.has(u); if (!meets) matching.delete(u); } } else { if (cond.operator === 'did') { for (const u of has) matching.set(u, true); } } }
    }
    return { type: 'segment', count: matching.size, queryTimeMs: 0 };
  }

  // ─── Metadata ──────────────────────────────────────

  async getEventNames(opts?: { limit?: number; search?: string }): Promise<string[]> {
    const limit = opts?.limit || 100;
    let sql = 'SELECT DISTINCT event_name FROM tp_events'; const params: any[] = []; let idx = 1;
    if (opts?.search) { sql += ` WHERE event_name ILIKE $${idx}`; params.push(`%${opts.search}%`); idx++; }
    sql += ` ORDER BY event_name LIMIT $${idx}`; params.push(limit);
    const { rows } = await this.query(sql, params);
    return rows.map((r: any) => r.event_name);
  }

  async getEventProperties(eventName: string): Promise<PropertyDefinition[]> {
    const { rows } = await this.query('SELECT properties FROM tp_events WHERE event_name = $1 LIMIT 100', [eventName]);
    const map = new Map<string, { types: Set<string>; samples: Set<any> }>();
    for (const r of rows) { for (const [k, v] of Object.entries(r.properties || {})) { if (!map.has(k)) map.set(k, { types: new Set(), samples: new Set() }); const e = map.get(k)!; e.types.add(typeof v); if (e.samples.size < 5) e.samples.add(v); } }
    return Array.from(map).map(([key, info]) => ({ key, type: (info.types.values().next().value || 'string') as any, sampleValues: Array.from(info.samples) }));
  }

  async getEventCount(range?: DateRange): Promise<number> {
    if (range) { const { start, end } = this.resolveDateRange(range); const { rows } = await this.query('SELECT COUNT(*) AS cnt FROM tp_events WHERE timestamp >= $1 AND timestamp < $2', [start, end]); return Number(rows[0].cnt); }
    const { rows } = await this.query('SELECT COUNT(*) AS cnt FROM tp_events');
    return Number(rows[0].cnt);
  }

  async getUserCount(range?: DateRange): Promise<number> {
    if (range) { const { start, end } = this.resolveDateRange(range); const { rows } = await this.query('SELECT COUNT(*) AS cnt FROM tp_users WHERE first_seen >= $1 AND first_seen < $2', [start, end]); return Number(rows[0].cnt); }
    const { rows } = await this.query('SELECT COUNT(*) AS cnt FROM tp_users');
    return Number(rows[0].cnt);
  }

  async runRetentionCleanup(policy: RetentionPolicy): Promise<CleanupResult> {
    let deletedEvents = 0, deletedSessions = 0;
    if (policy.events !== 'forever') { const cutoff = new Date(Date.now() - this.parseDays(policy.events)).toISOString(); const r = await this.query('DELETE FROM tp_events WHERE timestamp < $1', [cutoff]); deletedEvents = r.rowCount || 0; }
    if (policy.sessions !== 'forever') { const cutoff = new Date(Date.now() - this.parseDays(policy.sessions)).toISOString(); const r = await this.query('DELETE FROM tp_sessions WHERE started_at < $1', [cutoff]); deletedSessions = r.rowCount || 0; }
    return { deletedEvents, deletedSessions };
  }

  // ─── Helpers ───────────────────────────────────────

  private async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error('PostgresAdapter not initialized');
    return this.pool.query(sql, params);
  }

  private rowToProfile(r: any): UserProfile {
    return { userId: r.user_id, anonymousIds: r.anonymous_ids || [], traits: r.traits || {}, firstSeen: r.first_seen, lastSeen: r.last_seen, totalEvents: r.total_events, totalSessions: r.total_sessions, createdAt: r.created_at, updatedAt: r.updated_at };
  }

  private dateTrunc(interval: string): string {
    return `date_trunc('${interval === 'hour' ? 'hour' : interval === 'week' ? 'week' : interval === 'month' ? 'month' : 'day'}', timestamp)`;
  }

  private buildFilter(f: PropertyFilter, idx: number): { clause: string; param?: any } {
    const col = `properties->>'${f.key.replace("properties.", "")}'`;
    switch (f.operator) {
      case 'eq': return { clause: `${col} = $${idx}`, param: String(f.value) };
      case 'neq': return { clause: `${col} != $${idx}`, param: String(f.value) };
      case 'contains': return { clause: `${col} ILIKE $${idx}`, param: `%${f.value}%` };
      case 'is_set': return { clause: `${col} IS NOT NULL` };
      case 'is_not_set': return { clause: `${col} IS NULL` };
      default: return { clause: '1=1' };
    }
  }

  private resolveDateRange(range: DateRange): { start: string; end: string } {
    if (range.start && range.end) return { start: range.start, end: range.end };
    const now = new Date(); const end = now.toISOString(); let ms = now.getTime();
    const days: Record<string, number> = { '24h': 1, '7d': 7, '14d': 14, '30d': 30, '90d': 90, '365d': 365 };
    ms -= (days[range.preset || '30d'] || 30) * 86400000;
    return { start: new Date(ms).toISOString(), end };
  }

  private intervalMs(i: string): number { return i === 'hour' ? 3600000 : i === 'week' ? 604800000 : i === 'month' ? 2592000000 : 86400000; }
  private parseDays(v: string): number { const m = v.match(/^(\d+)d$/); return m ? parseInt(m[1]!, 10) * 86400000 : 365 * 86400000; }
}
