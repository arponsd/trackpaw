import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServer, ensureInitialized } from '../../../../lib/analytics-server';

async function handler(request: NextRequest) {
  await ensureInitialized();

  const server = getAnalyticsServer();
  const path = request.nextUrl.pathname.replace('/api/analytics', '');
  const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key') || '';

  // Health check (no auth)
  if (path === '/v1/health') {
    const health = await server.healthCheck();
    return NextResponse.json({
      status: health.ok ? 'ok' : 'error',
      adapter: 'sqlite',
      database: { connected: health.ok, latencyMs: health.latencyMs },
    });
  }

  // Events batch
  if (path === '/v1/events/batch' && request.method === 'POST') {
    const body = await request.json();
    const result = await server.core.ingestEvents(body.batch || [], {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || '',
    });
    return NextResponse.json(result);
  }

  // Identify
  if (path === '/v1/identify' && request.method === 'POST') {
    const { userId, traits, anonymousId } = await request.json();
    const result = await server.core.identifyUser(userId, traits || {}, anonymousId);
    return NextResponse.json({ success: true, userId, isNewUser: result.isNewUser });
  }

  // Query
  if (path === '/v1/query' && request.method === 'POST') {
    const query = await request.json();
    const result = await server.core.executeQuery(query);
    return NextResponse.json(result);
  }

  // Metadata
  if (path === '/v1/metadata') {
    const meta = await server.core.getMetadata();
    return NextResponse.json(meta);
  }

  // Events stream
  if (path === '/v1/events/stream') {
    const result = await server.core.executeQuery({
      type: 'event_stream',
      limit: 50,
      orderBy: 'timestamp_desc',
    });
    return NextResponse.json(result);
  }

  // Users list
  if (path === '/v1/users') {
    const result = await server.core.executeQuery({
      type: 'user_list',
      limit: 50,
      sortBy: 'last_seen',
      order: 'desc',
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export const GET = handler;
export const POST = handler;
