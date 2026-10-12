import type { ContentCatalog, IslandId, IslandSummaryView, JsonValue } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import { TICKS_PER_SECOND } from '@/core/time';
import { Island, type IslandHost } from './Island';

/**
 * Owns every island. Only the active one is simulated; the others stay
 * frozen and pay out the income that was estimated when the player left.
 */
export class IslandManager {
  readonly islands = new Map<IslandId, Island>();
  private activeId: IslandId;
  private awayPerTick = BigNum.ZERO;

  constructor(
    catalog: ContentCatalog,
    private readonly host: IslandHost,
    saved?: unknown,
  ) {
    const data = (saved && typeof saved === 'object' ? saved : null) as Record<string, unknown> | null;
    const savedIslands = (data?.islands && typeof data.islands === 'object' ? data.islands : {}) as Record<string, unknown>;
    for (const def of Object.values(catalog.islands)) {
      const state = savedIslands[def.id];
      const island = new Island(def, host, { skipStart: state !== undefined });
      if (state !== undefined) island.restore(state);
      this.islands.set(def.id, island);
    }
    const wanted = typeof data?.active === 'string' ? data.active : catalog.startIsland;
    this.activeId = this.islands.has(wanted) ? wanted : catalog.startIsland;
    if (!this.islands.has(this.activeId)) throw new Error(`Unknown start island: ${this.activeId}`);
    this.updateAway();
  }

  get active(): Island {
    return this.islands.get(this.activeId)!;
  }

  get count(): number {
    return this.islands.size;
  }

  /** Advances the watched island by one tick and returns what the other islands earned meanwhile. */
  tick(): BigNum {
    this.active.tick();
    return this.awayPerTick;
  }

  /**
   * Leaves the current island: its state is frozen as it is and its income
   * is estimated on a copy. Returns false for an unknown island.
   */
  switchTo(id: IslandId): boolean {
    if (!this.islands.has(id)) return false;
    if (id === this.activeId) return true;
    const leaving = this.active;
    leaving.estimatedIncome = leaving.estimateIncome(this.host.balance.islands.estimateSec, TICKS_PER_SECOND);
    this.activeId = id;
    this.updateAway();
    return true;
  }

  private updateAway(): void {
    let total = BigNum.ZERO;
    for (const island of this.islands.values()) {
      if (island.id !== this.activeId) total = total.add(island.estimatedIncome);
    }
    this.awayPerTick = total.div(TICKS_PER_SECOND);
  }

  summaries(): IslandSummaryView[] {
    return [...this.islands.values()].map((island) => ({
      id: island.id,
      active: island.id === this.activeId,
      estimatedIncomePerSec: island.estimatedIncome,
    }));
  }

  buildingCount(): number {
    let count = 0;
    for (const island of this.islands.values()) count += island.buildings.length;
    return count;
  }

  toJSON(): JsonValue {
    return {
      active: this.activeId,
      islands: Object.fromEntries([...this.islands].map(([id, island]) => [id, island.toJSON()])),
    };
  }
}
