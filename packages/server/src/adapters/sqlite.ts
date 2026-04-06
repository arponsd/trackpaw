import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  StorageAdapter,
  InsertResult,
  DeleteResult,
  MigrationResult,
  CleanupResult,
  RetentionPolicy,
  PropertyDefinition,
  HealthCheckResult,
  ValidatedEvent,
  UserProfile,
  SessionUpdate,
  TrendsQuery,
  TrendsResult,
  FunnelQuery,
  FunnelResult,
  RetentionQuery,
  RetentionResult,
  EventStreamQuery,
  EventStreamResult,
  UserListQuery,
  UserListResult,
  SegmentQuery,
  SegmentResult,
  DateRange,
  PropertyFilter,
} from './types';

export interface SQLiteAdapterConfig {
  filename: string;
  walMode?: boolean;
  retention?: {
    events: string;
    sessions: string;
    users: string;
  };
}

const MIGRATIONS_DIR = join(__dirname, 'migrations', 'sqlite');

export class SQLiteAdapter implements StorageAdapter {
  readonly engine = 'sqlite' as const;
  private db: Database.Database | null = null;
  private config: SQLiteAdapterConfig;

  constructor(config: SQLiteAdapterConfig) {
    this.config = { walMode: true, ...config };
  }

  async initialize(): Promise<void> {
    this.db = new Database(this.config.filename);

    if (this.config.walMode && this.config.filename !== ':memory:') {
      this.db.pragma('journal_mode = WAL');
    }
    this.db.pragma('foreign_keys = ON');

    await this.runMigrations();
  }

