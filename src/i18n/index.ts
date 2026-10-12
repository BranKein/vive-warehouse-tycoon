/**
 * Translation engine. Every user-visible string goes through `t()`.
 * Static keys are checked at compile time; keys built from content IDs
 * (`item.<id>.name`, ...) go through `tx()` and fall back gracefully.
 */
import { en, type TranslationKey, type Translations } from './en';
import { ko } from './ko';

export type { TranslationKey, Translations } from './en';

export type Language = 'en' | 'ko';
export type TranslateParams = Record<string, string | number>;

export const LANGUAGES: readonly Language[] = ['en', 'ko'];
export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_STORAGE_KEY = 'warehouse-tycoon.language';

const TABLES: Record<Language, Translations> = { en, ko };

/** The subset of `Storage` used to remember the chosen language. */
export interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/** Replaces `{name}` placeholders; placeholders without a matching param are left as they are. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

export interface I18nOptions {
  /** Where the chosen language is remembered. Omit for no persistence. */
  storage?: LanguageStorage | null;
}

export class I18n {
  private current: Language = DEFAULT_LANGUAGE;
  private readonly listeners = new Set<(language: Language) => void>();
  private readonly storage: LanguageStorage | null;

  constructor(options: I18nOptions = {}) {
    this.storage = options.storage ?? null;
    try {
      const remembered = this.storage?.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(remembered)) this.current = remembered;
    } catch {
      // Storage can be blocked (private mode); the default language is used.
    }
  }

  get language(): Language {
    return this.current;
  }

  setLanguage(language: Language): void {
    if (language === this.current) return;
    this.current = language;
    try {
      this.storage?.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Not being able to remember the choice must not break switching.
    }
    for (const listener of [...this.listeners]) listener(language);
  }

  /** Registers a listener called after every language change. Returns the function that removes it. */
  onChange(listener: (language: Language) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** True when the current language (or English, the fallback) has this key. */
  has(key: string): key is TranslationKey {
    return Object.prototype.hasOwnProperty.call(en, key);
  }

  /** Translates a statically known key. */
  readonly t = (key: TranslationKey, params?: TranslateParams): string =>
    interpolate(TABLES[this.current][key] ?? en[key], params);

  /**
   * Translates a key built at run time (content IDs, keys sent by the
   * simulation). Unknown keys return `fallback`, or the key itself so the
   * gap is visible instead of silently empty.
   */
  readonly tx = (key: string, params?: TranslateParams, fallback?: string): string =>
    this.has(key) ? this.t(key, params) : (fallback ?? key);
}

function browserStorage(): LanguageStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The instance shared by the whole app. */
export const i18n = new I18n({ storage: browserStorage() });

export const t = i18n.t;
export const tx = i18n.tx;
export const getLanguage = (): Language => i18n.language;
export const setLanguage = (language: Language): void => i18n.setLanguage(language);
export const onLanguageChange = (listener: (language: Language) => void): (() => void) => i18n.onChange(listener);

/** Translation keys for content, built from the IDs in `src/contracts`. */
export const keys = {
  itemName: (id: string): string => `item.${id}.name`,
  buildingName: (id: string): string => `building.${id}.name`,
  buildingDesc: (id: string): string => `building.${id}.desc`,
  upgradeName: (id: string): string => `upgrade.${id}.name`,
  upgradeDesc: (id: string): string => `upgrade.${id}.desc`,
  unlockName: (id: string): string => `unlock.${id}.name`,
  channelName: (id: string): string => `channel.${id}.name`,
  islandName: (id: string): string => `island.${id}.name`,
  categoryName: (id: string): string => `category.${id}`,
  statName: (id: string): string => `stat.${id}`,
  modifierName: (source: string): string => `modifier.${source}`,
  error: (reason: string): string => `error.${reason}`,
} as const;
