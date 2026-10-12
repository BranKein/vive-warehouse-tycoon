import type { BuildingDef, UpgradeTrackDef, UpgradeTrackId, UpgradeView } from '@/contracts';
import { BigNum, bn } from '@/core/BigNum';
import type { StatResolver } from './modifiers';

export function upgradeCost(track: UpgradeTrackDef, level: number, costScale: number): BigNum {
  return bn(track.baseCost * costScale).mul(bn(track.costGrowth).pow(level));
}

export function buildCost(def: BuildingDef, builtCount: number): BigNum {
  return bn(def.buildCost).mul(bn(def.buildCostGrowth).pow(builtCount));
}

export const isMaxed = (track: UpgradeTrackDef, level: number): boolean =>
  track.maxLevel !== null && level >= track.maxLevel;

/** Anything that owns upgrade tracks: a building, a channel or the game itself. */
export interface Upgradable {
  readonly tracks: readonly UpgradeTrackDef[];
  readonly levels: Map<UpgradeTrackId, number>;
  readonly stats: StatResolver;
  readonly upgradeCostScale: number;
}

export function nextUpgradeCost(target: Upgradable, track: UpgradeTrackDef): BigNum | null {
  const level = target.levels.get(track.id) ?? 0;
  return isMaxed(track, level) ? null : upgradeCost(track, level, target.upgradeCostScale);
}

export function upgradeViews(target: Upgradable, money: BigNum): UpgradeView[] {
  return target.tracks.map((track) => {
    const level = target.levels.get(track.id) ?? 0;
    const cost = nextUpgradeCost(target, track);
    return {
      trackId: track.id,
      stat: track.stat,
      unit: track.unit,
      level,
      maxLevel: track.maxLevel,
      cost,
      affordable: cost !== null && money.gte(cost),
      current: target.stats.upgraded(track.stat),
      next: cost === null ? null : target.stats.upgraded(track.stat, { trackId: track.id, level: level + 1 }),
    };
  });
}

export function serializeLevels(levels: Map<UpgradeTrackId, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, level] of levels) if (level > 0) out[id] = level;
  return out;
}

/** Restores levels for known tracks only and clamps them to the current maximum. */
export function restoreLevels(
  levels: Map<UpgradeTrackId, number>,
  tracks: readonly UpgradeTrackDef[],
  saved: unknown,
): void {
  if (!saved || typeof saved !== 'object') return;
  const record = saved as Record<string, unknown>;
  for (const track of tracks) {
    const level = record[track.id];
    if (typeof level !== 'number' || !(level > 0)) continue;
    levels.set(track.id, track.maxLevel === null ? Math.floor(level) : Math.min(Math.floor(level), track.maxLevel));
  }
}
