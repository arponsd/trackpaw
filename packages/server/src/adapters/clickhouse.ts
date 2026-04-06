import type {
  StorageAdapter, InsertResult, DeleteResult, MigrationResult, CleanupResult,
  RetentionPolicy, PropertyDefinition, HealthCheckResult,
  ValidatedEvent, UserProfile, SessionUpdate,
  TrendsQuery, TrendsResult, FunnelQuery, FunnelResult,
  RetentionQuery, RetentionResult, EventStreamQuery, EventStreamResult,
  UserListQuery, UserListResult, SegmentQuery, SegmentResult,
  DateRange, PropertyFilter,
} from './types';

export interface ClickHouseAdapterConfig {
  url?: string;
  host?: string;
  database?: string;
  username?: string;
  password?: string;
  asyncInsert?: boolean;
  ttl?: string;
}

export class ClickHouseAdapter implements StorageAdapter {
  readonly engine = 'clickhouse' as const;
  private client: any = null;
  private config: ClickHouseAdapterConfig;

  constructor(config: ClickHouseAdapterConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const { createClient } = await import('@clickhouse/client');
    this.client = createClient({
      url: this.config.url || `http://${this.config.host || 'localhost'}:8123`,
      database: this.config.database || 'default',
      username: this.config.username || 'default',
      password: this.config.password || '',
    });
    await this.runMigrations();
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
    this.client = null;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try { await this.exec('SELECT 1'); return { ok: true, latencyMs: Date.now() - start }; }
    catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  async runMigrations(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    const ttl = this.config.ttl ? `TTL timestamp + INTERVAL ${this.config.ttl}` : '';

    await this.exec(`
      CREATE TABLE IF NOT EXISTS tp_migrations (
        migration_name String, applied_at DateTime DEFAULT now()
      ) ENGINE = MergeTree() ORDER BY migration_name
    `);

    const applied = await this.queryRows<{ migration_name: string }>('SELECT migration_name FROM tp_migrations');
    const appliedSet = new Set(applied.map(r => r.migration_name));

    const migrations: [string, string][] = [
      ['001_create_events', `
        CREATE TABLE IF NOT EXISTS tp_events (
          id String, event_name String, user_id Nullable(String),
          anonymous_id String, session_id String,
          properties String DEFAULT '{}',
          timestamp DateTime64(3, 'UTC'), received_at DateTime64(3, 'UTC'),
          ip_address Nullable(String), user_agent Nullable(String),
          page_url Nullable(String), page_title Nullable(String),
          referrer Nullable(String), device_type Nullable(String),
          browser Nullable(String), os Nullable(String), country Nullable(String)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (event_name, timestamp, id)
        ${ttl}
      `],
      ['002_create_users', `
        CREATE TABLE IF NOT EXISTS tp_users (
          user_id String, anonymous_ids String DEFAULT '[]',
          traits String DEFAULT '{}',
          first_seen DateTime64(3, 'UTC'), last_seen DateTime64(3, 'UTC'),
          total_events UInt32 DEFAULT 0, total_sessions UInt32 DEFAULT 0,
          created_at DateTime64(3, 'UTC'), updated_at DateTime64(3, 'UTC')
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY user_id
      `],
      ['003_create_sessions', `
        CREATE TABLE IF NOT EXISTS tp_sessions (
          session_id String, user_id Nullable(String), anonymous_id String,
          started_at DateTime64(3, 'UTC'), ended_at Nullable(DateTime64(3, 'UTC')),
          duration_ms UInt32 DEFAULT 0, event_count UInt32 DEFAULT 0,
          entry_page Nullable(String), exit_page Nullable(String),
          referrer Nullable(String), device_type Nullable(String),
          browser Nullable(String), os Nullable(String), country Nullable(String),
          is_bounce UInt8 DEFAULT 0,
          created_at DateTime64(3, 'UTC'), updated_at DateTime64(3, 'UTC')
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY session_id
      `],
    ];

    for (const [name, sql] of migrations) {
      if (appliedSet.has(name)) continue;
      await this.exec(sql);
      await this.exec(`INSERT INTO tp_migrations (migration_name) VALUES ('${name}')`);
      results.push({ name, appliedAt: new Date().toISOString() });
    }

    return results;
  }

  // ─── Event Ingestion ───────────────────────────────

  async insertEvents(events: ValidatedEvent[]): Promise<InsertResult> {
    if (events.length === 0) return { inserted: 0, failed: 0 };

    try {
      await this.client.insert({
        table: 'tp_events',
        values: events.map(e => ({
          id: e.id, event_name: e.eventName, user_id: e.userId,
          anonymous_id: e.anonymousId, session_id: e.sessionId,
          properties: JSON.stringify(e.properties),
          timestamp: e.timestamp, received_at: e.receivedAt,
          ip_address: e.ipAddress, user_agent: e.userAgent,
          page_url: e.pageUrl, page_title: e.pageTitle,
          referrer: e.referrer, device_type: e.deviceType,
          browser: e.browser, os: e.os, country: e.country,
        })),
        format: 'JSONEachRow',
      });
      return { inserted: events.length, failed: 0 };
    } catch {
      return { inserted: 0, failed: events.length };
    }
  }

  // ─── User Management ──────────────────────────────

  async upsertUser(userId: string, traits: Record<string, any>, anonymousId?: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.getUserProfile(userId);

    if (existing) {
      const merged = { ...existing.traits, ...traits };
      const anonIds = [...existing.anonymousIds];
      if (anonymousId && !anonIds.includes(anonymousId)) anonIds.push(anonymousId);
      await this.exec(`INSERT INTO tp_users (user_id, anonymous_ids, traits, first_seen, last_seen, total_events, total_sessions, created_at, updated_at) VALUES ('${userId}', '${JSON.stringify(anonIds)}', '${JSON.stringify(merged)}', '${existing.firstSeen}', '${now}', ${existing.totalEvents}, ${existing.totalSessions}, '${existing.createdAt}', '${now}')`);
    } else {
      const anonIds = anonymousId ? [anonymousId] : [];
      await this.exec(`INSERT INTO tp_users (user_id, anonymous_ids, traits, first_seen, last_seen, created_at, updated_at) VALUES ('${userId}', '${JSON.stringify(anonIds)}', '${JSON.stringify(traits)}', '${now}', '${now}', '${now}', '${now}')`);
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const rows = await this.queryRows<any>(`SELECT * FROM tp_users FINAL WHERE user_id = '${userId}' LIMIT 1`);
    return rows[0] ? this.rowToProfile(rows[0]) : null;
  }

  async getUsersByAnonymousId(anonymousId: string): Promise<UserProfile[]> {
    const rows = await this.queryRows<any>(`SELECT * FROM tp_users FINAL WHERE anonymous_ids LIKE '%"${anonymousId}"%'`);
    return rows.map(r => this.rowToProfile(r));
  }

  async deleteUser(userId: string): Promise<DeleteResult> {
    const user = await this.getUserProfile(userId);
    // ClickHouse uses lightweight deletes (ALTER TABLE DELETE)
    await this.exec(`ALTER TABLE tp_events DELETE WHERE user_id = '${userId}'`);
    await this.exec(`ALTER TABLE tp_sessions DELETE WHERE user_id = '${userId}'`);
    await this.exec(`ALTER TABLE tp_users DELETE WHERE user_id = '${userId}'`);
    return { events: 0, sessions: 0, userProfile: !!user };
  }

  // ─── Session Management ────────────────────────────

  async upsertSession(session: SessionUpdate): Promise<void> {
    const now = new Date().toISOString();
    await this.exec(`INSERT INTO tp_sessions (session_id, user_id, anonymous_id, started_at, ended_at, event_count, entry_page, exit_page, referrer, device_type, browser, os, country, created_at, updated_at) VALUES ('${session.sessionId}', ${session.userId ? `'${session.userId}'` : 'NULL'}, '${session.anonymousId}', '${session.startedAt || now}', ${session.endedAt ? `'${session.endedAt}'` : 'NULL'}, ${session.eventCount || 1}, ${session.entryPage ? `'${session.entryPage}'` : 'NULL'}, ${session.exitPage ? `'${session.exitPage}'` : 'NULL'}, ${session.referrer ? `'${session.referrer}'` : 'NULL'}, ${session.deviceType ? `'${session.deviceType}'` : 'NULL'}, ${session.browser ? `'${session.browser}'` : 'NULL'}, ${session.os ? `'${session.os}'` : 'NULL'}, ${session.country ? `'${session.country}'` : 'NULL'}, '${now}', '${now}')`);
  }

  // ─── Query Engine ──────────────────────────────────

  async queryTrends(query: TrendsQuery): Promise<TrendsResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const series: TrendsResult['series'] = [];

    for (const evt of query.events) {
      const agg = evt.aggregation || 'total';
      const bucket = this.dateTrunc(query.interval);
      const val = agg === 'unique_users' ? 'COUNT(DISTINCT coalesce(user_id, anonymous_id))' : agg === 'unique_sessions' ? 'COUNT(DISTINCT session_id)' : 'COUNT(*)';

      let sql = `SELECT ${bucket} AS bucket, ${val} AS value`;
      if (query.groupBy) { const key = query.groupBy.replace('properties.',''); sql += `, JSONExtractString(properties, '${key}') AS group_value`; }
      sql += ` FROM tp_events WHERE event_name = '${evt.name}' AND timestamp >= '${start}' AND timestamp < '${end}'`;
      sql += ` GROUP BY bucket`;
      if (query.groupBy) sql += `, group_value`;
      sql += ` ORDER BY bucket ASC`;

      const rows = await this.queryRows<any>(sql);

      if (query.groupBy) {
        const groups = new Map<string, any[]>();
        for (const r of rows) { const gv = String(r.group_value ?? '(none)'); if (!groups.has(gv)) groups.set(gv, []); groups.get(gv)!.push({ date: String(r.bucket), value: Number(r.value) }); }
        for (const [gv, data] of groups) series.push({ event: evt.name, groupValue: gv, data, total: data.reduce((s,d) => s+d.value, 0) });
      } else {
        const data = rows.map(r => ({ date: String(r.bucket), value: Number(r.value) }));
        series.push({ event: evt.name, data, total: data.reduce((s,d) => s+d.value, 0) });
      }
    }
    return { type: 'trends', series, dateRange: { start, end }, queryTimeMs: 0 };
  }

  async queryFunnel(query: FunnelQuery): Promise<FunnelResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const window = query.conversionWindow || 86400 * 30;
    const names = query.steps.map(s => `'${s.event}'`).join(',');
    const rows = await this.queryRows<any>(`SELECT coalesce(user_id, anonymous_id) AS uid, event_name, timestamp FROM tp_events WHERE event_name IN (${names}) AND timestamp >= '${start}' AND timestamp < '${end}' ORDER BY timestamp`);

    const userEvents = new Map<string, any[]>();
    for (const r of rows) { if (!userEvents.has(r.uid)) userEvents.set(r.uid, []); userEvents.get(r.uid)!.push(r); }

    const counts = new Array(query.steps.length).fill(0);
    const times: number[][] = query.steps.map(() => []);
    for (const evts of userEvents.values()) {
      const stepTs: (number|null)[] = new Array(query.steps.length).fill(null);
      for (let i=0; i<query.steps.length; i++) { for (const e of evts) { if (e.event_name!==query.steps[i]!.event) continue; const ts=new Date(e.timestamp).getTime(); if (i===0) { stepTs[i]=ts; break; } else if (stepTs[i-1]!==null && ts>stepTs[i-1]! && (ts-stepTs[0]!)/1000<=window) { stepTs[i]=ts; break; } } }
      for (let i=0; i<query.steps.length; i++) { if (stepTs[i]!==null) { counts[i]++; if (i>0 && stepTs[i-1]!==null) times[i]!.push((stepTs[i]!-stepTs[i-1]!)/1000); } }
    }
    const steps = query.steps.map((s,i) => { const c=counts[i]!, prev=i===0?c:counts[i-1]!, first=counts[0]!; const t=times[i]!.sort((a,b)=>a-b); return { event:s.event, count:c, conversionRate:prev>0?(c/prev)*100:0, overallRate:first>0?(c/first)*100:0, dropoff:Math.max(0,prev-c), medianTimeBetween:t.length?t[Math.floor(t.length/2)]:undefined }; });
    return { type: 'funnel', steps, queryTimeMs: 0 };
  }

