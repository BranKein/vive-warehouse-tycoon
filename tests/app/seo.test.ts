import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verificationTags } from '../../vite.config';

const read = (page: string): string => readFileSync(fileURLToPath(new URL(`../../${page}`, import.meta.url)), 'utf8');
const SITE = 'https://warehouse-tycoon.yeonhyuk.me/';

const PAGES = [
  { language: 'ko', other: 'en', title: '창고 타이쿤 — 3D 방치형 타이쿤 게임', blurb: '방치형 타이쿤', foreign: 'idle tycoon', badge: 'PC 권장' },
  { language: 'en', other: 'ko', title: 'Warehouse Tycoon — 3D Idle Tycoon Game', blurb: 'idle tycoon', foreign: '방치형', badge: 'Best on a PC' },
] as const;

const meta = (html: string, attr: 'name' | 'property', key: string): string =>
  new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]+)"`).exec(html)?.[1] ?? '';

describe.each(PAGES)('$language/index.html for search engines', ({ language, other, title, blurb, foreign, badge }) => {
  const html = read(`${language}/index.html`);
  const url = `${SITE}${language}/`;

  it('has its title, description and canonical address in one language', () => {
    expect(html).toContain(`<html lang="${language}" data-language="${language}">`);
    expect(html).toContain(`<title>${title}</title>`);
    const description = meta(html, 'name', 'description');
    expect(description).toContain(blurb);
    expect(description).not.toContain(foreign);
    expect(html).toContain(`<link rel="canonical" href="${url}" />`);
  });

  it('points at both language pages, English for everyone else', () => {
    expect(html).toContain(`<link rel="alternate" hreflang="${language}" href="${url}" />`);
    expect(html).toContain(`<link rel="alternate" hreflang="${other}" href="${SITE}${other}/" />`);
    expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE}en/" />`);
  });

  it('has the share card', () => {
    expect(meta(html, 'property', 'og:title')).toBe(title);
    expect(meta(html, 'property', 'og:description')).not.toContain(foreign);
    expect(html).toContain(`<meta property="og:image" content="${SITE}og.jpg" />`);
    expect(html).toContain(`<meta property="og:url" content="${url}" />`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('has VideoGame structured data that parses', () => {
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(json).toBeDefined();
    const data = JSON.parse(json ?? '') as Record<string, unknown>;
    expect(data['@type']).toBe('VideoGame');
    expect(data.url).toBe(url);
    expect(data.inLanguage).toBe(language);
  });

  it('shows a visible intro that never takes input', () => {
    const intro = /<div\s+id="loading"\s+style="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(intro).toContain('pointer-events: none');
    expect(html).toContain(badge);
    expect(html).not.toContain(foreign);
  });

  it('runs the same game as the other page', () => {
    const body = (page: string): string => /<canvas[\s\S]*?<div\s+id="loading"/.exec(read(page))?.[0] ?? '';
    expect(body(`${language}/index.html`)).toBe(body(`${other}/index.html`));
    expect(html).toContain('<script type="module" src="/src/app/main.ts"></script>');
  });
});

describe('the root page', () => {
  const html = read('index.html');

  it('stays out of search results and sends visitors to a language page', () => {
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain("localStorage.getItem('warehouse-tycoon.language')");
    expect(html).toContain("location.replace('/' + language + '/' + location.search + location.hash)");
    expect(html).not.toContain('/src/app/main.ts');
  });
});

describe('sitemap.xml', () => {
  const sitemap = read('public/sitemap.xml');

  it('lists the language pages with their alternates, not the root', () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs).toEqual([`${SITE}ko/`, `${SITE}en/`, `${SITE}privacy.html`]);
    expect(sitemap.match(/hreflang="x-default" href="https:\/\/warehouse-tycoon\.yeonhyuk\.me\/en\/"/g)).toHaveLength(2);
  });
});

describe('site verification tags', () => {
  it('adds a tag for each variable that is set', () => {
    const tags = verificationTags({ GOOGLE_SITE_VERIFICATION: 'g-code', NAVER_SITE_VERIFICATION: 'n-code' });
    expect(tags.map((tag) => tag.attrs)).toEqual([
      { name: 'google-site-verification', content: 'g-code' },
      { name: 'naver-site-verification', content: 'n-code' },
    ]);
  });

  it('adds nothing for unset or empty variables', () => {
    expect(verificationTags({})).toEqual([]);
    expect(verificationTags({ GOOGLE_SITE_VERIFICATION: '', NAVER_SITE_VERIFICATION: ' ' })).toEqual([]);
    expect(verificationTags({ NAVER_SITE_VERIFICATION: 'n' })).toHaveLength(1);
  });
});
