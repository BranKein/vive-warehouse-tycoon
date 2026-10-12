/**
 * Generic buffs and debuffs plus the stat pipeline every number goes through:
 * base value -> upgrade tracks -> modifiers.
 */
import type { StatId, UpgradeTrackDef, UpgradeTrackId } from '@/contracts';
import { BigNum, bn } from '@/core/BigNum';

export type ModifierOp = 'mul' | 'add';

export interface Modifier {
  /** What causes the effect, e.g. "wasteClogged". Also a translation key suffix. */
  source: string;
  /** Id of the building or channel the effect applies to. */
  target: string;
  stat: StatId;
  op: ModifierOp;
  value: number;
}

const NONE: readonly Modifier[] = [];

/** All active effects of one island, grouped by target. */
export class ModifierRegistry {
  private readonly byTarget = new Map<string, Modifier[]>();

  /** Adds the effect, replacing an earlier one from the same source on the same target and stat. */
  apply(modifier: Modifier): void {
    const list = this.byTarget.get(modifier.target) ?? [];
    const index = list.findIndex((m) => m.source === modifier.source && m.stat === modifier.stat);
    if (index >= 0) list[index] = modifier;
    else list.push(modifier);
    this.byTarget.set(modifier.target, list);
  }

  /** Returns true when something was removed. */
  remove(target: string, source: string): boolean {
    const list = this.byTarget.get(target);
    if (!list) return false;
    const kept = list.filter((m) => m.source !== source);
    if (kept.length === list.length) return false;
    if (kept.length === 0) this.byTarget.delete(target);
    else this.byTarget.set(target, kept);
    return true;
  }

  has(target: string, source: string): boolean {
    return (this.byTarget.get(target) ?? NONE).some((m) => m.source === source);
  }

  clearTarget(target: string): void {
    this.byTarget.delete(target);
  }

  of(target: string): readonly Modifier[] {
    return this.byTarget.get(target) ?? NONE;
  }
}

/** Value contributed by a track at a given level, applied to `base`. */
export function applyTrack(base: BigNum, track: UpgradeTrackDef, level: number): BigNum {
  if (level <= 0) return base;
  return track.effect.kind === 'multiply'
    ? base.mul(bn(track.effect.perLevel).pow(level))
    : base.add(track.effect.perLevel * level);
}

/** Resolves the stats of one target. Results are cached until `invalidate()` is called. */
export class StatResolver {
  private readonly cache = new Map<StatId, BigNum>();
  private readonly upgradedCache = new Map<StatId, BigNum>();

  constructor(
    private readonly target: string,
    private readonly bases: Readonly<Record<StatId, number>>,
    private readonly tracks: readonly UpgradeTrackDef[],
    private readonly levels: ReadonlyMap<UpgradeTrackId, number>,
    private readonly modifiers: ModifierRegistry | null,
  ) {}

  invalidate(): void {
    this.cache.clear();
    this.upgradedCache.clear();
  }

  /** Base value with upgrades, optionally pretending one track sits at another level. */
  upgraded(stat: StatId, override?: { trackId: UpgradeTrackId; level: number }): BigNum {
    if (!override) {
      const cached = this.upgradedCache.get(stat);
      if (cached) return cached;
    }
    let value = bn(this.bases[stat] ?? 0);
    // Additive tracks first so multipliers scale the whole amount.
    for (const kind of ['add', 'multiply'] as const) {
      for (const track of this.tracks) {
        if (track.stat !== stat || track.effect.kind !== kind) continue;
        const level = override && override.trackId === track.id ? override.level : (this.levels.get(track.id) ?? 0);
        value = applyTrack(value, track, level);
      }
    }
    if (!override) this.upgradedCache.set(stat, value);
    return value;
  }

  /** Final value: base -> upgrades -> modifiers. */
  value(stat: StatId): BigNum {
    const cached = this.cache.get(stat);
    if (cached) return cached;
    let value = this.upgraded(stat);
    if (this.modifiers) {
      const active = this.modifiers.of(this.target);
      for (const m of active) if (m.stat === stat && m.op === 'add') value = value.add(m.value);
      for (const m of active) if (m.stat === stat && m.op === 'mul') value = value.mul(m.value);
    }
    this.cache.set(stat, value);
    return value;
  }

  number(stat: StatId): number {
    return this.value(stat).toNumber();
  }
}
