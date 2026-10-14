import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // three.js + MediaPipe make a ~1 MB bundle; that's expected for this demo.
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
});