  async queryRetention(query: RetentionQuery): Promise<RetentionResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const bucket = this.dateTrunc(query.interval);
    const intMs = this.intervalMs(query.interval);

    const cohortRows = await this.queryRows<any>(`SELECT coalesce(user_id, anonymous_id) AS uid, ${bucket} AS cohort_date FROM tp_events WHERE event_name = '${query.startEvent}' AND timestamp >= '${start}' AND timestamp < '${end}' GROUP BY uid`);
    const userCohort = new Map<string, string>();
    for (const r of cohortRows) { const d=String(r.cohort_date); if (!userCohort.has(r.uid)) userCohort.set(r.uid, d); }

    const returnRows = await this.queryRows<any>(`SELECT coalesce(user_id, anonymous_id) AS uid, timestamp FROM tp_events WHERE event_name = '${query.returnEvent}' AND timestamp >= '${start}'`);
    const cohorts = new Map<string, { size:number; periods:Map<number,Set<string>> }>();
    for (const [,cd] of userCohort) { if (!cohorts.has(cd)) cohorts.set(cd, {size:0,periods:new Map()}); cohorts.get(cd)!.size++; }
    for (const r of returnRows) { const cd=userCohort.get(r.uid); if (!cd) continue; const period=Math.floor((new Date(r.timestamp).getTime()-new Date(cd).getTime())/intMs); if (period<0||period>query.periods) continue; const c=cohorts.get(cd)!; if (!c.periods.has(period)) c.periods.set(period, new Set()); c.periods.get(period)!.add(r.uid); }

