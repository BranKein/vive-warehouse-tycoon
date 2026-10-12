/**
 * Pure functions that turn read-model values into display strings.
 * No DOM here, so everything in this file is unit tested.
 */
import type {
  AutoPilotView,
  BuildingStatus,
  ContentCatalog,
  ItemId,
  RecipeIO,
  SaveSummary,
  UnlockDef,
  UpgradeUnit,
  UpgradeView,
} from '@/contracts';
import { BigNum, type BigNumLike } from '@/core/BigNum';
import { formatDuration, formatNumber } from '@/core/format';
import { keys, type TranslateParams, type TranslationKey } from '@/i18n';

/** The two translate functions of `I18n`; passed in so the functions below stay pure. */
export interface Translator {
  t(key: TranslationKey, params?: TranslateParams): string;
  tx(key: string, params?: TranslateParams, fallback?: string): string;
}

export const itemName = (tr: Translator, id: string): string => tr.tx(keys.itemName(id));
export const buildingName = (tr: Translator, id: string): string => tr.tx(keys.buildingName(id));
export const upgradeName = (tr: Translator, id: string): string => tr.tx(keys.upgradeName(id));
export const unlockName = (tr: Translator, id: string): string => tr.tx(keys.unlockName(id));
export const channelName = (tr: Translator, id: string): string => tr.tx(keys.channelName(id));

/** Money and quantities are always shown in AA notation; never converted to a JS number. */
export const formatAmount = (value: BigNumLike): string => formatNumber(value);

export const formatIncome = (tr: Translator, perSec: BigNumLike): string =>
  tr.t('top.income', { amount: formatNumber(perSec) });

export function formatList(tr: Translator, parts: readonly string[]): string {
  return parts.join(tr.t('list.separator'));
}

export function formatUpgradeValue(tr: Translator, unit: UpgradeUnit, value: BigNumLike): string {
  return tr.t(`unit.${unit}`, { value: formatNumber(value) });
}

/** "×1.50 → ×2.25", or just the current value once the track is maxed out. */
export function formatUpgradeEffect(tr: Translator, view: Pick<UpgradeView, 'unit' | 'current' | 'next'>): string {
  const current = formatUpgradeValue(tr, view.unit, view.current);
  if (view.next === null) return current;
  return tr.t('upgrade.effect', { current, next: formatUpgradeValue(tr, view.unit, view.next) });
}

export function formatUpgradeLevel(tr: Translator, view: Pick<UpgradeView, 'level' | 'maxLevel'>): string {
  return view.maxLevel === null
    ? tr.t('upgrade.level', { level: view.level })
    : tr.t('upgrade.levelOfMax', { level: view.level, max: view.maxLevel });
}

export const isMaxed = (view: Pick<UpgradeView, 'cost'>): boolean => view.cost === null;

/** One side of a recipe: "Lumber ×2, Fabric ×1", or "Nothing" for an empty side. */
export function formatRecipeSide(tr: Translator, ios: readonly RecipeIO[]): string {
  if (ios.length === 0) return tr.t('recipe.nothing');
  return formatList(
    tr,
    ios.map((io) => tr.t('recipe.io', { name: itemName(tr, io.item), amount: formatNumber(io.amount) })),
  );
}

export function formatBuildingStatus(
  tr: Translator,
  view: { status: BuildingStatus; missingInputs: readonly ItemId[] },
): string {
  switch (view.status) {
    case 'working':
      return tr.t('status.working');
    case 'outputFull':
      return tr.t('status.outputFull');
    case 'idle':
      return tr.t('status.idle');
    case 'starved':
      return view.missingInputs.length === 0
        ? tr.t('status.starvedUnknown')
        : tr.t('status.starved', { items: formatList(tr, view.missingInputs.map((id) => itemName(tr, id))) });
  }
}

export type WasteLevel = 'none' | 'building' | 'clogged';

