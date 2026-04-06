import type {
  StorageAdapter, InsertResult, DeleteResult, MigrationResult, CleanupResult,
  RetentionPolicy, PropertyDefinition, HealthCheckResult,
  ValidatedEvent, UserProfile, SessionUpdate,
  TrendsQuery, TrendsResult, FunnelQuery, FunnelResult,
  RetentionQuery, RetentionResult, EventStreamQuery, EventStreamResult,
  UserListQuery, UserListResult, SegmentQuery, SegmentResult,
  DateRange, PropertyFilter,
} from './types';

export interface MySQLAdapterConfig {
  host?: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  pool?: { min?: number; max?: number };
  connectionString?: string;
}

export class MySQLAdapter implements StorageAdapter {
  readonly engine = 'mysql' as const;
  private pool: any = null;

  constructor(private config: MySQLAdapterConfig) {}

  async initialize(): Promise<void> {
    const mysql = await import('mysql2');
    this.pool = mysql.createPool({
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      waitForConnections: true,
      connectionLimit: this.config.pool?.max || 10,
    }).promise();
    await this.runMigrations();
  }

  async disconnect(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try { await this.query('SELECT 1'); return { ok: true, latencyMs: Date.now() - start }; }
    catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  async runMigrations(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    await this.query(`
      CREATE TABLE IF NOT EXISTS tp_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(256) NOT NULL UNIQUE,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [applied] = await this.query('SELECT migration_name FROM tp_migrations');
    const appliedSet = new Set((applied as any[]).map((r: any) => r.migration_name));

    const migrations: [string, string][] = [
      ['001_create_events', `
        CREATE TABLE IF NOT EXISTS tp_events (
          id VARCHAR(64) PRIMARY KEY, event_name VARCHAR(256) NOT NULL, user_id VARCHAR(256),
          anonymous_id VARCHAR(256) NOT NULL, session_id VARCHAR(256) NOT NULL,
          properties JSON, timestamp DATETIME(3) NOT NULL, received_at DATETIME(3) NOT NULL,
          ip_address VARCHAR(45), user_agent TEXT, page_url TEXT, page_title VARCHAR(512),
          referrer TEXT, device_type VARCHAR(20), browser VARCHAR(100), os VARCHAR(100), country VARCHAR(2),
          INDEX idx_event_name (event_name), INDEX idx_user_id (user_id),
          INDEX idx_anonymous_id (anonymous_id), INDEX idx_timestamp (timestamp),
          INDEX idx_name_ts (event_name, timestamp)
        )
      `],
      ['002_create_users', `
        CREATE TABLE IF NOT EXISTS tp_users (
          user_id VARCHAR(256) PRIMARY KEY, anonymous_ids JSON, traits JSON,
          first_seen DATETIME(3) NOT NULL, last_seen DATETIME(3) NOT NULL,
          total_events INT DEFAULT 0, total_sessions INT DEFAULT 0,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )
      `],
      ['003_create_sessions', `
        CREATE TABLE IF NOT EXISTS tp_sessions (
          session_id VARCHAR(256) PRIMARY KEY, user_id VARCHAR(256), anonymous_id VARCHAR(256) NOT NULL,
          started_at DATETIME(3) NOT NULL, ended_at DATETIME(3), duration_ms INT DEFAULT 0,
          event_count INT DEFAULT 0, entry_page TEXT, exit_page TEXT, referrer TEXT,
          device_type VARCHAR(20), browser VARCHAR(100), os VARCHAR(100), country VARCHAR(2),
          is_bounce TINYINT DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          INDEX idx_sess_user (user_id), INDEX idx_sess_started (started_at)
        )
      `],
    ];

    for (const [name, sql] of migrations) {
      if (appliedSet.has(name)) continue;
      await this.query(sql);
      await this.query('INSERT INTO tp_migrations (migration_name) VALUES (?)', [name]);
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
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      await this.query('UPDATE tp_users SET traits = ?, anonymous_ids = ?, last_seen = ?, updated_at = ? WHERE user_id = ?',
        [JSON.stringify(merged), JSON.stringify(anonIds), now, now, userId]);
    } else {
      const anonIds = anonymousId ? [anonymousId] : [];
      await this.query('INSERT INTO tp_users (user_id, anonymous_ids, traits, first_seen, last_seen, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
        [userId, JSON.stringify(anonIds), JSON.stringify(traits), now, now, now, now]);
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const [rows] = await this.query('SELECT * FROM tp_users WHERE user_id = ?', [userId]);
    const r = (rows as any[])[0];
    return r ? this.rowToProfile(r) : null;
  }

  async getUsersByAnonymousId(anonymousId: string): Promise<UserProfile[]> {
    const [rows] = await this.query("SELECT * FROM tp_users WHERE JSON_CONTAINS(anonymous_ids, ?)", [JSON.stringify(anonymousId)]);
    return (rows as any[]).map((r: any) => this.rowToProfile(r));
  }

  async deleteUser(userId: string): Promise<DeleteResult> {
    const user = await this.getUserProfile(userId);
    const anonIds = user?.anonymousIds || [];

    let deletedEvents = 0;
    const [r1] = await this.query('DELETE FROM tp_events WHERE user_id = ?', [userId]);
    deletedEvents += (r1 as any).affectedRows || 0;
    for (const aid of anonIds) { const [r] = await this.query('DELETE FROM tp_events WHERE anonymous_id = ? AND user_id IS NULL', [aid]); deletedEvents += (r as any).affectedRows || 0; }

    const [r2] = await this.query('DELETE FROM tp_sessions WHERE user_id = ?', [userId]);
    const [r3] = await this.query('DELETE FROM tp_users WHERE user_id = ?', [userId]);
    return { events: deletedEvents, sessions: (r2 as any).affectedRows || 0, userProfile: ((r3 as any).affectedRows || 0) > 0 };
  }

  // ─── Session Management ────────────────────────────

  async upsertSession(session: SessionUpdate): Promise<void> {
    const now = new Date().toISOString();
    const [rows] = await this.query('SELECT * FROM tp_sessions WHERE session_id = ?', [session.sessionId]);
    if ((rows as any[]).length) {
      await this.query('UPDATE tp_sessions SET user_id = COALESCE(?, user_id), ended_at = COALESCE(?, ended_at), event_count = event_count + ?, exit_page = COALESCE(?, exit_page), updated_at = ? WHERE session_id = ?',
        [session.userId, session.endedAt, session.eventCount || 0, session.exitPage, now, session.sessionId]);
    } else {
      await this.query('INSERT INTO tp_sessions (session_id, user_id, anonymous_id, started_at, ended_at, event_count, entry_page, exit_page, referrer, device_type, browser, os, country, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [session.sessionId, session.userId, session.anonymousId, session.startedAt || now, session.endedAt, session.eventCount || 1, session.entryPage, session.exitPage, session.referrer, session.deviceType, session.browser, session.os, session.country, now, now]);
    }
  }

  // ─── Queries ───────────────────────────────────────
  // Use same application-level logic as SQLite/Postgres for funnel, retention, segment

  async queryTrends(query: TrendsQuery): Promise<TrendsResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const series: TrendsResult['series'] = [];

    for (const evt of query.events) {
      const agg = evt.aggregation || 'total';
      const bucket = this.dateTrunc(query.interval);
      const val = agg === 'unique_users' ? 'COUNT(DISTINCT COALESCE(user_id, anonymous_id))' : agg === 'unique_sessions' ? 'COUNT(DISTINCT session_id)' : 'COUNT(*)';

      let sql = `SELECT ${bucket} AS bucket, ${val} AS value`;
      const params: any[] = [evt.name, start, end];

      if (query.groupBy) {
        const key = query.groupBy.replace('properties.', '');
        sql += `, JSON_UNQUOTE(JSON_EXTRACT(properties, '$."${key}"')) AS group_value`;
      }

      sql += ` FROM tp_events WHERE event_name = ? AND timestamp >= ? AND timestamp < ?`;

      sql += ` GROUP BY bucket`;
      if (query.groupBy) sql += `, group_value`;
      sql += ` ORDER BY bucket ASC`;

      const [rows] = await this.query(sql, params);

      if (query.groupBy) {
        const groups = new Map<string, any[]>();
        for (const r of rows as any[]) { const gv = String(r.group_value ?? '(none)'); if (!groups.has(gv)) groups.set(gv, []); groups.get(gv)!.push({ date: String(r.bucket), value: Number(r.value) }); }
        for (const [gv, data] of groups) series.push({ event: evt.name, groupValue: gv, data, total: data.reduce((s, d) => s + d.value, 0) });
      } else {
        const data = (rows as any[]).map((r: any) => ({ date: String(r.bucket), value: Number(r.value) }));
        series.push({ event: evt.name, data, total: data.reduce((s, d) => s + d.value, 0) });
      }
    }
    return { type: 'trends', series, dateRange: { start, end }, queryTimeMs: 0 };
  }

  async queryFunnel(query: FunnelQuery): Promise<FunnelResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const window = query.conversionWindow || 86400 * 30;
    const names = query.steps.map(s => s.event);
    const placeholders = names.map(() => '?').join(',');
    const [rows] = await this.query(`SELECT COALESCE(user_id, anonymous_id) AS uid, event_name, timestamp FROM tp_events WHERE event_name IN (${placeholders}) AND timestamp >= ? AND timestamp < ? ORDER BY timestamp`, [...names, start, end]);

    const userEvents = new Map<string, any[]>();
    for (const r of rows as any[]) { if (!userEvents.has(r.uid)) userEvents.set(r.uid, []); userEvents.get(r.uid)!.push(r); }

    const counts = new Array(query.steps.length).fill(0);
    const times: number[][] = query.steps.map(() => []);
    for (const evts of userEvents.values()) {
      const stepTs: (number|null)[] = new Array(query.steps.length).fill(null);
      for (let i = 0; i < query.steps.length; i++) { for (const e of evts) { if (e.event_name !== query.steps[i]!.event) continue; const ts = new Date(e.timestamp).getTime(); if (i===0) { stepTs[i]=ts; break; } else if (stepTs[i-1]!==null && ts>stepTs[i-1]! && (ts-stepTs[0]!)/1000<=window) { stepTs[i]=ts; break; } } }
      for (let i = 0; i < query.steps.length; i++) { if (stepTs[i]!==null) { counts[i]++; if (i>0 && stepTs[i-1]!==null) times[i]!.push((stepTs[i]!-stepTs[i-1]!)/1000); } }
    }

    const steps = query.steps.map((s, i) => { const c=counts[i]!, prev=i===0?c:counts[i-1]!, first=counts[0]!; const t=times[i]!.sort((a,b)=>a-b); return { event:s.event, count:c, conversionRate:prev>0?(c/prev)*100:0, overallRate:first>0?(c/first)*100:0, dropoff:Math.max(0,prev-c), medianTimeBetween:t.length?t[Math.floor(t.length/2)]:undefined }; });
    return { type: 'funnel', steps, queryTimeMs: 0 };
  }

  async queryRetention(query: RetentionQuery): Promise<RetentionResult> {
    const { start, end } = this.resolveDateRange(query.dateRange);
    const bucket = this.dateTrunc(query.interval);
    const intMs = this.intervalMs(query.interval);
    const [cohortRows] = await this.query(`SELECT COALESCE(user_id, anonymous_id) AS uid, ${bucket} AS cohort_date FROM tp_events WHERE event_name = ? AND timestamp >= ? AND timestamp < ? GROUP BY uid`, [query.startEvent, start, end]);
    const userCohort = new Map<string, string>();
    for (const r of cohortRows as any[]) { const d = String(r.cohort_date); if (!userCohort.has(r.uid)) userCohort.set(r.uid, d); }
    const [returnRows] = await this.query('SELECT COALESCE(user_id, anonymous_id) AS uid, timestamp FROM tp_events WHERE event_name = ? AND timestamp >= ?', [query.returnEvent, start]);
    const cohorts = new Map<string, { size: number; periods: Map<number, Set<string>> }>();
    for (const [, cd] of userCohort) { if (!cohorts.has(cd)) cohorts.set(cd, { size: 0, periods: new Map() }); cohorts.get(cd)!.size++; }
    for (const r of returnRows as any[]) { const cd = userCohort.get(r.uid); if (!cd) continue; const period = Math.floor((new Date(r.timestamp).getTime()-new Date(cd).getTime())/intMs); if (period<0||period>query.periods) continue; const c = cohorts.get(cd)!; if (!c.periods.has(period)) c.periods.set(period, new Set()); c.periods.get(period)!.add(r.uid); }
    const result: RetentionResult['cohorts'] = [];
    for (const date of Array.from(cohorts.keys()).sort()) { const c = cohorts.get(date)!; const ret = []; for (let p=0;p<=query.periods;p++) { const cnt = c.periods.get(p)?.size??0; ret.push({ period:p, count:cnt, percentage:c.size>0?(cnt/c.size)*100:0 }); } result.push({ date, cohortSize:c.size, retention:ret }); }
    return { type: 'retention', cohorts: result, queryTimeMs: 0 };
  }

  async queryEventStream(query: EventStreamQuery): Promise<EventStreamResult> {
    const limit = Math.min(query.limit||50, 200); const offset = query.offset||0;
    const order = query.orderBy === 'timestamp_asc' ? 'ASC' : 'DESC';
    let where = '1=1'; const params: any[] = [];
    if (query.filters?.eventNames?.length) { where += ` AND event_name IN (${query.filters.eventNames.map(()=>'?').join(',')})`; params.push(...query.filters.eventNames); }
    if (query.filters?.userId) { where += ' AND user_id = ?'; params.push(query.filters.userId); }
    if (query.filters?.dateRange) { const {start,end}=this.resolveDateRange(query.filters.dateRange); where += ' AND timestamp >= ? AND timestamp < ?'; params.push(start,end); }
    const [countRows] = await this.query(`SELECT COUNT(*) AS cnt FROM tp_events WHERE ${where}`, params);
    const [rows] = await this.query(`SELECT * FROM tp_events WHERE ${where} ORDER BY timestamp ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { type: 'event_stream', events: (rows as any[]).map((r: any) => ({ id:r.id, event:r.event_name, userId:r.user_id, anonymousId:r.anonymous_id, sessionId:r.session_id, properties:typeof r.properties==='string'?JSON.parse(r.properties):r.properties||{}, timestamp:r.timestamp, context:{browser:r.browser,os:r.os,deviceType:r.device_type} })), total:Number((countRows as any[])[0].cnt), limit, offset };
  }

  async queryUserList(query: UserListQuery): Promise<UserListResult> {
    const limit = Math.min(query.limit||50,200); const offset = query.offset||0; const sort = query.sortBy||'last_seen'; const order = query.order||'desc';
    let where = '1=1'; const params: any[] = [];
    if (query.search) { where += ' AND (user_id LIKE ? OR CAST(traits AS CHAR) LIKE ?)'; params.push(`%${query.search}%`, `%${query.search}%`); }
    const [countRows] = await this.query(`SELECT COUNT(*) AS cnt FROM tp_users WHERE ${where}`, params);
    const [rows] = await this.query(`SELECT * FROM tp_users WHERE ${where} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { type: 'user_list', users: (rows as any[]).map((r: any) => ({ userId:r.user_id, traits:typeof r.traits==='string'?JSON.parse(r.traits):r.traits||{}, firstSeen:r.first_seen, lastSeen:r.last_seen, totalEvents:r.total_events, totalSessions:r.total_sessions })), total:Number((countRows as any[])[0].cnt), limit, offset };
  }

  async querySegment(query: SegmentQuery): Promise<SegmentResult> {
    const matching = new Map<string, boolean>();
    for (let i = 0; i < query.conditions.length; i++) {
      const cond = query.conditions[i]!;
      const {start,end} = cond.dateRange ? this.resolveDateRange(cond.dateRange) : {start:'1970-01-01',end:'2099-12-31'};
      const [rows] = await this.query('SELECT COALESCE(user_id, anonymous_id) AS uid, COUNT(*) AS cnt FROM tp_events WHERE event_name = ? AND timestamp >= ? AND timestamp < ? GROUP BY uid', [cond.event, start, end]);
      const has = new Set<string>();
      for (const r of rows as any[]) { let m=true; if (cond.count) { if (cond.count.operator==='gte') m=Number(r.cnt)>=cond.count.value; else if (cond.count.operator==='lte') m=Number(r.cnt)<=cond.count.value; else m=Number(r.cnt)===cond.count.value; } if (m) has.add(r.uid); }
      if (i===0) { if (cond.operator==='did') { for (const u of has) matching.set(u, true); } else { const [all] = await this.query('SELECT DISTINCT COALESCE(user_id, anonymous_id) AS uid FROM tp_events'); for (const r of all as any[]) { if (!has.has(r.uid)) matching.set(r.uid, true); } } }
      else { if (query.combinator==='and') { for (const u of matching.keys()) { if (!(cond.operator==='did'?has.has(u):!has.has(u))) matching.delete(u); } } else { if (cond.operator==='did') { for (const u of has) matching.set(u, true); } } }
    }
    return { type: 'segment', count: matching.size, queryTimeMs: 0 };
  }

  // ─── Metadata ──────────────────────────────────────

  async getEventNames(opts?: { limit?: number; search?: string }): Promise<string[]> {
    const limit = opts?.limit||100; let sql = 'SELECT DISTINCT event_name FROM tp_events'; const params: any[] = [];
    if (opts?.search) { sql += ' WHERE event_name LIKE ?'; params.push(`%${opts.search}%`); }
    sql += ' ORDER BY event_name LIMIT ?'; params.push(limit);
    const [rows] = await this.query(sql, params);
    return (rows as any[]).map(r => r.event_name);
  }

  async getEventProperties(eventName: string): Promise<PropertyDefinition[]> {
    const [rows] = await this.query('SELECT properties FROM tp_events WHERE event_name = ? LIMIT 100', [eventName]);
    const map = new Map<string, { types: Set<string>; samples: Set<any> }>();
    for (const r of rows as any[]) { const props = typeof r.properties==='string'?JSON.parse(r.properties):r.properties||{}; for (const [k,v] of Object.entries(props)) { if (!map.has(k)) map.set(k, {types:new Set(),samples:new Set()}); const e=map.get(k)!; e.types.add(typeof v); if (e.samples.size<5) e.samples.add(v); } }
    return Array.from(map).map(([key,info]) => ({ key, type:(info.types.values().next().value||'string') as any, sampleValues:Array.from(info.samples) }));
  }

  async getEventCount(range?: DateRange): Promise<number> {
    if (range) { const {start,end}=this.resolveDateRange(range); const [rows] = await this.query('SELECT COUNT(*) AS cnt FROM tp_events WHERE timestamp >= ? AND timestamp < ?', [start,end]); return Number((rows as any[])[0].cnt); }
    const [rows] = await this.query('SELECT COUNT(*) AS cnt FROM tp_events'); return Number((rows as any[])[0].cnt);
  }

  async getUserCount(range?: DateRange): Promise<number> {
    if (range) { const {start,end}=this.resolveDateRange(range); const [rows] = await this.query('SELECT COUNT(*) AS cnt FROM tp_users WHERE first_seen >= ? AND first_seen < ?', [start,end]); return Number((rows as any[])[0].cnt); }
    const [rows] = await this.query('SELECT COUNT(*) AS cnt FROM tp_users'); return Number((rows as any[])[0].cnt);
  }

  async runRetentionCleanup(policy: RetentionPolicy): Promise<CleanupResult> {
    let de=0, ds=0;
    if (policy.events!=='forever') { const c=new Date(Date.now()-this.parseDays(policy.events)).toISOString(); const [r]=await this.query('DELETE FROM tp_events WHERE timestamp < ?',[c]); de=(r as any).affectedRows||0; }
    if (policy.sessions!=='forever') { const c=new Date(Date.now()-this.parseDays(policy.sessions)).toISOString(); const [r]=await this.query('DELETE FROM tp_sessions WHERE started_at < ?',[c]); ds=(r as any).affectedRows||0; }
    return { deletedEvents:de, deletedSessions:ds };
  }

  // ─── Helpers ───────────────────────────────────────

  private async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error('MySQLAdapter not initialized');
    return this.pool.query(sql, params);
  }

  private rowToProfile(r: any): UserProfile {
    return { userId:r.user_id, anonymousIds:typeof r.anonymous_ids==='string'?JSON.parse(r.anonymous_ids):r.anonymous_ids||[], traits:typeof r.traits==='string'?JSON.parse(r.traits):r.traits||{}, firstSeen:r.first_seen, lastSeen:r.last_seen, totalEvents:r.total_events, totalSessions:r.total_sessions, createdAt:r.created_at, updatedAt:r.updated_at };
  }

  private dateTrunc(interval: string): string {
    switch (interval) { case 'hour': return "DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')"; case 'week': return "DATE(DATE_SUB(timestamp, INTERVAL WEEKDAY(timestamp) DAY))"; case 'month': return "DATE_FORMAT(timestamp, '%Y-%m-01')"; default: return "DATE(timestamp)"; }
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
