import type { ContentCatalog, IslandDef, SaleChannelDef } from '@/contracts';
import { catalog } from '@/content';
import { BALANCE, type Balance } from '@/content/balance';
import { createGame, type Game } from '@/sim';

export const START_ISLAND = catalog.startIsland;
export const SECOND_ISLAND = 'island.test';
export const EXPORT_CHANNEL = 'sale.export';

/** The shipped catalog with the start island adjusted. */
export function catalogWith(island: Partial<Omit<IslandDef, 'start'>> & { start?: Partial<IslandDef['start']> }): ContentCatalog {
  const base = catalog.islands[START_ISLAND]!;
  return {
    ...catalog,
    islands: { ...catalog.islands, [START_ISLAND]: { ...base, ...island, start: { ...base.start, ...island.start } } },
  };
}

/** Test-only second island: same board, a textile mill, a truck yard and an export berth at the dock. */
export function twoIslandCatalog(): ContentCatalog {
  const base = catalog.islands[START_ISLAND]!;
  const exportChannel: SaleChannelDef = {
    id: EXPORT_CHANNEL,
    kind: 'islandExport',
    facility: 'dock',
    vehicleModel: 'vehicle.cargoShip',
    baseIntervalSec: 20,
    baseLoad: 40,
    vehicleSpeed: 20,
    priceMultiplier: 1.2,
    weightSensitivity: 0.1,
    feeRate: 0.1,
    lossRate: 0.05,
    unlock: null,
    upgradeTracks: ['sale.interval', 'sale.load'],
  };
  const second: IslandDef = {
    id: SECOND_ISLAND,
    layout: base.layout,
    maxBuildings: 10,
    buildingTypes: ['textileMill', 'flourMill', 'glassworks'],
    inbound: 'inbound.truck',
    saleChannels: ['sale.truck', EXPORT_CHANNEL],
    start: { money: 0, buildings: [{ plot: 'p0-0', type: 'textileMill' }] },
  };
  return {
    ...catalog,
    saleChannels: { ...catalog.saleChannels, [EXPORT_CHANNEL]: exportChannel },
    islands: { ...catalog.islands, [SECOND_ISLAND]: second },
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** The shipped balance with some groups overridden (one level deep). */
export function balanceWith(overrides: DeepPartial<Balance>): Balance {
  const out = { ...BALANCE } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const current = out[key];
    out[key] = value && typeof value === 'object' && current && typeof current === 'object' ? { ...current, ...value } : value;
  }
  return out as unknown as Balance;
}

export function newGame(options: { catalog?: ContentCatalog; balance?: Balance; seed?: number; money?: number } = {}): Game {
  const game = createGame({
    catalog: options.catalog ?? catalog,
    seed: options.seed ?? 1,
    ...(options.balance ? { balance: options.balance } : {}),
  });
  if (options.money) game.grant(options.money);
  return game;
}

export const seconds = (count: number): number => Math.round(count * 20);

/** Ticks one at a time until `done` returns true; returns the tick count, or fails after `limit` ticks. */
export function tickUntil(game: Game, done: () => boolean, limit: number): number {
  for (let i = 1; i <= limit; i += 1) {
    game.tick();
    if (done()) return i;
  }
  throw new Error(`Condition not reached within ${limit} ticks`);
}

/** Save as it would come back from storage. */
export const stored = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
