import {
  Stat,
  type BuildingDef,
  type BuildingStatus,
  type BuildingView,
  type ContentCatalog,
  type ItemId,
  type JsonValue,
  type ModifierView,
  type RecipeDef,
  type UpgradeTrackDef,
  type UpgradeTrackId,
} from '@/contracts';
import { BigNum } from '@/core/BigNum';
import { TICKS_PER_SECOND } from '@/core/time';
import { Carrier, type CarrierContext } from './Carrier';
import { Inventory, parseAmount, type Slot } from './Inventory';
import { ratio, subClamp } from './math';
import { StatResolver, type ModifierRegistry } from './modifiers';
import type { CarrierHome, Consumer, PickupSource, Site } from './nodes';
import { createProductionLine, recipeProductValue, type ProductionLine } from './ProductionLine';
import { restoreLevels, serializeLevels, upgradeViews, type Upgradable } from './upgrades';

/** What a building needs from the island and the game around it. */
export interface BuildingContext extends CarrierContext {
  readonly modifiers: ModifierRegistry;
  trySpend(amount: BigNum): boolean;
}

interface Cycle {
  scale: BigNum;
  start: number;
  end: number;
}

const RETRY_TICKS = TICKS_PER_SECOND;

/**
 * A plot with a production line on it. All building types share this class;
 * they differ only in their recipe (and so in the line that runs it).
 */
export class Building implements CarrierHome, Consumer, PickupSource, Upgradable {
  readonly inputs = new Inventory();
  /** Products and byproducts waiting for a carrier. */
  readonly outputs = new Inventory();
  /** Waste piles up here until a disposal plant collects it. */
  readonly waste = new Inventory();
  readonly levels = new Map<UpgradeTrackId, number>();
  readonly tracks: UpgradeTrackDef[];
  readonly stats: StatResolver;
  readonly upgradeCostScale: number;
  readonly line: ProductionLine;
  readonly recipe: RecipeDef;
  readonly productValue: number;
  readonly carriers: Carrier[] = [];

  invested = BigNum.ZERO;
  cycle: Cycle | null = null;
  status: BuildingStatus = 'idle';
  missing: ItemId[] = [];
  /** Tick at which the building needs attention; 0 = as soon as possible. */
  wake = 0;
  wasteRatio = 0;
  private batch = BigNum.ONE;

  constructor(
    readonly id: string,
    readonly def: BuildingDef,
    readonly site: Site,
    private readonly ctx: BuildingContext,
  ) {
    const catalog: ContentCatalog = ctx.catalog;
    const recipe = catalog.recipes[def.recipe];
    if (!recipe) throw new Error(`Building ${def.id} refers to unknown recipe ${def.recipe}`);
    this.recipe = recipe;
    this.line = createProductionLine(recipe, catalog.items);
    this.productValue = recipeProductValue(recipe, catalog.items);
    this.tracks = def.upgradeTracks.flatMap((id) => catalog.upgradeTracks[id] ?? []);
    this.upgradeCostScale = def.upgradeCostScale;
    const { baseStats, carriers } = ctx.balance;
    this.stats = new StatResolver(
      id,
      {
        [Stat.batchSize]: baseStats.batchSize,
        [Stat.cycleSpeed]: baseStats.cycleSpeed,
        [Stat.carrierCount]: carriers.baseCount,
        [Stat.carrierLoad]: carriers.baseLoad,
        [Stat.wasteOutput]: 1,
      },
      this.tracks,
      this.levels,
      ctx.modifiers,
    );
    for (const io of recipe.inputs) this.inputs.slot(io.item);
    for (const io of recipe.outputs) {
      if (catalog.items[io.item]?.kind === 'waste') this.waste.slot(io.item);
      else this.outputs.slot(io.item);
    }
    this.refresh();
  }

  /** Recomputes everything derived from stats. Call after an upgrade or a modifier change. */
  refresh(): void {
    this.stats.invalidate();
    const { storage, waste } = this.ctx.balance;
    this.batch = this.stats.value(Stat.batchSize);
    // Capacities follow the upgraded speed only, so a temporary slowdown never shrinks a slot.
    const cyclesPerSec = this.stats.upgraded(Stat.cycleSpeed).toNumber() / this.recipe.durationSec;
    const inputCycles = Math.max(storage.minInputCycles, storage.inputBufferSec * cyclesPerSec);
    const outputCycles = Math.max(storage.minOutputCycles, storage.outputBufferSec * cyclesPerSec);
    const wasteCycles = Math.max(waste.minLimitCycles, waste.limitSec * cyclesPerSec);
    for (const io of this.recipe.inputs) this.inputs.slot(io.item).capacity = this.batch.mul(io.amount * inputCycles);
    for (const io of this.recipe.outputs) {
      const wasteSlot = this.waste.get(io.item);
      if (wasteSlot) wasteSlot.capacity = this.batch.mul(io.amount * wasteCycles);
      else this.outputs.slot(io.item).capacity = this.batch.mul(io.amount * outputCycles);
    }
    const wanted = Math.max(0, Math.round(this.stats.number(Stat.carrierCount)));
    while (this.carriers.length < wanted) {
      this.carriers.push(new Carrier(`${this.id}.c${this.carriers.length + 1}`, this, this.ctx.balance.carriers.model));
    }
    this.updateWaste();
    this.wake = 0;
  }

