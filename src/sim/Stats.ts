import type { BuildingId, ChannelId, IslandStatsView, ItemId } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import type { Building } from './Building';

/** The window is kept as slices, so old seconds drop out a slice at a time. */
const SLICE_SEC = 10;
const SLICES = 30;

interface Slice {
  seconds: number;
  /** Seconds each building existed and worked in this slice. */
  present: Map<BuildingId, number>;
  working: Map<BuildingId, number>;
  /** Building-seconds spent waiting for each item. */
  missing: Map<ItemId, number>;
  byItem: Map<ItemId, BigNum>;
  byChannel: Map<ChannelId, BigNum>;
}

const newSlice = (): Slice => ({
  seconds: 0,
  present: new Map(),
  working: new Map(),
  missing: new Map(),
  byItem: new Map(),
  byChannel: new Map(),
});

const bump = <K>(map: Map<K, number>, key: K): void => {
  map.set(key, (map.get(key) ?? 0) + 1);
};
const pour = <K>(map: Map<K, BigNum>, key: K, amount: BigNum): void => {
  map.set(key, (map.get(key) ?? BigNum.ZERO).add(amount));
};

const EMPTY: IslandStatsView = {
  windowSec: 0,
  uptime: {},
  averageUptime: null,
  shortages: [],
  salesByItem: [],
  salesByChannel: [],
};

/**
 * Figures over the last five minutes of an island: how much of the time each
 * building worked, what buildings waited for, and what was sold through
 * which channel. Not saved; it fills up again after a load.
 */
export class IslandStats {
  private slices: Slice[] = [newSlice()];
  private current: IslandStatsView = EMPTY;

  /** Call once per simulated second. */
  sample(buildings: readonly Building[]): void {
    let slice = this.slices[this.slices.length - 1]!;
    if (slice.seconds >= SLICE_SEC) {
      slice = newSlice();
      this.slices.push(slice);
      if (this.slices.length > SLICES) this.slices.shift();
    }
    slice.seconds += 1;
    for (const building of buildings) {
      bump(slice.present, building.id);
      if (building.status === 'working') bump(slice.working, building.id);
      else if (building.status === 'starved') for (const item of building.missing) bump(slice.missing, item);
    }
    this.current = this.build(buildings);
  }

  /** Money a sale channel just received for one kind of item. */
  sold(channelId: ChannelId, item: ItemId, amount: BigNum): void {
    const slice = this.slices[this.slices.length - 1]!;
    pour(slice.byItem, item, amount);
    pour(slice.byChannel, channelId, amount);
  }

  /** The figures as of the last sample. */
  get view(): IslandStatsView {
    return this.current;
  }

  private build(buildings: readonly Building[]): IslandStatsView {
    const present = new Map<BuildingId, number>();
    const working = new Map<BuildingId, number>();
    const missing = new Map<ItemId, number>();
    const byItem = new Map<ItemId, BigNum>();
    const byChannel = new Map<ChannelId, BigNum>();
    let windowSec = 0;
    for (const slice of this.slices) {
      windowSec += slice.seconds;
      for (const [id, seconds] of slice.present) present.set(id, (present.get(id) ?? 0) + seconds);
      for (const [id, seconds] of slice.working) working.set(id, (working.get(id) ?? 0) + seconds);
      for (const [item, seconds] of slice.missing) missing.set(item, (missing.get(item) ?? 0) + seconds);
      for (const [item, amount] of slice.byItem) pour(byItem, item, amount);
      for (const [channel, amount] of slice.byChannel) pour(byChannel, channel, amount);
    }

    // Demolished buildings drop out; the rest are measured over the time they have stood.
    const uptime: Record<BuildingId, number> = {};
    let total = 0;
    let count = 0;
    for (const building of buildings) {
      const seconds = present.get(building.id) ?? 0;
      if (seconds === 0) continue;
      const share = (working.get(building.id) ?? 0) / seconds;
      uptime[building.id] = share;
      total += share;
      count += 1;
    }
    const byAmount = <K>(map: Map<K, BigNum>): Array<[K, BigNum]> => [...map].sort((a, b) => b[1].cmp(a[1]));
    return {
      windowSec,
      uptime,
      averageUptime: count > 0 ? total / count : null,
      shortages: [...missing].sort((a, b) => b[1] - a[1]).map(([item, seconds]) => ({ item, seconds })),
      salesByItem: byAmount(byItem).map(([item, amount]) => ({ item, amount })),
      salesByChannel: byAmount(byChannel).map(([channelId, amount]) => ({ channelId, amount })),
    };
  }
}
