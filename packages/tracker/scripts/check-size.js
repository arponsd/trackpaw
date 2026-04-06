const { readFileSync } = require('fs');
const { gzipSync } = require('zlib');

const MAX_SIZE = 5 * 1024; // 5KB

try {
  const bundle = readFileSync('dist/umd/index.min.js');
  const gzipped = gzipSync(bundle);
  const sizeKB = (gzipped.length / 1024).toFixed(2);

  console.log(`UMD bundle (gzipped): ${sizeKB} KB`);

  if (gzipped.length > MAX_SIZE) {
    console.error(`FAIL: Bundle exceeds ${MAX_SIZE / 1024}KB limit`);
    process.exit(1);
  } else {
    console.log(`PASS: Under ${MAX_SIZE / 1024}KB limit`);
  }
} catch (e) {
  console.error('Could not read bundle. Run "pnpm build" first.');
  process.exit(1);
}
