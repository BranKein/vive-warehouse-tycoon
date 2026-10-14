import { describe, expect, it } from 'vitest';
import type { ContentCatalog } from '@/contracts';
import { catalog } from '@/content';
import { BALANCE } from '@/content/balance';
import { createGame } from '@/sim';
import type { SaleChannel } from '@/sim/channels';
import { newGame, seconds, stored, tickUntil } from './helpers';

/** The shipped catalog with the raw material trucks bringing nothing, so only ships and planes import. */
function noTrucks(): ContentCatalog {
  const truck = catalog.inboundChannels['inbound.truck']!;
  return { ...catalog, inboundChannels: { ...catalog.inboundChannels, [truck.id]: { ...truck, baseLoad: 0 } } };
}

const shipOf = (game: ReturnType<typeof newGame>): SaleChannel => game.island.channel('sale.ship') as SaleChannel;

describe('raw material imports by ship and plane', () => {
  it('never imports through a channel that is still locked', () => {
    const game = newGame({ catalog: noTrucks() });
    for (let i = 0; i < seconds(120); i += 1) game.tick();
    const ship = shipOf(game);
    expect(ship.vehicle).toBeNull();
    expect(ship.depot!.stock.hasAny).toBe(false);
    expect(game.island.buildings[0]!.inputs.amount('wood').isZero).toBe(true);
  });

  it('brings what the buildings want on the way in, leaves it at the dock, and the carriers fetch it from there', () => {
    const game = newGame({ catalog: noTrucks(), money: 1e9 });
    expect(game.unlock('unlock.channel.ship')).toEqual({ ok: true });
    const ship = shipOf(game);
    const depot = ship.depot!;
    const sawmill = game.island.buildings[0]!;

    tickUntil(game, () => ship.vehicle !== null, seconds(5));
    const vehicle = ship.vehicle!;
    expect(vehicle.phase).toBe('in');
    const brought = vehicle.cargo.amount('wood');
    expect(brought.toNumber()).toBeGreaterThan(0);
    // Only raw materials ride in, and the dock already counts them as on their way.
    for (const item of vehicle.cargo.items.keys()) expect(catalog.items[item]!.kind).toBe('raw');
    expect(depot.onHand('wood').eq(brought)).toBe(true);
    expect(depot.availableForPickup('wood').isZero).toBe(true);

    tickUntil(game, () => depot.availableForPickup('wood').toNumber() > 0 || sawmill.inputs.amount('wood').toNumber() > 0, seconds(120));
    expect(vehicle.cargo.amount('wood').isZero).toBe(true);
    tickUntil(game, () => sawmill.inputs.amount('wood').toNumber() > 0, seconds(120));
  });

  it('shares the demand with the yard instead of bringing it twice', () => {
    const game = newGame({ money: 1e9 });
    const island = game.island;
    const sawmill = island.buildings[0]!;
    // Never more wood on the island than the sawmill holds when full plus the reserve, however many places import it.
    const limit = sawmill.inputTarget('wood').mul(1 + BALANCE.imports.reserveBuffers).toNumber() + 1e-6;
    const held = (): number => {
      const slot = sawmill.inputs.get('wood');
      return island.rawOnHand('wood').toNumber() + (slot ? slot.amount.add(slot.incoming).toNumber() : 0);
    };
    tickUntil(game, () => island.rawOnHand('wood').toNumber() > 0, seconds(30));
    expect(game.unlock('unlock.channel.ship')).toEqual({ ok: true });
    for (let i = 0; i < seconds(120); i += 1) {
      game.tick();
      expect(held()).toBeLessThanOrEqual(limit);
    }
  });

  it('keeps the dock stock and an incoming ship across a save', () => {
    const game = newGame({ catalog: noTrucks(), money: 1e9 });
    expect(game.unlock('unlock.channel.ship')).toEqual({ ok: true });
    const ship = shipOf(game);
    tickUntil(game, () => ship.depot!.availableForPickup('wood').toNumber() > 0, seconds(120));
    tickUntil(game, () => ship.vehicle?.phase === 'in' && !ship.vehicle.cargo.isEmpty, seconds(300));

    const copy = createGame({ catalog: noTrucks(), seed: 1, save: stored(game.serialize()) });
    const restored = shipOf(copy);
    expect(restored.depot!.onHand('wood').eq(ship.depot!.onHand('wood'))).toBe(true);
    expect(restored.vehicle!.cargo.amount('wood').eq(ship.vehicle!.cargo.amount('wood'))).toBe(true);
    for (let i = 0; i < seconds(60); i += 1) {
      game.tick();
      copy.tick();
    }
    expect(restored.depot!.onHand('wood').eq(ship.depot!.onHand('wood'))).toBe(true);
  });

  it('shows the imported raw materials in the facility stock', () => {
    const game = newGame({ catalog: noTrucks(), money: 1e9 });
    expect(game.unlock('unlock.channel.ship')).toEqual({ ok: true });
    const ship = shipOf(game);
    tickUntil(game, () => ship.depot!.availableForPickup('wood').toNumber() > 0, seconds(120));
    const dock = game.snapshot().island.facilities.find((facility) => facility.channelId === 'sale.ship')!;
    expect(dock.stock.some((entry) => entry.item === 'wood' && entry.amount.toNumber() > 0)).toBe(true);
    expect(dock.upgrades.some((upgrade) => upgrade.trackId === 'sale.importLoad')).toBe(true);
  });
});

describe('saves from before the truck load cap', () => {
  it('keeps the truck load at the new maximum and pays back the levels above it', () => {
    const game = newGame();
    const save = stored(game.serialize());
    const state = save.state as { islands: { islands: Record<string, { inbound: { levels: Record<string, number> } }> } };
    const island = Object.values(state.islands.islands)[0]!;
    island.inbound.levels['inbound.load'] = 10;
    const loaded = createGame({ catalog, seed: 1, save });
    expect(loaded.island.inbound.levels.get('inbound.load')).toBe(8);
    const track = catalog.upgradeTracks['inbound.load']!;
    const paidBack = track.baseCost * (track.costGrowth ** 8 + track.costGrowth ** 9);
    expect(loaded.money.toNumber()).toBeCloseTo(game.money.toNumber() + paidBack);
    expect(loaded.totalEarned.eq(game.totalEarned)).toBe(true);
  });
});
