const { SQLiteAdapter } = require('@trackpaw/server');
const { AnalyticsCore } = require('@trackpaw/server');

async function seed() {
  const adapter = new SQLiteAdapter({ filename: './demo-analytics.db' });
  await adapter.initialize();
  const core = new AnalyticsCore({ adapter });

  console.log('Seeding demo data...');

  const events = ['Page View', 'Sign Up', 'Login', 'Purchase', 'Feature Used', 'Button Clicked'];
  const users = ['alice', 'bob', 'charlie', 'diana', 'eve'];
  const plans = ['free', 'pro', 'enterprise'];
  const pages = ['/home', '/pricing', '/dashboard', '/settings', '/docs'];

  const now = Date.now();

  for (let day = 30; day >= 0; day--) {
    const dayMs = now - day * 86400000;
    const numEvents = 20 + Math.floor(Math.random() * 50);

    const batch = [];
    for (let i = 0; i < numEvents; i++) {
      const event = events[Math.floor(Math.random() * events.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const ts = new Date(dayMs + Math.floor(Math.random() * 86400000)).toISOString();

      batch.push({
        event,
        properties: {
          page: pages[Math.floor(Math.random() * pages.length)],
          plan: plans[Math.floor(Math.random() * plans.length)],
          ...(event === 'Purchase' ? { amount: Math.floor(Math.random() * 100) + 9.99 } : {}),
        },
        timestamp: ts,
        userId: `user_${user}`,
        anonymousId: `anon_${user}`,
        sessionId: `sess_${user}_${day}`,
      });
    }

    await core.ingestEvents(batch, {
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Seed Script)',
    });
  }

  // Identify users
  for (const user of users) {
    await core.identifyUser(
      `user_${user}`,
      { name: user.charAt(0).toUpperCase() + user.slice(1), email: `${user}@example.com`, plan: plans[Math.floor(Math.random() * plans.length)] },
      `anon_${user}`,
    );
  }

  const meta = await core.getMetadata();
  console.log(`Seeded ${meta.eventCount} events, ${meta.userCount} users`);
  console.log(`Event types: ${meta.eventNames.join(', ')}`);

  await adapter.disconnect();
}

seed().catch(console.error);
