import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';
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

/** Search console ownership tags: environment variable -> meta name. */
const VERIFICATION_TAGS = {
  GOOGLE_SITE_VERIFICATION: 'google-site-verification',
  NAVER_SITE_VERIFICATION: 'naver-site-verification',
} as const;

/** The verification meta tags for the variables that are set; none when nothing is set. */
export const verificationTags = (env: Record<string, string | undefined>): HtmlTagDescriptor[] =>
  Object.entries(VERIFICATION_TAGS).flatMap(([key, name]) => {
    const content = env[key]?.trim();
    return content ? [{ tag: 'meta', attrs: { name, content }, injectTo: 'head' as const }] : [];
  });

/**
 * Adds the Google and Naver ownership meta tags to every page when GOOGLE_SITE_VERIFICATION /
 * NAVER_SITE_VERIFICATION are set (in the environment or a .env file). The deploy workflow passes them
 * from the repository variables.
 */
export const siteVerification = (): Plugin => {
  let env: Record<string, string | undefined> = process.env;
  return {
    name: 'site-verification',
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ''), ...process.env };
    },
    transformIndexHtml: () => verificationTags(env),
  };
};

/** "ca-pub-123…" or "pub-123…" -> "ca-pub-123…"; undefined when the value is missing or not a publisher id. */
export const adSenseClient = (value: string | undefined): string | undefined => {
  const id = value?.trim().replace(/^ca-/, '');
  return id && /^pub-\d+$/.test(id) ? `ca-${id}` : undefined;
};

/**
 * The AdSense script and the right-hand ad rail (a 160×600 unit with a label), only when both
 * ADSENSE_CLIENT and ADSENSE_SLOT_SIDEBAR are set. src/app/adRail.ts shows the rail on wide screens
 * with a mouse and asks AdSense to fill it; otherwise it stays hidden.
 */
export const adSenseTags = (env: Record<string, string | undefined>): HtmlTagDescriptor[] => {
  const client = adSenseClient(env.ADSENSE_CLIENT);
  const slot = env.ADSENSE_SLOT_SIDEBAR?.trim();
  if (!client || !slot || !/^\d+$/.test(slot)) return [];
  return [
    {
      tag: 'script',
      attrs: { async: true, src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`, crossorigin: 'anonymous' },
      injectTo: 'head',
    },
    {
      tag: 'aside',
      attrs: { id: 'ad-rail', 'aria-label': '광고 · Ad' },
      children: [
        { tag: 'span', attrs: { class: 'ad-rail-label' }, children: '광고 · Ad' },
        {
          tag: 'ins',
          attrs: {
            class: 'adsbygoogle',
            style: 'display:inline-block;width:160px;height:600px',
            'data-ad-client': client,
            'data-ad-slot': slot,
          },
        },
      ],
      injectTo: 'body-prepend',
    },
  ];
};

/** The game pages, one per language. The root index.html only sends visitors to one of them. */
export const GAME_PAGES = ['ko/index.html', 'en/index.html'] as const;

/** True for the game pages (`/ko/index.html`, `/en/index.html`), the only pages that get ads. */
export const isGamePage = (path: string): boolean => GAME_PAGES.some((page) => path.replace(/^\//, '') === page);

/** Adds the AdSense script and ad rail to the game pages when ADSENSE_CLIENT / ADSENSE_SLOT_SIDEBAR are set. */
export const adSense = (): Plugin => {
  let env: Record<string, string | undefined> = process.env;
  return {
    name: 'adsense',
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ''), ...process.env };
    },
    transformIndexHtml: (_html, { path }) => (isGamePage(path) ? adSenseTags(env) : []),
  };
};

/** Cloud save keys: environment variable -> constant the game reads. Missing keys leave that provider out. */
const CLOUD_KEYS = {
  GOOGLE_OAUTH_CLIENT_ID: '__GOOGLE_OAUTH_CLIENT_ID__',
} as const;

/** `define` entries for the cloud keys; an unset key becomes an empty string. */
export const cloudKeyDefines = (env: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(CLOUD_KEYS).map(([key, name]) => [name, JSON.stringify(env[key]?.trim() ?? '')]));

/**
 * Puts the cloud save keys (GOOGLE_OAUTH_CLIENT_ID, from the environment or a .env file) into the build. They are
 * public by design: a browser-only OAuth client is locked to its allowed origins, not kept secret.
 */
export const cloudKeys = (): Plugin => ({
  name: 'cloud-keys',
  config(config, { mode }) {
    const env = { ...loadEnv(mode, config.root ?? process.cwd(), ''), ...process.env };
    return { define: cloudKeyDefines(env) };
  },
});

export default defineConfig({
  plugins: [modelReview(), shots(), siteVerification(), adSense(), cloudKeys()],
  // Saving an approval must not reload the page that saved it.
  server: { watch: { ignored: ['**/src/render/models/review.json'] } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // three.js alone is about 500 kB; it gets its own chunk so the game code can change without re-downloading it.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        root: fileURLToPath(new URL('./index.html', import.meta.url)),
        ko: fileURLToPath(new URL('./ko/index.html', import.meta.url)),
        en: fileURLToPath(new URL('./en/index.html', import.meta.url)),
      },
      output: { manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined) },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
