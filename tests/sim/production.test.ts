import { describe, expect, it } from 'vitest';
import type { RecipeDef } from '@/contracts';
import { bn } from '@/core/BigNum';
import { catalog } from '@/content';
import { Inventory } from '@/sim/Inventory';
import { createProductionLine, type LineState } from '@/sim/ProductionLine';
import { balanceWith, catalogWith, newGame, seconds, tickUntil } from './helpers';

function lineState(recipe: RecipeDef, batch = 1): LineState {
  const inputs = new Inventory();
  const outputs = new Inventory();
  for (const io of recipe.inputs) inputs.slot(io.item);
  for (const io of recipe.outputs) outputs.slot(io.item);
  return { inputs, outputs, batch: bn(batch) };
}

describe('production lines', () => {
  it('needs every input of a multi-input recipe and uses them in proportion', () => {
    const recipe = catalog.recipes.applianceFactory!;
    const line = createProductionLine(recipe, catalog.items);
    const state = lineState(recipe, 3);
    state.inputs.slot('electronicPart').add(bn(6));
    state.inputs.slot('steel').add(bn(6));
    const short = line.plan(state);
    expect(short).toMatchObject({ ok: false, status: 'starved', missing: ['glass'] });

    state.inputs.slot('glass').add(bn(3));
    const plan = line.plan(state);
    if (!plan.ok) throw new Error('expected a runnable cycle');
    expect(plan.scale.toNumber()).toBeCloseTo(3);
    const used = Object.fromEntries(plan.consume.map((use) => [use.slot.item, use.amount.toNumber()]));
    expect(used).toEqual({ electronicPart: 6, steel: 6, glass: 3 });
    // Planning changes nothing.
    expect(state.inputs.amount('glass').toNumber()).toBe(3);

    const made = Object.fromEntries(line.produce(plan.scale).map((out) => [out.item, out.amount.toNumber()]));
    expect(made.appliance).toBeCloseTo(3);
    expect(made.eWaste).toBeCloseTo(1.5);
  });

  it('runs a smaller cycle when an input is short of a full batch', () => {
    const recipe = catalog.recipes.furnitureFactory!;
    const line = createProductionLine(recipe, catalog.items);
    const state = lineState(recipe, 10);
    state.inputs.slot('lumber').add(bn(20));
    state.inputs.slot('fabric').add(bn(4));
    const plan = line.plan(state);
    if (!plan.ok) throw new Error('expected a runnable cycle');
    expect(plan.scale.toNumber()).toBeCloseTo(4);
  });

  it('stops when a capped output slot is full', () => {
    const recipe = catalog.recipes.textileMill!;
    const line = createProductionLine(recipe, catalog.items);
    const state = lineState(recipe);
    state.inputs.slot('cotton').add(bn(10));
    const out = state.outputs.slot('fabric');
    out.capacity = bn(5);
    out.add(bn(5));
    expect(line.plan(state)).toMatchObject({ ok: false, status: 'outputFull' });
  });

  it('takes whichever waste is on hand in an any-input recipe and charges a fee', () => {
    const recipe = catalog.recipes.wasteDisposal!;
    const line = createProductionLine(recipe, catalog.items);
    const state = lineState(recipe, 4);
    expect(line.plan(state)).toMatchObject({ ok: false, status: 'idle' });
    state.inputs.slot('slag').add(bn(10));
    state.inputs.slot('eWaste').add(bn(1));
    const plan = line.plan(state);
    if (!plan.ok) throw new Error('expected a runnable cycle');
    expect(plan.scale.toNumber()).toBeCloseTo(5);
    expect(plan.fee.toNumber()).toBeCloseTo(5 * recipe.moneyCostPerCycle!);
    expect(line.produce(plan.scale)).toEqual([]);
  });
});

describe('a building in the game', () => {
  it('turns delivered raw material into the recipe outputs', () => {
    const game = newGame();
    const sawmill = game.island.buildings[0]!;
    expect(sawmill.def.id).toBe('sawmill');
    expect(sawmill.status).not.toBe('working');

    tickUntil(game, () => sawmill.cycle !== null, seconds(60));
    expect(sawmill.status).toBe('working');
    const scale = sawmill.cycle!.scale.toNumber();
    const recipe = sawmill.recipe;
    const duration = sawmill.cycle!.end - sawmill.cycle!.start;
    expect(duration).toBe(seconds(recipe.durationSec));
    expect(scale).toBeGreaterThan(0);

    // Outputs sit in the building or, once picked up, on its own carrier.
    const made = (item: string): number =>
      sawmill.outputs.amount(item).toNumber() +
      sawmill.carriers.reduce((sum, carrier) => sum + carrier.cargo.amount(item).toNumber(), 0);
    // Nothing comes out before the cycle ends.
    game.tick(duration - 1);
    expect(made('lumber')).toBe(0);
    expect(made('sawdust')).toBe(0);
    game.tick(1);
    expect(made('lumber')).toBeCloseTo(scale * 1);
    expect(made('sawdust')).toBeCloseTo(scale * 0.5);
  });

  it('slows down when waste piles up and recovers once a disposal plant collects it', () => {
    const game = newGame({
      catalog: catalogWith({ start: { buildings: [{ plot: 'p2-0', type: 'steelMill' }] } }),
      balance: balanceWith({ waste: { limitSec: 8, minLimitCycles: 2 } }),
    });
    const mill = game.island.buildings[0]!;
    const normal = seconds(mill.recipe.durationSec);
    tickUntil(game, () => mill.cycle !== null, seconds(60));
    expect(mill.cycle!.end - mill.cycle!.start).toBe(normal);
    expect(game.snapshot().island.buildings[0]!.modifiers).toEqual([]);

    tickUntil(game, () => mill.wasteRatio >= 1, seconds(120));
    const view = game.snapshot().island.buildings[0]!;
    expect(view.wasteRatio).toBeGreaterThanOrEqual(1);
    expect(view.modifiers).toEqual([{ source: 'wasteClogged', stat: 'cycleSpeed', multiplier: game.balance.waste.slowdown }]);
    // Slots do not shrink while clogged, only the cycle gets longer.
    const cloggedStart = tickUntil(game, () => mill.cycle !== null && mill.cycle.start === game.island.tickCount, seconds(60));
    expect(cloggedStart).toBeGreaterThan(0);
    expect(mill.cycle!.end - mill.cycle!.start).toBe(Math.round(normal / game.balance.waste.slowdown));

    // Waste has nowhere to go without a disposal plant.
    const piled = mill.waste.amount('slag').toNumber();
    expect(piled).toBeGreaterThan(0);
    expect(game.island.sales.every((channel) => channel.stock.amount('slag').isZero)).toBe(true);

    game.grant(10_000);
    expect(game.unlock('unlock.building.wasteDisposal')).toEqual({ ok: true });
    expect(game.build('p2-1', 'wasteDisposal')).toEqual({ ok: true });
    const before = game.money;
    tickUntil(game, () => mill.wasteRatio < 1 && game.snapshot().island.buildings[0]!.modifiers.length === 0, seconds(120));
    // The disposal plant charged its fee.
    tickUntil(game, () => game.island.buildings[1]!.status === 'working', seconds(120));
    expect(game.money.lt(before.add(game.totalEarned))).toBe(true);
  });
});