  // --- production -----------------------------------------------------------

  update(tick: number): void {
    if (this.cycle && tick >= this.cycle.end) {
      for (const out of this.line.produce(this.cycle.scale)) {
        const wasteSlot = this.waste.get(out.item);
        if (wasteSlot) wasteSlot.add(out.amount.mul(this.stats.value(Stat.wasteOutput)));
        else this.outputs.slot(out.item).add(out.amount);
      }
      this.cycle = null;
      this.updateWaste();
      this.ctx.markDirty();
    }
    if (this.cycle) {
      this.wake = this.cycle.end;
      return;
    }
    const plan = this.line.plan({ inputs: this.inputs, outputs: this.outputs, batch: this.batch });
    if (!plan.ok) {
      this.status = plan.status;
      this.missing = plan.missing;
      this.wake = Infinity;
      return;
    }
    if (!plan.fee.isZero && !this.ctx.trySpend(plan.fee)) {
      // Cannot pay the fee right now; look again shortly.
      this.status = 'idle';
      this.missing = [];
      this.wake = tick + RETRY_TICKS;
      return;
    }
    for (const use of plan.consume) use.slot.take(use.amount);
    const speed = Math.max(1e-6, this.stats.number(Stat.cycleSpeed));
    const ticks = Math.max(1, Math.round((this.recipe.durationSec * TICKS_PER_SECOND) / speed));
    this.cycle = { scale: plan.scale, start: tick, end: tick + ticks };
    this.status = 'working';
    this.missing = [];
    this.wake = this.cycle.end;
    // Inputs were used up, so there is new demand.
    this.ctx.markDirty();
  }

  private updateWaste(): void {
    let worst = 0;
    for (const slot of this.waste.list) {
      if (slot.capacity) worst = Math.max(worst, ratio(slot.amount, slot.capacity));
    }
    this.wasteRatio = worst;
    const { waste } = this.ctx.balance;
    const clogged = worst >= 1;
    if (clogged === this.ctx.modifiers.has(this.id, waste.source)) return;
    if (clogged) {
      this.ctx.modifiers.apply({
        source: waste.source,
        target: this.id,
        stat: Stat.cycleSpeed,
        op: 'mul',
        value: waste.slowdown,
      });
    } else {
      this.ctx.modifiers.remove(this.id, waste.source);
    }
    this.stats.invalidate();
  }

  // --- logistics ------------------------------------------------------------

  demand(item: ItemId): BigNum {
    return this.inputs.get(item)?.demand() ?? BigNum.ZERO;
  }

  reserveDelivery(item: ItemId, amount: BigNum): void {
    const slot = this.inputs.slot(item);
    slot.incoming = slot.incoming.add(amount);
  }

  readyExcept(item: ItemId): boolean {
    return this.line.readyExcept(item, this.inputs);
  }

  deliver(item: ItemId, delivered: BigNum, planned: BigNum): void {
    const slot = this.inputs.get(item);
    if (!slot) {
      this.returnCargo(item, delivered);
      return;
    }
    slot.incoming = subClamp(slot.incoming, planned);
    slot.add(delivered);
    this.wake = 0;
  }

  cancelDelivery(item: ItemId, planned: BigNum): void {
    const slot = this.inputs.get(item);
    if (slot) slot.incoming = subClamp(slot.incoming, planned);
  }

  /** Products and waste both wait here until some carrier comes for them. */
  private pickupSlot(item: ItemId): Slot | undefined {
    return this.waste.get(item) ?? this.outputs.get(item);
  }

  availableForPickup(item: ItemId): BigNum {
    return this.pickupSlot(item)?.available() ?? BigNum.ZERO;
  }

  reservePickup(item: ItemId, amount: BigNum): void {
    const slot = this.pickupSlot(item);
    if (slot) slot.reserved = slot.reserved.add(amount);
  }

