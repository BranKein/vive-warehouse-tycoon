import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const REVIEW_FILE = fileURLToPath(new URL('./src/render/models/review.json', import.meta.url));

/**
 * Dev server only: lets the model page (src/render/models.html) read and save
 * which models have been approved, in a file that is kept in the repository.
 */
const modelReview = (): Plugin => ({
  name: 'model-review',
  configureServer(server) {
    server.middlewares.use('/__models/review', (request, response) => {
      const send = (status: number, body: string): void => {
        response.statusCode = status;
        response.setHeader('Content-Type', 'application/json');
        response.end(body);
      };
      if (request.method === 'GET') {
        send(200, existsSync(REVIEW_FILE) ? readFileSync(REVIEW_FILE, 'utf8') : '{}');
        return;
      }
      if (request.method !== 'POST') {
        send(405, '{}');
        return;
      }
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString()));
      request.on('end', () => {
        try {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          const sorted = Object.fromEntries(Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b)));
          writeFileSync(REVIEW_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
          send(200, '{"ok":true}');
        } catch {
          send(400, '{"ok":false}');
        }
      });
    });
  },
});

const SHOTS_DIR = fileURLToPath(new URL('./shots/', import.meta.url));

/** Dev server only: saves a picture posted to /__shots/<name> as shots/<name>.png (not kept in the repository). */
const shots = (): Plugin => ({
  name: 'shots',
  configureServer(server) {
    server.middlewares.use('/__shots', (request, response) => {
      const name = (request.url ?? '').replace(/[^a-z0-9-]/gi, '');
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        if (request.method === 'POST' && name) {
          mkdirSync(SHOTS_DIR, { recursive: true });
          writeFileSync(`${SHOTS_DIR}${name}.png`, Buffer.concat(chunks));
        }
        response.end('{}');
      });
    });
  },
});

export default defineConfig({
  plugins: [modelReview(), shots()],
  // Saving an approval must not reload the page that saved it.
  server: { watch: { ignored: ['**/src/render/models/review.json'] } },
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
