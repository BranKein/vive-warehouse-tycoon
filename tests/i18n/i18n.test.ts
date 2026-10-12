import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import { DEFAULT_LANGUAGE, I18n, interpolate, keys, LANGUAGE_STORAGE_KEY, type LanguageStorage } from '@/i18n';
import { en } from '@/i18n/en';
import { ko } from '@/i18n/ko';

const memoryStorage = (initial: Record<string, string> = {}): LanguageStorage & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
};

describe('translation tables', () => {
  it('has the same keys in English and Korean', () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const table of [en, ko]) {
      for (const [key, value] of Object.entries(table)) expect(value, key).not.toBe('');
    }
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(ko[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('names every piece of content in the catalog', () => {
    const island = Object.values(catalog.islands);
    const wanted = [
      ...Object.keys(catalog.items).map(keys.itemName),
      ...Object.keys(catalog.buildings).flatMap((id) => [keys.buildingName(id), keys.buildingDesc(id)]),
      ...Object.keys(catalog.upgradeTracks).flatMap((id) => [keys.upgradeName(id), keys.upgradeDesc(id)]),
      ...Object.keys(catalog.unlocks).map(keys.unlockName),
      ...Object.keys(catalog.inboundChannels).map(keys.channelName),
      ...Object.keys(catalog.saleChannels).map(keys.channelName),
      ...island.map((def) => keys.islandName(def.id)),
      ...Object.values(catalog.buildings).map((def) => keys.categoryName(def.category)),
      ...Object.values(catalog.upgradeTracks).map((def) => keys.statName(def.stat)),
      ...Object.values(catalog.upgradeTracks).map((def) => `unit.${def.unit}`),
    ];
    const missing = wanted.filter((key) => !(key in en));
    expect(missing).toEqual([]);
  });

  it('has a message for every command failure', () => {
    const reasons = ['notEnoughMoney', 'locked', 'plotOccupied', 'islandFull', 'maxLevel', 'notFound', 'requirementsNotMet', 'alreadyUnlocked'];
    for (const reason of reasons) expect(keys.error(reason) in en, reason).toBe(true);
  });
});

describe('interpolate', () => {
  it('replaces named placeholders', () => {
    expect(interpolate('{a} and {b}', { a: 'x', b: 2 })).toBe('x and 2');
    expect(interpolate('{a}{a}', { a: 'x' })).toBe('xx');
  });

  it('leaves unknown placeholders alone', () => {
    expect(interpolate('{a} {b}', { a: 'x' })).toBe('x {b}');
    expect(interpolate('{a}')).toBe('{a}');
  });

  it('does not expand placeholders inside the inserted values', () => {
    expect(interpolate('{a} {b}', { a: '{b}', b: 'y' })).toBe('{b} y');
  });
});

describe('I18n', () => {
  it('starts in English', () => {
    const i18n = new I18n();
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('item.lumber.name')).toBe('Lumber');
  });

  it('switches language and substitutes params', () => {
    const i18n = new I18n();
    expect(i18n.t('build.count', { count: 3, max: 30 })).toBe('Buildings 3/30');
    i18n.setLanguage('ko');
    expect(i18n.t('item.lumber.name')).toBe('판재');
    expect(i18n.t('build.count', { count: 3, max: 30 })).toBe('건물 3/30');
  });

  it('notifies listeners on change only, until they unsubscribe', () => {
    const i18n = new I18n();
    const seen: string[] = [];
    const stop = i18n.onChange((language) => seen.push(language));
    i18n.setLanguage('en');
    i18n.setLanguage('ko');
    i18n.setLanguage('ko');
    i18n.setLanguage('en');
    stop();
    i18n.setLanguage('ko');
    expect(seen).toEqual(['ko', 'en']);
  });

  it('remembers the chosen language', () => {
    const storage = memoryStorage();
    new I18n({ storage }).setLanguage('ko');
    expect(storage.data[LANGUAGE_STORAGE_KEY]).toBe('ko');
    expect(new I18n({ storage }).language).toBe('ko');
  });

  it('ignores a remembered value that is not a language, and broken storage', () => {
    expect(new I18n({ storage: memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'xx' }) }).language).toBe('en');
    const broken: LanguageStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const i18n = new I18n({ storage: broken });
    i18n.setLanguage('ko');
    expect(i18n.language).toBe('ko');
  });

  it('translates run-time keys and falls back for unknown ones', () => {
    const i18n = new I18n();
    expect(i18n.tx(keys.buildingName('sawmill'))).toBe('Sawmill');
    expect(i18n.tx('item.unobtainium.name')).toBe('item.unobtainium.name');
    expect(i18n.tx('item.unobtainium.name', undefined, '?')).toBe('?');
    expect(i18n.tx('toString')).toBe('toString');
  });
});
