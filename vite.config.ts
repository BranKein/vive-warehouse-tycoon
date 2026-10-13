import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // three.js alone is about 500 kB; it gets its own chunk so the game code can change without re-downloading it.
    chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined) } },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
