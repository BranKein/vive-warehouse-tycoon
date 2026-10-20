import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verificationTags } from '../../vite.config';

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
const SITE = 'https://warehouse-tycoon.yeonhyuk.me/';

describe('index.html for search engines', () => {
  it('has the title, description and canonical address', () => {
    expect(html).toMatch(/<html lang="ko">/);
    expect(html).toMatch(/<title>창고 타이쿤 · Warehouse Tycoon[^<]*<\/title>/);
    const description = /<meta\s+name="description"\s+content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(description).toContain('방치형 타이쿤');
    expect(description).toContain('idle tycoon');
    expect(html).toContain(`<link rel="canonical" href="${SITE}" />`);
  });

  it('has the share card', () => {
    expect(html).toContain(`<meta property="og:image" content="${SITE}og.jpg" />`);
    expect(html).toContain(`<meta property="og:url" content="${SITE}" />`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('has VideoGame structured data that parses', () => {
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(json).toBeDefined();
    const data = JSON.parse(json ?? '') as Record<string, unknown>;
    expect(data['@type']).toBe('VideoGame');
    expect(data.url).toBe(SITE);
    expect(data.inLanguage).toEqual(['ko', 'en']);
  });

  it('shows a visible intro that never takes input', () => {
    const intro = /<div\s+id="loading"\s+style="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(intro).toContain('pointer-events: none');
    expect(html).toContain('PC 권장 · Best on a PC');
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
