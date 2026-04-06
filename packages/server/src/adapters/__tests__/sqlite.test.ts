import { SQLiteAdapter } from '../sqlite';
import { runAdapterConformanceTests } from './adapter-conformance';

runAdapterConformanceTests(
  async () => {
    const adapter = new SQLiteAdapter({ filename: ':memory:' });
    await adapter.initialize();
    return adapter;
  },
  async (adapter) => {
    await adapter.disconnect();
  },
);
