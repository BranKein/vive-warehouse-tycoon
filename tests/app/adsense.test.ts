import { describe, expect, it } from 'vitest';
import { adSenseClient, adSenseTags, isGamePage } from '../../vite.config';
import { AD_RAIL_MIN_VIEWPORT, AD_RAIL_WIDTH, gameAreaWidth, showAdRail } from '../../src/app/adRail';

const FULL = { ADSENSE_CLIENT: 'ca-pub-0000000000000000', ADSENSE_SLOT_SIDEBAR: '1234567890' };

describe('AdSense build tags', () => {
  it('goes on the game pages only, not the root page that sends visitors on', () => {
    expect(isGamePage('/ko/index.html')).toBe(true);
    expect(isGamePage('/en/index.html')).toBe(true);
    expect(isGamePage('/index.html')).toBe(false);
    expect(isGamePage('/src/ui/dev.html')).toBe(false);
  });

  it('normalises the publisher id', () => {
    expect(adSenseClient('ca-pub-0000000000000000')).toBe('ca-pub-0000000000000000');
    expect(adSenseClient(' pub-0000000000000000 ')).toBe('ca-pub-0000000000000000');
    expect(adSenseClient('')).toBeUndefined();
    expect(adSenseClient(undefined)).toBeUndefined();
    expect(adSenseClient('nonsense')).toBeUndefined();
  });

  it('adds the script and the rail when both variables are set', () => {
    for (const client of ['ca-pub-0000000000000000', 'pub-0000000000000000']) {
      const [script, rail, ...rest] = adSenseTags({ ...FULL, ADSENSE_CLIENT: client });
      expect(rest).toEqual([]);
      expect(script).toMatchObject({
        tag: 'script',
        injectTo: 'head',
        attrs: {
          async: true,
          crossorigin: 'anonymous',
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000',
        },
      });
      expect(rail).toMatchObject({ tag: 'aside', attrs: { id: 'ad-rail' } });
      const children = rail?.children as { tag: string; attrs?: Record<string, unknown>; children?: unknown }[];
      expect(children[0]).toMatchObject({ tag: 'span', children: '광고 · Ad' });
      expect(children[1]).toMatchObject({
        tag: 'ins',
        attrs: { class: 'adsbygoogle', 'data-ad-client': 'ca-pub-0000000000000000', 'data-ad-slot': '1234567890' },
      });
      expect(String(children[1]?.attrs?.style)).toContain('width:160px;height:600px');
    }
  });

  it('adds nothing unless both variables are set and valid', () => {
    expect(adSenseTags({})).toEqual([]);
    expect(adSenseTags({ ADSENSE_CLIENT: FULL.ADSENSE_CLIENT })).toEqual([]);
    expect(adSenseTags({ ADSENSE_SLOT_SIDEBAR: FULL.ADSENSE_SLOT_SIDEBAR })).toEqual([]);
    expect(adSenseTags({ ...FULL, ADSENSE_SLOT_SIDEBAR: '  ' })).toEqual([]);
    expect(adSenseTags({ ...FULL, ADSENSE_CLIENT: 'abc' })).toEqual([]);
  });
});

describe('ad rail layout', () => {
  it('shows the rail only on wide screens with a mouse', () => {
    expect(showAdRail(AD_RAIL_MIN_VIEWPORT, true)).toBe(true);
    expect(showAdRail(1920, true)).toBe(true);
    expect(showAdRail(AD_RAIL_MIN_VIEWPORT - 1, true)).toBe(false);
    expect(showAdRail(1920, false)).toBe(false);
  });

  it('gives the game the width beside the rail', () => {
    expect(gameAreaWidth(1920, false)).toBe(1920);
    expect(gameAreaWidth(1920, true)).toBe(1920 - AD_RAIL_WIDTH);
    expect(gameAreaWidth(0, false)).toBe(1);
  });

  it('keeps at least 16px between the game area and the 160px unit', () => {
    expect(AD_RAIL_WIDTH - 160).toBeGreaterThanOrEqual(16 + 16);
  });
});
