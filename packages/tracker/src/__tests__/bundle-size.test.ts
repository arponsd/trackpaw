import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { resolve } from 'path';

describe('Bundle Size', () => {
  it('UMD bundle is under 5KB gzipped', () => {
    const bundlePath = resolve(__dirname, '../../dist/umd/index.min.js');
    const bundle = readFileSync(bundlePath);
    const gzipped = gzipSync(bundle);
    const sizeKB = gzipped.length / 1024;

    console.log(`UMD gzipped size: ${sizeKB.toFixed(2)} KB`);
    expect(sizeKB).toBeLessThan(5);
  });
});