/** `ratio` is 0..1+, where 1 is the point at which the waste penalty starts. */
export function wasteLevel(ratio: number): WasteLevel {
  if (!(ratio > 0)) return 'none';
  return ratio >= 1 ? 'clogged' : 'building';
}

export const formatPercent = (ratio: number): string =>
  String(Math.round(Math.max(0, Number.isFinite(ratio) ? ratio : 0) * 100));

export function formatWaste(tr: Translator, ratio: number): string {
  const percent = formatPercent(ratio);
  return wasteLevel(ratio) === 'clogged' ? tr.t('waste.clogged', { percent }) : tr.t('waste.level', { percent });
}

export function formatModifier(tr: Translator, modifier: { source: string; stat: string; multiplier: number }): string {
  return tr.t('modifier.effect', {
    name: tr.tx(keys.modifierName(modifier.source), undefined, modifier.source),
    stat: tr.tx(keys.statName(modifier.stat), undefined, modifier.stat),
    value: formatNumber(modifier.multiplier),
  });
}

export function formatStock(tr: Translator, amount: BigNumLike, capacity: BigNumLike | null): string {
  return capacity === null
    ? tr.t('stock.amount', { amount: formatNumber(amount) })
    : tr.t('stock.amountOfCapacity', { amount: formatNumber(amount), capacity: formatNumber(capacity) });
}

/** Fill level 0..1 for a bar. Only used for widths, never for text. */
export function fillRatio(amount: BigNumLike, capacity: BigNumLike | null): number {
  if (capacity === null) return 0;
  const cap = BigNum.from(capacity);
  if (cap.isZero || cap.sign < 0) return 0;
  const ratio = BigNum.from(amount).div(cap).toNumber();
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
}

export function formatSaveSummary(tr: Translator, summary: SaveSummary): string {
  let money: string;
  try {
    money = formatNumber(summary.money);
  } catch {
    money = summary.money;
  }
  return tr.t('save.summary', {
    money,
    buildings: summary.buildings,
    time: formatDuration(summary.playSeconds),
  });
}

/**
 * Param names the simulation may use in an auto mode target; each is an ID
 * that is replaced by the translated name before the target text is built.
 */
const TARGET_PARAM_KEYS: Record<string, (id: string) => string> = {
  building: keys.buildingName,
  item: keys.itemName,
  track: keys.upgradeName,
  unlock: keys.unlockName,
  channel: keys.channelName,
};

export function formatAutoTarget(tr: Translator, target: NonNullable<AutoPilotView['target']>): string {
  const params: TranslateParams = {};
  for (const [name, value] of Object.entries(target.params ?? {})) {
    const toKey = TARGET_PARAM_KEYS[name];
    params[name] = toKey ? tr.tx(toKey(value), undefined, value) : value;
  }
  return tr.tx(target.key, params, tr.t('auto.target.unknown'));
}

/** What auto mode is doing, for the line next to its toggle. Empty while auto mode is off. */
export function formatAutoStatus(tr: Translator, auto: AutoPilotView): string {
  if (!auto.enabled) return '';
  if (!auto.target) return tr.t('auto.choosing');
  const target = formatAutoTarget(tr, auto.target);
  return auto.targetCost === null
    ? tr.t('auto.saving', { target })
    : tr.t('auto.savingCost', { target, cost: formatNumber(auto.targetCost) });
}

export function formatUnlockGrant(tr: Translator, unlock: UnlockDef): string {
  return unlock.grants.type === 'building'
    ? tr.t('unlocks.grants.building', { name: buildingName(tr, unlock.grants.buildingType) })
    : tr.t('unlocks.grants.saleChannel', { name: channelName(tr, unlock.grants.channel) });
}

/** Names of the prerequisites that are still locked. */
export function missingRequirements(
  catalog: ContentCatalog,
  unlockId: string,
  isUnlocked: (id: string) => boolean,
): string[] {
  return (catalog.unlocks[unlockId]?.requires ?? []).filter((id) => !isUnlocked(id));
}
