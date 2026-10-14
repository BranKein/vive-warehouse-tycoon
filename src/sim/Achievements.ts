import type { AchievementDef, AchievementId, AchievementMetric, AchievementsView, GameEvent, JsonValue } from '@/contracts';
import { bn, type BigNum } from '@/core/BigNum';

/** Reads the measures that come from the state rather than from counting events. */
export interface AchievementHost {
  measure(metric: AchievementMetric): BigNum;
  /** Simulated seconds played. */
  playSeconds(): number;
  emit(event: GameEvent): void;
}

/**
 * Keeps the achievements reached and the tallies that cannot be read from the
 * state (sales, special cargo). `check()` is called once a simulated second.
 */
export class Achievements {
  /** Achievement id -> simulated seconds played when it was reached. */
  private readonly reached = new Map<AchievementId, number>();
  private sales = 0;
  private readonly salesByChannel = new Map<string, number>();
  private specialCargo = 0;

  constructor(
    private readonly defs: readonly AchievementDef[],
    private readonly host: AchievementHost,
  ) {}

  get count(): number {
    return this.reached.size;
  }

  observe(event: GameEvent): void {
    if (event.type === 'sale') {
      this.sales += 1;
      this.salesByChannel.set(event.channelId, (this.salesByChannel.get(event.channelId) ?? 0) + 1);
    } else if (event.type === 'specialCargoCollected') {
      this.specialCargo += 1;
    }
  }

  value(metric: AchievementMetric): BigNum {
    if (metric.kind === 'sales') return bn(metric.channel ? (this.salesByChannel.get(metric.channel) ?? 0) : this.sales);
    if (metric.kind === 'specialCargo') return bn(this.specialCargo);
    return this.host.measure(metric);
  }

  /** Marks what has been reached. `quiet` leaves out the events, for judging an old save once on load. */
  check(quiet = false): void {
    for (const def of this.defs) {
      if (this.reached.has(def.id) || this.value(def.metric).lt(def.goal)) continue;
      this.reached.set(def.id, this.host.playSeconds());
      if (!quiet) this.host.emit({ type: 'achievementUnlocked', achievementId: def.id });
    }
  }

  view(saleBonusEach: number): AchievementsView {
    return {
      list: this.defs.map((def) => ({
        id: def.id,
        achievedAtSec: this.reached.get(def.id) ?? null,
        value: this.value(def.metric),
        goal: bn(def.goal),
      })),
      achieved: this.reached.size,
      saleBonus: this.reached.size * saleBonusEach,
    };
  }

  toJSON(): JsonValue {
    return {
      reached: Object.fromEntries(this.reached),
      sales: this.sales,
      salesByChannel: Object.fromEntries(this.salesByChannel),
      specialCargo: this.specialCargo,
    };
  }

  restore(saved: unknown): void {
    const data = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
    const count = (value: unknown): number => Math.max(0, Math.floor(Number(value) || 0));
    const known = new Set(this.defs.map((def) => def.id));
    const reached = (data.reached && typeof data.reached === 'object' ? data.reached : {}) as Record<string, unknown>;
    for (const [id, at] of Object.entries(reached)) {
      if (known.has(id) && typeof at === 'number') this.reached.set(id, at);
    }
    this.sales = count(data.sales);
    const byChannel = (data.salesByChannel && typeof data.salesByChannel === 'object' ? data.salesByChannel : {}) as Record<
      string,
      unknown
    >;
    for (const [id, value] of Object.entries(byChannel)) this.salesByChannel.set(id, count(value));
    this.specialCargo = count(data.specialCargo);
  }
}