  async disconnect(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      this.getDb().prepare('SELECT 1').get();
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async runMigrations(): Promise<MigrationResult[]> {
    const db = this.getDb();
    const results: MigrationResult[] = [];

    // Ensure migrations table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS tp_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      )
    `);

    const applied = new Set(
      db
        .prepare('SELECT migration_name FROM tp_migrations')
        .all()
        .map((r: any) => r.migration_name as string),
    );

    const migrations = [
      '001_create_events',
      '002_create_users',
      '003_create_sessions',
    ];

    for (const name of migrations) {
      if (applied.has(name)) continue;

      let sql: string;
      try {
        sql = readFileSync(join(MIGRATIONS_DIR, `${name}.sql`), 'utf-8');
      } catch {
        // Fallback: inline migrations for bundled distributions
        sql = this.getInlineMigration(name);
      }

      db.exec(sql);
      const now = new Date().toISOString();
      db.prepare('INSERT INTO tp_migrations (migration_name, applied_at) VALUES (?, ?)').run(
        name,
        now,
      );
      results.push({ name, appliedAt: now });
    }

    return results;
  }

  private getInlineMigration(name: string): string {
    const migrations: Record<string, string> = {
      '001_create_events': `
        CREATE TABLE IF NOT EXISTS tp_events (
          id TEXT PRIMARY KEY, event_name TEXT NOT NULL, user_id TEXT,
          anonymous_id TEXT NOT NULL, session_id TEXT NOT NULL,
          properties TEXT DEFAULT '{}', timestamp TEXT NOT NULL, received_at TEXT NOT NULL,
          ip_address TEXT, user_agent TEXT, page_url TEXT, page_title TEXT,
          referrer TEXT, device_type TEXT, browser TEXT, os TEXT, country TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_events_event_name ON tp_events (event_name);
        CREATE INDEX IF NOT EXISTS idx_events_user_id ON tp_events (user_id);
        CREATE INDEX IF NOT EXISTS idx_events_anonymous_id ON tp_events (anonymous_id);
        CREATE INDEX IF NOT EXISTS idx_events_session_id ON tp_events (session_id);
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON tp_events (timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_name_timestamp ON tp_events (event_name, timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_user_timestamp ON tp_events (user_id, timestamp);
      `,
      '002_create_users': `
        CREATE TABLE IF NOT EXISTS tp_users (
          user_id TEXT PRIMARY KEY, anonymous_ids TEXT DEFAULT '[]',
          traits TEXT DEFAULT '{}', first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
          total_events INTEGER DEFAULT 0, total_sessions INTEGER DEFAULT 0,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_first_seen ON tp_users (first_seen);
        CREATE INDEX IF NOT EXISTS idx_users_last_seen ON tp_users (last_seen);
      `,
      '003_create_sessions': `
        CREATE TABLE IF NOT EXISTS tp_sessions (
          session_id TEXT PRIMARY KEY, user_id TEXT, anonymous_id TEXT NOT NULL,
          started_at TEXT NOT NULL, ended_at TEXT, duration_ms INTEGER DEFAULT 0,
          event_count INTEGER DEFAULT 0, entry_page TEXT, exit_page TEXT,
          referrer TEXT, device_type TEXT, browser TEXT, os TEXT, country TEXT,
          is_bounce INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON tp_sessions (user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_anonymous_id ON tp_sessions (anonymous_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON tp_sessions (started_at);
      `,
    };
    return migrations[name] || '';
  }

  // ─── Event Ingestion ───────────────────────────────────────────

  async insertEvents(events: ValidatedEvent[]): Promise<InsertResult> {
    const db = this.getDb();
    let inserted = 0;
    let failed = 0;

    const stmt = db.prepare(`
      INSERT INTO tp_events (
        id, event_name, user_id, anonymous_id, session_id, properties,
        timestamp, received_at, ip_address, user_agent, page_url, page_title,
        referrer, device_type, browser, os, country
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((evts: ValidatedEvent[]) => {
      for (const e of evts) {
        try {
          stmt.run(
            e.id, e.eventName, e.userId, e.anonymousId, e.sessionId,
            JSON.stringify(e.properties), e.timestamp, e.receivedAt,
            e.ipAddress, e.userAgent, e.pageUrl, e.pageTitle,
            e.referrer, e.deviceType, e.browser, e.os, e.country,
          );
          inserted++;
        } catch {
          failed++;
        }
      }
    });

    insertMany(events);
    return { inserted, failed };
  }

  // ─── User Management ──────────────────────────────────────────

  async upsertUser(
    userId: string,
    traits: Record<string, any>,
    anonymousId?: string,
  ): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM tp_users WHERE user_id = ?').get(userId) as any;

    if (existing) {
      const existingTraits = JSON.parse(existing.traits || '{}');
      const mergedTraits = { ...existingTraits, ...traits };

      let anonIds: string[] = JSON.parse(existing.anonymous_ids || '[]');
      if (anonymousId && !anonIds.includes(anonymousId)) {
        anonIds.push(anonymousId);
      }

      db.prepare(`
        UPDATE tp_users SET traits = ?, anonymous_ids = ?, last_seen = ?, updated_at = ?
        WHERE user_id = ?
      `).run(JSON.stringify(mergedTraits), JSON.stringify(anonIds), now, now, userId);
    } else {
      const anonIds = anonymousId ? [anonymousId] : [];
      db.prepare(`
        INSERT INTO tp_users (user_id, anonymous_ids, traits, first_seen, last_seen, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, JSON.stringify(anonIds), JSON.stringify(traits), now, now, now, now);
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const row = this.getDb()
      .prepare('SELECT * FROM tp_users WHERE user_id = ?')
      .get(userId) as any;
    return row ? this.rowToUserProfile(row) : null;
  }

  async getUsersByAnonymousId(anonymousId: string): Promise<UserProfile[]> {
    const rows = this.getDb()
      .prepare("SELECT * FROM tp_users WHERE anonymous_ids LIKE ?")
      .all(`%"${anonymousId}"%`) as any[];
    return rows.map((r) => this.rowToUserProfile(r));
  }

  async deleteUser(userId: string): Promise<DeleteResult> {
    const db = this.getDb();

    // Get anonymous IDs to also delete their events
    const user = await this.getUserProfile(userId);
    const anonIds = user?.anonymousIds || [];

    // Delete events by user_id
    const evtResult = db.prepare('DELETE FROM tp_events WHERE user_id = ?').run(userId);
    let deletedEvents = evtResult.changes;

    // Delete events by anonymous_ids
    for (const anonId of anonIds) {
      const r = db.prepare('DELETE FROM tp_events WHERE anonymous_id = ? AND user_id IS NULL').run(anonId);
      deletedEvents += r.changes;
    }

    // Delete sessions
    const sessResult = db.prepare('DELETE FROM tp_sessions WHERE user_id = ?').run(userId);
    let deletedSessions = sessResult.changes;
    for (const anonId of anonIds) {
      const r = db.prepare('DELETE FROM tp_sessions WHERE anonymous_id = ? AND user_id IS NULL').run(anonId);
      deletedSessions += r.changes;
    }

    // Delete user profile
    const userResult = db.prepare('DELETE FROM tp_users WHERE user_id = ?').run(userId);

    return {
      events: deletedEvents,
      sessions: deletedSessions,
      userProfile: userResult.changes > 0,
    };
  }

  // ─── Session Management ────────────────────────────────────────

  async upsertSession(session: SessionUpdate): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();

    const existing = db
      .prepare('SELECT * FROM tp_sessions WHERE session_id = ?')
      .get(session.sessionId) as any;

    if (existing) {
      const endedAt = session.endedAt || existing.ended_at || now;
      const startedAt = existing.started_at;
      const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
      const eventCount = (session.eventCount ?? 0) + (existing.event_count || 0);

      db.prepare(`
        UPDATE tp_sessions SET
          user_id = COALESCE(?, user_id), ended_at = ?, duration_ms = ?,
          event_count = ?, exit_page = COALESCE(?, exit_page), updated_at = ?
        WHERE session_id = ?
      `).run(
        session.userId, endedAt, Math.max(0, durationMs),
        eventCount, session.exitPage, now, session.sessionId,
      );
    } else {
      db.prepare(`
        INSERT INTO tp_sessions (
          session_id, user_id, anonymous_id, started_at, ended_at, duration_ms,
          event_count, entry_page, exit_page, referrer, device_type, browser, os,
          country, is_bounce, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        session.sessionId, session.userId || null, session.anonymousId,
        session.startedAt || now, session.endedAt || null,
        session.eventCount || 1, session.entryPage || null, session.exitPage || null,
        session.referrer || null, session.deviceType || null, session.browser || null,
        session.os || null, session.country || null, now, now,
      );
    }
  }

  // ─── Query Engine ──────────────────────────────────────────────

  async queryTrends(query: TrendsQuery): Promise<TrendsResult> {
    const db = this.getDb();
    const { start, end } = this.resolveDateRange(query.dateRange);
    const series: TrendsResult['series'] = [];

    for (const eventDef of query.events) {
      const agg = eventDef.aggregation || 'total';
      const bucketExpr = this.dateTrunc(query.interval);

      let selectValue: string;
      if (agg === 'unique_users') {
        selectValue = 'COUNT(DISTINCT COALESCE(user_id, anonymous_id))';
      } else if (agg === 'unique_sessions') {
        selectValue = 'COUNT(DISTINCT session_id)';
      } else {
        selectValue = 'COUNT(*)';
      }

      let sql = `SELECT ${bucketExpr} AS bucket, ${selectValue} AS value`;
      const params: any[] = [];

      if (query.groupBy) {
        const groupCol = this.jsonExtract(query.groupBy);
        sql += `, ${groupCol} AS group_value`;
      }

      sql += ` FROM tp_events WHERE event_name = ? AND timestamp >= ? AND timestamp < ?`;
      params.push(eventDef.name, start, end);

      // Apply event-level filters
      if (eventDef.filters) {
        for (const f of eventDef.filters) {
          const { clause, param } = this.buildFilterClause(f);
          sql += ` AND ${clause}`;
          if (param !== undefined) params.push(param);
        }
      }

      // Apply global filters
      if (query.filters) {
        for (const f of query.filters) {
          const { clause, param } = this.buildFilterClause(f);
          sql += ` AND ${clause}`;
          if (param !== undefined) params.push(param);
        }
      }

      sql += ` GROUP BY bucket`;
      if (query.groupBy) sql += `, group_value`;
      sql += ` ORDER BY bucket ASC`;

      const rows = db.prepare(sql).all(...params) as any[];

      if (query.groupBy) {
        const groups = new Map<string, { date: string; value: number }[]>();
        for (const row of rows) {
          const gv = String(row.group_value ?? '(none)');
          if (!groups.has(gv)) groups.set(gv, []);
          groups.get(gv)!.push({ date: row.bucket, value: row.value });
        }
        for (const [groupValue, data] of groups) {
          series.push({
            event: eventDef.name,
            groupValue,
            data,
            total: data.reduce((s, d) => s + d.value, 0),
          });
        }
      } else {
        const data = rows.map((r) => ({ date: r.bucket, value: r.value }));
        series.push({
          event: eventDef.name,
          data,
          total: data.reduce((s, d) => s + d.value, 0),
        });
      }
    }

    return { type: 'trends', series, dateRange: { start, end }, queryTimeMs: 0 };
  }

  async queryFunnel(query: FunnelQuery): Promise<FunnelResult> {
    const db = this.getDb();
    const { start, end } = this.resolveDateRange(query.dateRange);
    const windowSec = query.conversionWindow || 86400 * 30;

    // Get all relevant events grouped by user
    const eventNames = query.steps.map((s) => s.event);
    const placeholders = eventNames.map(() => '?').join(',');

    const rows = db.prepare(`
      SELECT COALESCE(user_id, anonymous_id) AS uid, event_name, timestamp
      FROM tp_events
      WHERE event_name IN (${placeholders}) AND timestamp >= ? AND timestamp < ?
      ORDER BY timestamp ASC
    `).all(...eventNames, start, end) as any[];

    // Group by user
    const userEvents = new Map<string, { event_name: string; timestamp: string }[]>();
    for (const row of rows) {
      if (!userEvents.has(row.uid)) userEvents.set(row.uid, []);
      userEvents.get(row.uid)!.push(row);
    }

    // Calculate funnel
    const stepCounts: number[] = new Array(query.steps.length).fill(0);
    const timeBetween: number[][] = query.steps.map(() => []);

    for (const events of userEvents.values()) {
      const stepTimes: (number | null)[] = new Array(query.steps.length).fill(null);

      for (let i = 0; i < query.steps.length; i++) {
        const stepEvent = query.steps[i]!.event;
        for (const e of events) {
          if (e.event_name !== stepEvent) continue;
          const ts = new Date(e.timestamp).getTime();

          if (i === 0) {
            stepTimes[i] = ts;
            break;
          } else if (stepTimes[i - 1] !== null) {
            const prevTs = stepTimes[i - 1]!;
            if (ts > prevTs && (ts - stepTimes[0]!) / 1000 <= windowSec) {
              stepTimes[i] = ts;
              break;
            }
          }
        }
      }

      for (let i = 0; i < query.steps.length; i++) {
        if (stepTimes[i] !== null) {
          stepCounts[i]!++;
          if (i > 0 && stepTimes[i - 1] !== null) {
            timeBetween[i]!.push((stepTimes[i]! - stepTimes[i - 1]!) / 1000);
          }
        }
      }
    }

    const steps = query.steps.map((step, i) => {
      const count = stepCounts[i]!;
      const prevCount = i === 0 ? count : stepCounts[i - 1]!;
      const firstCount = stepCounts[0]!;
      const times = timeBetween[i]!;
      times.sort((a, b) => a - b);

      return {
        event: step.event,
        count,
        conversionRate: prevCount > 0 ? (count / prevCount) * 100 : 0,
        overallRate: firstCount > 0 ? (count / firstCount) * 100 : 0,
        dropoff: Math.max(0, prevCount - count),
        medianTimeBetween: times.length > 0 ? times[Math.floor(times.length / 2)] : undefined,
      };
    });

    return { type: 'funnel', steps, queryTimeMs: 0 };
  }

  async queryRetention(query: RetentionQuery): Promise<RetentionResult> {
    const db = this.getDb();
    const { start, end } = this.resolveDateRange(query.dateRange);
    const bucketFn = this.dateTrunc(query.interval);
    const intervalMs = this.intervalToMs(query.interval);

    // Get cohorts: users who did the start event
    const cohortRows = db.prepare(`
      SELECT COALESCE(user_id, anonymous_id) AS uid,
             ${bucketFn} AS cohort_date
      FROM tp_events
      WHERE event_name = ? AND timestamp >= ? AND timestamp < ?
      GROUP BY uid
    `).all(query.startEvent, start, end) as any[];

    // Map uid → cohort_date (earliest)
    const userCohort = new Map<string, string>();
    for (const row of cohortRows) {
      if (!userCohort.has(row.uid)) {
        userCohort.set(row.uid, row.cohort_date);
      }
    }

    // Get return events
    const returnRows = db.prepare(`
      SELECT COALESCE(user_id, anonymous_id) AS uid, timestamp
      FROM tp_events
      WHERE event_name = ? AND timestamp >= ?
    `).all(query.returnEvent, start) as any[];

    // Build cohort grid
    const cohorts = new Map<string, { size: number; periods: Map<number, Set<string>> }>();

    for (const [uid, cohortDate] of userCohort) {
      if (!cohorts.has(cohortDate)) {
        cohorts.set(cohortDate, { size: 0, periods: new Map() });
      }
      cohorts.get(cohortDate)!.size++;
    }

    for (const row of returnRows) {
      const uid = row.uid;
      const cohortDate = userCohort.get(uid);
      if (!cohortDate) continue;

      const cohortTs = new Date(cohortDate).getTime();
      const eventTs = new Date(row.timestamp).getTime();
      const period = Math.floor((eventTs - cohortTs) / intervalMs);

      if (period < 0 || period > query.periods) continue;

      const cohort = cohorts.get(cohortDate)!;
      if (!cohort.periods.has(period)) cohort.periods.set(period, new Set());
      cohort.periods.get(period)!.add(uid);
    }

    const result: RetentionResult['cohorts'] = [];
    const sortedDates = Array.from(cohorts.keys()).sort();

    for (const date of sortedDates) {
      const cohort = cohorts.get(date)!;
      const retention = [];
      for (let p = 0; p <= query.periods; p++) {
        const count = cohort.periods.get(p)?.size ?? 0;
        retention.push({
          period: p,
          count,
          percentage: cohort.size > 0 ? (count / cohort.size) * 100 : 0,
        });
      }
      result.push({ date, cohortSize: cohort.size, retention });
    }

    return { type: 'retention', cohorts: result, queryTimeMs: 0 };
  }

  async queryEventStream(query: EventStreamQuery): Promise<EventStreamResult> {
    const db = this.getDb();
    const limit = Math.min(query.limit || 50, 200);
    const offset = query.offset || 0;
    const order = query.orderBy === 'timestamp_asc' ? 'ASC' : 'DESC';

    let where = '1=1';
    const params: any[] = [];

    if (query.filters?.eventNames?.length) {
      const ph = query.filters.eventNames.map(() => '?').join(',');
      where += ` AND event_name IN (${ph})`;
      params.push(...query.filters.eventNames);
    }
    if (query.filters?.userId) {
      where += ` AND user_id = ?`;
      params.push(query.filters.userId);
    }
    if (query.filters?.anonymousId) {
      where += ` AND anonymous_id = ?`;
      params.push(query.filters.anonymousId);
    }
    if (query.filters?.sessionId) {
      where += ` AND session_id = ?`;
      params.push(query.filters.sessionId);
    }
    if (query.filters?.dateRange) {
      const { start, end } = this.resolveDateRange(query.filters.dateRange);
      where += ` AND timestamp >= ? AND timestamp < ?`;
      params.push(start, end);
    }

    const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM tp_events WHERE ${where}`).get(...params) as any;
    const total = totalRow.cnt;

    const rows = db.prepare(
      `SELECT * FROM tp_events WHERE ${where} ORDER BY timestamp ${order} LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as any[];

    const events = rows.map((r) => ({
      id: r.id,
      event: r.event_name,
      userId: r.user_id,
      anonymousId: r.anonymous_id,
      sessionId: r.session_id,
      properties: JSON.parse(r.properties || '{}'),
      timestamp: r.timestamp,
      context: {
        browser: r.browser,
        os: r.os,
        deviceType: r.device_type,
      },
    }));

    return { type: 'event_stream', events, total, limit, offset };
  }

  async queryUserList(query: UserListQuery): Promise<UserListResult> {
    const db = this.getDb();
    const limit = Math.min(query.limit || 50, 200);
    const offset = query.offset || 0;
    const sortBy = query.sortBy || 'last_seen';
    const order = query.order || 'desc';

    let where = '1=1';
    const params: any[] = [];

    if (query.search) {
      where += ` AND (user_id LIKE ? OR traits LIKE ?)`;
      params.push(`%${query.search}%`, `%${query.search}%`);
    }

    const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM tp_users WHERE ${where}`).get(...params) as any;

    const rows = db.prepare(
      `SELECT * FROM tp_users WHERE ${where} ORDER BY ${sortBy} ${order.toUpperCase()} LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as any[];

    const users = rows.map((r) => ({
      userId: r.user_id,
      traits: JSON.parse(r.traits || '{}'),
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      totalEvents: r.total_events,
      totalSessions: r.total_sessions,
    }));

    return { type: 'user_list', users, total: totalRow.cnt, limit, offset };
  }

  async querySegment(query: SegmentQuery): Promise<SegmentResult> {
    const db = this.getDb();
    const matchingUsers = new Map<string, boolean>();

    for (let i = 0; i < query.conditions.length; i++) {
      const cond = query.conditions[i]!;
      const { start, end } = cond.dateRange
        ? this.resolveDateRange(cond.dateRange)
        : { start: '1970-01-01', end: '2099-12-31' };

      const rows = db.prepare(`
        SELECT COALESCE(user_id, anonymous_id) AS uid, COUNT(*) AS cnt
        FROM tp_events
        WHERE event_name = ? AND timestamp >= ? AND timestamp < ?
        GROUP BY uid
      `).all(cond.event, start, end) as any[];

      const usersWithEvent = new Set<string>();
      for (const row of rows) {
        let match = true;
        if (cond.count) {
          const cnt = row.cnt;
          if (cond.count.operator === 'gte') match = cnt >= cond.count.value;
          else if (cond.count.operator === 'lte') match = cnt <= cond.count.value;
          else if (cond.count.operator === 'eq') match = cnt === cond.count.value;
        }
        if (match) usersWithEvent.add(row.uid);
      }

      if (i === 0) {
        if (cond.operator === 'did') {
          for (const uid of usersWithEvent) matchingUsers.set(uid, true);
        } else {
          // did_not: get all users and exclude
          const allUsers = db.prepare(
            'SELECT DISTINCT COALESCE(user_id, anonymous_id) AS uid FROM tp_events',
          ).all() as any[];
          for (const r of allUsers) {
            if (!usersWithEvent.has(r.uid)) matchingUsers.set(r.uid, true);
          }
        }
      } else {
        const combiner = query.combinator;
        if (combiner === 'and') {
          for (const uid of matchingUsers.keys()) {
            const meets =
              cond.operator === 'did' ? usersWithEvent.has(uid) : !usersWithEvent.has(uid);
            if (!meets) matchingUsers.delete(uid);
          }
        } else {
          if (cond.operator === 'did') {
            for (const uid of usersWithEvent) matchingUsers.set(uid, true);
          }
        }
      }
    }

    const count = matchingUsers.size;
    return { type: 'segment', count, queryTimeMs: 0 };
  }

  // ─── Metadata ──────────────────────────────────────────────────

  async getEventNames(options?: { limit?: number; search?: string }): Promise<string[]> {
    const db = this.getDb();
    const limit = options?.limit || 100;
    let sql = 'SELECT DISTINCT event_name FROM tp_events';
    const params: any[] = [];

    if (options?.search) {
      sql += ' WHERE event_name LIKE ?';
      params.push(`%${options.search}%`);
    }
    sql += ' ORDER BY event_name LIMIT ?';
    params.push(limit);

    return (db.prepare(sql).all(...params) as any[]).map((r) => r.event_name);
  }

  async getEventProperties(eventName: string): Promise<PropertyDefinition[]> {
    const db = this.getDb();
    const rows = db.prepare(
      'SELECT properties FROM tp_events WHERE event_name = ? LIMIT 100',
    ).all(eventName) as any[];

    const propMap = new Map<string, { types: Set<string>; samples: Set<any> }>();

    for (const row of rows) {
      const props = JSON.parse(row.properties || '{}');
      for (const [key, value] of Object.entries(props)) {
        if (!propMap.has(key)) {
          propMap.set(key, { types: new Set(), samples: new Set() });
        }
        const entry = propMap.get(key)!;
        entry.types.add(typeof value);
        if (entry.samples.size < 5) entry.samples.add(value);
      }
    }

    return Array.from(propMap.entries()).map(([key, info]) => ({
      key,
      type: (info.types.values().next().value || 'string') as any,
      sampleValues: Array.from(info.samples),
    }));
  }

  async getEventCount(range?: DateRange): Promise<number> {
    const db = this.getDb();
    if (range) {
      const { start, end } = this.resolveDateRange(range);
      const row = db.prepare(
        'SELECT COUNT(*) AS cnt FROM tp_events WHERE timestamp >= ? AND timestamp < ?',
      ).get(start, end) as any;
      return row.cnt;
    }
    return (db.prepare('SELECT COUNT(*) AS cnt FROM tp_events').get() as any).cnt;
  }

  async getUserCount(range?: DateRange): Promise<number> {
    const db = this.getDb();
    if (range) {
      const { start, end } = this.resolveDateRange(range);
      const row = db.prepare(
        'SELECT COUNT(*) AS cnt FROM tp_users WHERE first_seen >= ? AND first_seen < ?',
      ).get(start, end) as any;
      return row.cnt;
    }
    return (db.prepare('SELECT COUNT(*) AS cnt FROM tp_users').get() as any).cnt;
  }

  // ─── Maintenance ───────────────────────────────────────────────

  async runRetentionCleanup(policy: RetentionPolicy): Promise<CleanupResult> {
    const db = this.getDb();
    let deletedEvents = 0;
    let deletedSessions = 0;

    if (policy.events !== 'forever') {
      const cutoff = new Date(Date.now() - this.parseDuration(policy.events)).toISOString();
      const r = db.prepare('DELETE FROM tp_events WHERE timestamp < ?').run(cutoff);
      deletedEvents = r.changes;
    }

    if (policy.sessions !== 'forever') {
      const cutoff = new Date(Date.now() - this.parseDuration(policy.sessions)).toISOString();
      const r = db.prepare('DELETE FROM tp_sessions WHERE started_at < ?').run(cutoff);
      deletedSessions = r.changes;
    }

    return { deletedEvents, deletedSessions };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private getDb(): Database.Database {
    if (!this.db) throw new Error('SQLiteAdapter not initialized. Call initialize() first.');
    return this.db;
  }

  private rowToUserProfile(row: any): UserProfile {
    return {
      userId: row.user_id,
      anonymousIds: JSON.parse(row.anonymous_ids || '[]'),
      traits: JSON.parse(row.traits || '{}'),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      totalEvents: row.total_events,
      totalSessions: row.total_sessions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private dateTrunc(interval: string): string {
    switch (interval) {
      case 'hour': return "strftime('%Y-%m-%dT%H:00:00Z', timestamp)";
      case 'day': return "strftime('%Y-%m-%d', timestamp)";
      case 'week': return "strftime('%Y-%m-%d', timestamp, 'weekday 0', '-6 days')";
      case 'month': return "strftime('%Y-%m-01', timestamp)";
      default: return "strftime('%Y-%m-%d', timestamp)";
    }
  }

  private jsonExtract(path: string): string {
    const key = path.startsWith('properties.') ? path.slice('properties.'.length) : path;
    return `json_extract(properties, '$.${key}')`;
  }

  private buildFilterClause(filter: PropertyFilter): { clause: string; param?: any } {
    const col = this.jsonExtract(filter.key);
    switch (filter.operator) {
      case 'eq': return { clause: `${col} = ?`, param: filter.value };
      case 'neq': return { clause: `${col} != ?`, param: filter.value };
      case 'gt': return { clause: `${col} > ?`, param: filter.value };
      case 'gte': return { clause: `${col} >= ?`, param: filter.value };
      case 'lt': return { clause: `${col} < ?`, param: filter.value };
      case 'lte': return { clause: `${col} <= ?`, param: filter.value };
      case 'contains': return { clause: `${col} LIKE ?`, param: `%${filter.value}%` };
      case 'not_contains': return { clause: `${col} NOT LIKE ?`, param: `%${filter.value}%` };
      case 'is_set': return { clause: `${col} IS NOT NULL` };
      case 'is_not_set': return { clause: `${col} IS NULL` };
      case 'in': {
        const ph = (filter.values || []).map(() => '?').join(',');
        return { clause: `${col} IN (${ph})`, param: filter.values };
      }
      default: return { clause: '1=1' };
    }
  }

  private resolveDateRange(range: DateRange): { start: string; end: string } {
    if (range.start && range.end) {
      return { start: range.start, end: range.end };
    }

    const now = new Date();
    const end = now.toISOString();
    let startMs = now.getTime();

    switch (range.preset) {
      case '24h': startMs -= 24 * 60 * 60 * 1000; break;
      case '7d': startMs -= 7 * 24 * 60 * 60 * 1000; break;
      case '14d': startMs -= 14 * 24 * 60 * 60 * 1000; break;
      case '30d': startMs -= 30 * 24 * 60 * 60 * 1000; break;
      case '90d': startMs -= 90 * 24 * 60 * 60 * 1000; break;
      case '365d': startMs -= 365 * 24 * 60 * 60 * 1000; break;
      default: startMs -= 30 * 24 * 60 * 60 * 1000;
    }

    return { start: new Date(startMs).toISOString(), end };
  }

  private intervalToMs(interval: string): number {
    switch (interval) {
      case 'hour': return 3600000;
      case 'day': return 86400000;
      case 'week': return 604800000;
      case 'month': return 2592000000; // ~30 days
      default: return 86400000;
    }
  }

  private parseDuration(value: string): number {
    const match = value.match(/^(\d+)d$/);
    if (!match) return 365 * 86400000;
    return parseInt(match[1]!, 10) * 86400000;
  }
}
