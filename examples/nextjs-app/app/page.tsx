'use client';

import { getTracker } from '../lib/analytics';

export default function Home() {
  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#6366f1' }}>Trackpaw Next.js Demo</h1>
      <p>This page demonstrates Trackpaw with Next.js App Router.</p>

      <div style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
        <button
          onClick={() => getTracker()?.track('Button Clicked', { id: 'cta' })}
          style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Track Click
        </button>
        <button
          onClick={() => getTracker()?.identify('user_demo', { name: 'Demo User' })}
          style={{ padding: '10px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Identify User
        </button>
      </div>

      <p><a href="/admin/analytics" style={{ color: '#6366f1' }}>View Analytics Dashboard</a></p>
    </main>
  );
}
