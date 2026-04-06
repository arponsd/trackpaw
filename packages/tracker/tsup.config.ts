import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'trackpaw',
    outDir: 'dist/umd',
    outExtension: () => ({ js: '.min.js' }),
    minify: true,
    sourcemap: true,
  },
]);