  fullness(item: ItemId): number {
    const slot = this.pickupSlot(item);
    return slot?.capacity ? Math.min(1, ratio(slot.amount, slot.capacity)) : 0;
  }

  get pickupUrgency(): number {
    return this.wasteRatio;
  }

  pickup(item: ItemId, planned: BigNum): BigNum {
    const slot = this.pickupSlot(item);
    if (!slot) return BigNum.ZERO;
    slot.reserved = subClamp(slot.reserved, planned);
    const taken = slot.take(planned);
    this.updateWaste();
    this.wake = 0;
    return taken;
  }

  cancelPickup(item: ItemId, planned: BigNum): void {
    const slot = this.pickupSlot(item);
    if (slot) slot.reserved = subClamp(slot.reserved, planned);
  }

  carrierCapacity(): BigNum {
    return this.stats.value(Stat.carrierLoad);
  }

  pullSlots(): readonly Slot[] {
    return this.inputs.list;
  }

  returnCargo(item: ItemId, amount: BigNum): void {
    (this.inputs.get(item) ?? this.waste.get(item) ?? this.outputs.slot(item)).add(amount);
    this.updateWaste();
    this.wake = 0;
  }

  /** Everything other nodes' carriers may collect here: products, byproducts and waste. */
  pickupItems(): ItemId[] {
    return [...this.outputs.list, ...this.waste.list].map((slot) => slot.item);
  }

  inputItems(): ItemId[] {
    return this.inputs.list.map((slot) => slot.item);
  }

  // --- money ----------------------------------------------------------------

  get refund(): BigNum {
    return this.invested.div(2);
  }

  // --- read model and saving ------------------------------------------------

  view(tick: number, money: BigNum, handlingCount: number): BuildingView {
    const modifiers: ModifierView[] = this.ctx.modifiers
      .of(this.id)
      .map((m) => ({ source: m.source, stat: m.stat, multiplier: m.op === 'mul' ? m.value : 1 }));
    const cycle = this.cycle;
    return {
      id: this.id,
      typeId: this.def.id,
      plotId: this.site.id,
      status: this.status,
      missingInputs: this.status === 'starved' ? [...this.missing] : [],
      progress: cycle ? Math.min(1, Math.max(0, (tick - cycle.start) / Math.max(1, cycle.end - cycle.start))) : 0,
      inputs: this.inputs.views(),
      outputs: this.outputs.views(),
      waste: this.waste.views(),
      wasteRatio: this.wasteRatio,
      modifiers,
      upgrades: upgradeViews(this, money),
      handlingCount,
      invested: this.invested,
      refund: this.refund,
    };
  }

  toJSON(): JsonValue {
    return {
      id: this.id,
      type: this.def.id,
      plot: this.site.id,
      levels: serializeLevels(this.levels),
      invested: this.invested.toString(),
      inputs: this.inputs.toJSON(),
      outputs: this.outputs.toJSON(),
      waste: this.waste.toJSON(),
      cycle: this.cycle ? [this.cycle.scale.toString(), this.cycle.start, this.cycle.end] : null,
      status: this.status,
      missing: [...this.missing],
      wake: this.wake === Infinity ? null : this.wake,
      carriers: this.carriers.map((carrier) => carrier.toJSON()),
    };
  }

  restore(saved: Record<string, unknown>): void {
    const known = (item: ItemId): boolean => item in this.ctx.catalog.items;
    restoreLevels(this.levels, this.tracks, saved.levels);
    this.invested = parseAmount(saved.invested);
    this.refresh();
    this.inputs.restore(saved.inputs, known, true);
    this.outputs.restore(saved.outputs, known, true);
    this.waste.restore(saved.waste, known, true);
    const cycle = saved.cycle;
    if (Array.isArray(cycle) && typeof cycle[1] === 'number' && typeof cycle[2] === 'number') {
      this.cycle = { scale: parseAmount(cycle[0]), start: cycle[1], end: cycle[2] };
    }
    const status = saved.status;
    if (status === 'working' || status === 'starved' || status === 'outputFull' || status === 'idle') this.status = status;
    this.missing = Array.isArray(saved.missing) ? saved.missing.filter((m): m is string => typeof m === 'string' && known(m)) : [];
    this.updateWaste();
    this.wake = typeof saved.wake === 'number' ? saved.wake : saved.wake === null ? Infinity : 0;
    const carriers = Array.isArray(saved.carriers) ? saved.carriers : [];
    this.carriers.forEach((carrier, index) => carrier.restore(carriers[index], this.ctx));
  }
}