    const result: RetentionResult['cohorts'] = [];
    for (const date of Array.from(cohorts.keys()).sort()) { const c=cohorts.get(date)!; const ret=[]; for (let p=0;p<=query.periods;p++) { const cnt=c.periods.get(p)?.size??0; ret.push({period:p,count:cnt,percentage:c.size>0?(cnt/c.size)*100:0}); } result.push({date,cohortSize:c.size,retention:ret}); }
    return { type: 'retention', cohorts: result, queryTimeMs: 0 };
  }

  async queryEventStream(query: EventStreamQuery): Promise<EventStreamResult> {
    const limit = Math.min(query.limit||50,200); const offset = query.offset||0;
    const order = query.orderBy==='timestamp_asc'?'ASC':'DESC';
    let where = '1=1';
    if (query.filters?.eventNames?.length) where += ` AND event_name IN (${query.filters.eventNames.map(n=>`'${n}'`).join(',')})`;
    if (query.filters?.userId) where += ` AND user_id = '${query.filters.userId}'`;
    if (query.filters?.dateRange) { const {start,end}=this.resolveDateRange(query.filters.dateRange); where += ` AND timestamp >= '${start}' AND timestamp < '${end}'`; }
    const [countRow] = await this.queryRows<any>(`SELECT COUNT(*) AS cnt FROM tp_events WHERE ${where}`);
    const rows = await this.queryRows<any>(`SELECT * FROM tp_events WHERE ${where} ORDER BY timestamp ${order} LIMIT ${limit} OFFSET ${offset}`);
    return { type: 'event_stream', events: rows.map(r => ({ id:r.id, event:r.event_name, userId:r.user_id, anonymousId:r.anonymous_id, sessionId:r.session_id, properties:JSON.parse(r.properties||'{}'), timestamp:r.timestamp, context:{browser:r.browser,os:r.os,deviceType:r.device_type} })), total: Number(countRow?.cnt||0), limit, offset };
  }

  async queryUserList(query: UserListQuery): Promise<UserListResult> {
    const limit = Math.min(query.limit||50,200); const offset = query.offset||0;
    const sort = query.sortBy||'last_seen'; const order = query.order||'desc';
    let where = '1=1';
    if (query.search) where += ` AND (user_id LIKE '%${query.search}%' OR traits LIKE '%${query.search}%')`;
    const [countRow] = await this.queryRows<any>(`SELECT COUNT(*) AS cnt FROM tp_users FINAL WHERE ${where}`);
    const rows = await this.queryRows<any>(`SELECT * FROM tp_users FINAL WHERE ${where} ORDER BY ${sort} ${order} LIMIT ${limit} OFFSET ${offset}`);
    return { type: 'user_list', users: rows.map(r => ({ userId:r.user_id, traits:JSON.parse(r.traits||'{}'), firstSeen:r.first_seen, lastSeen:r.last_seen, totalEvents:r.total_events, totalSessions:r.total_sessions })), total: Number(countRow?.cnt||0), limit, offset };
  }

  async querySegment(query: SegmentQuery): Promise<SegmentResult> {
    const matching = new Map<string, boolean>();
    for (let i=0; i<query.conditions.length; i++) {
      const cond = query.conditions[i]!;
      const {start,end} = cond.dateRange ? this.resolveDateRange(cond.dateRange) : {start:'1970-01-01',end:'2099-12-31'};
      const rows = await this.queryRows<any>(`SELECT coalesce(user_id, anonymous_id) AS uid, COUNT(*) AS cnt FROM tp_events WHERE event_name = '${cond.event}' AND timestamp >= '${start}' AND timestamp < '${end}' GROUP BY uid`);
      const has = new Set<string>();
      for (const r of rows) { let m=true; if (cond.count) { if (cond.count.operator==='gte') m=Number(r.cnt)>=cond.count.value; else if (cond.count.operator==='lte') m=Number(r.cnt)<=cond.count.value; else m=Number(r.cnt)===cond.count.value; } if (m) has.add(r.uid); }
      if (i===0) { if (cond.operator==='did') { for (const u of has) matching.set(u, true); } else { const all = await this.queryRows<any>('SELECT DISTINCT coalesce(user_id, anonymous_id) AS uid FROM tp_events'); for (const r of all) { if (!has.has(r.uid)) matching.set(r.uid, true); } } }
      else { if (query.combinator==='and') { for (const u of matching.keys()) { if (!(cond.operator==='did'?has.has(u):!has.has(u))) matching.delete(u); } } else { if (cond.operator==='did') { for (const u of has) matching.set(u, true); } } }
    }
    return { type: 'segment', count: matching.size, queryTimeMs: 0 };
  }

  // ─── Metadata ──────────────────────────────────────

  async getEventNames(opts?: { limit?: number; search?: string }): Promise<string[]> {
    let sql = 'SELECT DISTINCT event_name FROM tp_events';
    if (opts?.search) sql += ` WHERE event_name LIKE '%${opts.search}%'`;
    sql += ` ORDER BY event_name LIMIT ${opts?.limit||100}`;
    const rows = await this.queryRows<{event_name: string}>(sql);
    return rows.map(r => r.event_name);
  }

  async getEventProperties(eventName: string): Promise<PropertyDefinition[]> {
    const rows = await this.queryRows<{properties: string}>(`SELECT properties FROM tp_events WHERE event_name = '${eventName}' LIMIT 100`);
    const map = new Map<string, { types: Set<string>; samples: Set<any> }>();
    for (const r of rows) { for (const [k,v] of Object.entries(JSON.parse(r.properties||'{}'))) { if (!map.has(k)) map.set(k, {types:new Set(),samples:new Set()}); const e=map.get(k)!; e.types.add(typeof v); if (e.samples.size<5) e.samples.add(v); } }
    return Array.from(map).map(([key,info]) => ({ key, type:(info.types.values().next().value||'string') as any, sampleValues:Array.from(info.samples) }));
  }

  async getEventCount(range?: DateRange): Promise<number> {
    let sql = 'SELECT COUNT(*) AS cnt FROM tp_events';
    if (range) { const {start,end}=this.resolveDateRange(range); sql += ` WHERE timestamp >= '${start}' AND timestamp < '${end}'`; }
    const [r] = await this.queryRows<{cnt: string}>(sql);
    return Number(r?.cnt||0);
  }

  async getUserCount(range?: DateRange): Promise<number> {
    let sql = 'SELECT COUNT(*) AS cnt FROM tp_users FINAL';
    if (range) { const {start,end}=this.resolveDateRange(range); sql += ` WHERE first_seen >= '${start}' AND first_seen < '${end}'`; }
    const [r] = await this.queryRows<{cnt: string}>(sql);
    return Number(r?.cnt||0);
  }

  async runRetentionCleanup(policy: RetentionPolicy): Promise<CleanupResult> {
    if (policy.events !== 'forever') {
      const cutoff = new Date(Date.now() - this.parseDays(policy.events)).toISOString();
      await this.exec(`ALTER TABLE tp_events DELETE WHERE timestamp < '${cutoff}'`);
    }
    if (policy.sessions !== 'forever') {
      const cutoff = new Date(Date.now() - this.parseDays(policy.sessions)).toISOString();
      await this.exec(`ALTER TABLE tp_sessions DELETE WHERE started_at < '${cutoff}'`);
    }
    return { deletedEvents: 0, deletedSessions: 0 }; // ClickHouse deletes are async
  }

  // ─── Helpers ───────────────────────────────────────

  private async exec(sql: string): Promise<void> {
    if (!this.client) throw new Error('ClickHouseAdapter not initialized');
    await this.client.exec({ query: sql });
  }

  private async queryRows<T>(sql: string): Promise<T[]> {
    if (!this.client) throw new Error('ClickHouseAdapter not initialized');
    const result = await this.client.query({ query: sql, format: 'JSONEachRow' });
    return result.json();
  }

  private rowToProfile(r: any): UserProfile {
    return { userId:r.user_id, anonymousIds:JSON.parse(r.anonymous_ids||'[]'), traits:JSON.parse(r.traits||'{}'), firstSeen:r.first_seen, lastSeen:r.last_seen, totalEvents:Number(r.total_events||0), totalSessions:Number(r.total_sessions||0), createdAt:r.created_at, updatedAt:r.updated_at };
  }

  private dateTrunc(interval: string): string {
    switch (interval) { case 'hour': return 'toStartOfHour(timestamp)'; case 'week': return 'toStartOfWeek(timestamp)'; case 'month': return 'toStartOfMonth(timestamp)'; default: return 'toStartOfDay(timestamp)'; }
  }

  private resolveDateRange(range: DateRange): { start: string; end: string } {
    if (range.start && range.end) return { start: range.start, end: range.end };
    const now = new Date(); const end = now.toISOString(); let ms = now.getTime();
    const days: Record<string,number> = { '24h':1, '7d':7, '14d':14, '30d':30, '90d':90, '365d':365 };
    ms -= (days[range.preset||'30d']||30) * 86400000;
    return { start: new Date(ms).toISOString(), end };
  }

  private intervalMs(i: string): number { return i==='hour'?3600000:i==='week'?604800000:i==='month'?2592000000:86400000; }
  private parseDays(v: string): number { const m=v.match(/^(\d+)d$/); return m?parseInt(m[1]!,10)*86400000:365*86400000; }
}
