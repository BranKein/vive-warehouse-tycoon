/**
 * The two ends of the chain: the inbound channel brings raw materials onto
 * the island and sale channels take goods away and turn them into money.
 * A new kind of sale channel is a class extending `SaleChannel` plus one
 * `registerSaleChannel` call.
 */
import {
  Stat,
  type FacilityView,
  type InboundChannelDef,
  type IslandLayoutDef,
  type ItemId,
  type JsonValue,
  type SaleChannelDef,
  type UnlockId,
  type UpgradeTrackDef,
  type UpgradeTrackId,
  type VehicleKind,
  type VehicleView,
} from '@/contracts';
import { BigNum } from '@/core/BigNum';
import { secondsToTicks, TICKS_PER_SECOND } from '@/core/time';
import { Carrier, type CarrierContext } from './Carrier';
import type { SaleHome } from './Dispatcher';
import { Inventory, type Slot } from './Inventory';
import { isPositive, ratio, subClamp } from './math';
import { StatResolver, type ModifierRegistry } from './modifiers';
import type { Consumer, PickupSource, Site } from './nodes';
import { makePath, reversePath, type Path } from './RoadGraph';
import { restoreLevels, serializeLevels, upgradeViews, type Upgradable } from './upgrades';
import { Vehicle, weightFactor } from './Vehicle';

/** What channels need from the island and the game around them. */
export interface ChannelContext extends CarrierContext {
  readonly layout: IslandLayoutDef;
  readonly modifiers: ModifierRegistry;
  /** Raw materials that can be brought in. */
  readonly rawItems: readonly ItemId[];
  /** Road path from the island gate to the dock of a site. */
  gatePath(site: Site): Path;
  consumersOf(item: ItemId): readonly Consumer[];
  /** Raw material already on the island or on its way, at every place that imports it. */
  rawOnHand(item: ItemId): BigNum;
  isUnlocked(unlock: UnlockId | null): boolean;
  /** Game-wide price multiplier. */
  priceMultiplier(): BigNum;
  /** Money paid back, not earned: for upgrade levels a newer version no longer allows. */
  refund(amount: BigNum): void;
  /** Money arrives; called when a sale vehicle leaves the island. */
  earn(amount: BigNum, channelId: string, x: number, z: number): void;
  /** Part of an `earn` that came from one kind of item; for the statistics. */
  sold(channelId: string, item: ItemId, amount: BigNum): void;
}

const RETRY_TICKS = TICKS_PER_SECOND;
const NO_SLOTS: readonly Slot[] = [];

type VisitPhase = 'in' | 'handle' | 'out';

/** A truck, ship or plane visiting a facility: comes in, is handled, leaves. */
class Visitor extends Vehicle {
  phase: VisitPhase = 'in';
  wake = 0;

  toJSON(): JsonValue {
    return {
      id: this.id,
      phase: this.phase,
      wake: this.wake,
      legStart: this.legStart,
      legEnd: this.legEnd,
      capacity: this.capacity.toString(),
      cargo: this.cargo.toJSON(),
    };
  }
}

function restoreVisitor(
  saved: unknown,
  kind: VehicleKind,
  model: string,
  inPath: Path,
  outPath: Path,
  known: (item: ItemId) => boolean,
): Visitor | null {
  if (!saved || typeof saved !== 'object') return null;
  const data = saved as Record<string, unknown>;
  const phase = data.phase;
  if (typeof data.id !== 'string' || (phase !== 'in' && phase !== 'handle' && phase !== 'out')) return null;
  const visitor = new Visitor(data.id, kind, model);
  visitor.phase = phase;
  visitor.wake = Number(data.wake) || 0;
  visitor.legStart = Number(data.legStart) || 0;
  visitor.legEnd = Number(data.legEnd) || 0;
  visitor.cargo.restore(data.cargo, known);
  if (typeof data.capacity === 'string') visitor.capacity = BigNum.from(data.capacity);
  visitor.path = phase === 'out' ? outPath : inPath;
  visitor.state = phase === 'handle' ? 'loading' : 'moving';
  return visitor;
}

/** Shared by both channel directions: upgrade tracks, stats, a stock and a site. */
abstract class ChannelBase implements Upgradable {
  readonly levels = new Map<UpgradeTrackId, number>();
  readonly tracks: UpgradeTrackDef[];
  readonly stats: StatResolver;
  readonly upgradeCostScale: number;
  readonly stock = new Inventory();
  /** Tick at which the next vehicle may set out. */
  nextDispatch = 0;
  protected seq = 0;

  constructor(
    readonly id: string,
    readonly site: Site,
    protected readonly ctx: ChannelContext,
    base: { baseIntervalSec: number; baseLoad: number; upgradeTracks: UpgradeTrackId[] },
    extraStats: Record<string, number> = {},
  ) {
    this.tracks = base.upgradeTracks.flatMap((trackId) => ctx.catalog.upgradeTracks[trackId] ?? []);
    this.upgradeCostScale = ctx.balance.channels.upgradeCostScale[id] ?? 1;
    this.stats = new StatResolver(
      id,
      { [Stat.interval]: base.baseIntervalSec, [Stat.load]: base.baseLoad, ...extraStats },
      this.tracks,
      this.levels,
      ctx.modifiers,
    );
  }

  /** Recomputes everything derived from stats. Call after an upgrade. */
  refresh(): void {
    this.stats.invalidate();
  }

  protected get intervalTicks(): number {
    return secondsToTicks(Math.max(0.05, this.stats.number(Stat.interval)));
  }

  protected get load(): BigNum {
    return this.stats.value(Stat.load);
  }

  protected known = (item: ItemId): boolean => item in this.ctx.catalog.items;

  /** Restores the upgrade levels and pays back levels beyond a maximum lowered since the save. */
  protected restoreUpgrades(saved: unknown): void {
    const refund = restoreLevels(this.levels, this.tracks, saved, this.upgradeCostScale);
    if (isPositive(refund)) this.ctx.refund(refund);
    this.refresh();
  }

  protected parked(): { x: number; y: number; z: number; heading: number } {
    const { dock, heading } = this.site;
    return { x: dock.x, y: dock.y, z: dock.z, heading };
  }

  cancelDelivery(_item: ItemId, _planned: BigNum): void {}
  pickup(_item: ItemId, _planned: BigNum): BigNum {
    return BigNum.ZERO;
  }
  cancelPickup(_item: ItemId, _planned: BigNum): void {}
}

// --- inbound -----------------------------------------------------------------

/**
 * What the buildings still want of each raw material, plus a reserve, beyond
 * what is on the island or on its way, scaled down to fit a load of `load`. Every place
 * that imports asks the same question, so the yard, the dock and the apron
 * share the demand instead of each bringing all of it. Null when nothing is wanted.
 */
function planImport(ctx: ChannelContext, load: BigNum): Array<{ item: ItemId; amount: BigNum }> | null {
  const needs: Array<{ item: ItemId; amount: BigNum }> = [];
  let total = BigNum.ZERO;
  const reserve = ctx.balance.imports.reserveBuffers;
  for (const item of ctx.rawItems) {
    const consumers = ctx.consumersOf(item);
    if (consumers.length === 0) continue;
    let wanted = BigNum.ZERO;
    for (const consumer of consumers) wanted = wanted.add(consumer.demand(item)).add(consumer.inputTarget(item).mul(reserve));
    // Stock a carrier has already claimed is no longer counted in the buildings' demand.
    const need = subClamp(wanted, ctx.rawOnHand(item));
    if (!isPositive(need)) continue;
    needs.push({ item, amount: need });
    total = total.add(need);
  }
  if (needs.length === 0 || !isPositive(load)) return null;
  if (total.cmp(load) > 0) {
    const share = load.div(total);
    for (const need of needs) need.amount = need.amount.mul(share);
  }
  return needs;
}

/** Raw material stock waiting for the buildings' carriers: the inbound yard, or what ships and planes unloaded. */
class RawStock implements PickupSource {
  readonly pickupUrgency = 0;
  /** Everything that ever arrived here; not saved, only for reports. */
  arrived = BigNum.ZERO;

  constructor(
    readonly id: string,
    readonly site: Site,
    readonly stock: Inventory = new Inventory(),
  ) {}

  /** What is here or on its way here. */
  onHand(item: ItemId): BigNum {
    const slot = this.stock.get(item);
    return slot ? slot.available().add(slot.incoming) : BigNum.ZERO;
  }

  expect(item: ItemId, amount: BigNum): void {
    const slot = this.stock.slot(item);
    slot.incoming = slot.incoming.add(amount);
  }

  arrive(item: ItemId, amount: BigNum): void {
    this.arrived = this.arrived.add(amount);
    const slot = this.stock.slot(item);
    slot.incoming = subClamp(slot.incoming, amount);
    slot.add(amount);
  }

  fullness(_item: ItemId): number {
    return 0;
  }
  availableForPickup(item: ItemId): BigNum {
    return this.stock.get(item)?.available() ?? BigNum.ZERO;
  }
  reservePickup(item: ItemId, amount: BigNum): void {
    const slot = this.stock.get(item);
    if (slot) slot.reserved = slot.reserved.add(amount);
  }
  pickup(item: ItemId, planned: BigNum): BigNum {
    const slot = this.stock.get(item);
    if (!slot) return BigNum.ZERO;
    slot.reserved = subClamp(slot.reserved, planned);
    return slot.take(planned);
  }
  cancelPickup(item: ItemId, planned: BigNum): void {
    const slot = this.stock.get(item);
    if (slot) slot.reserved = subClamp(slot.reserved, planned);
  }
  deliver(item: ItemId, delivered: BigNum, _planned: BigNum): void {
    this.stock.slot(item).add(delivered);
  }
  cancelDelivery(_item: ItemId, _planned: BigNum): void {}
}

/** Where a ship or plane leaves the raw materials it brought: the dock or the apron, a node of its own. */
export class ImportDepot extends RawStock {}

/**
 * Raw material trucks. Each truck brings what the buildings are asking for,
 * split in proportion to their requests, and leaves it in the yard, where
 * the buildings' carriers come to fetch it. Nothing is brought that nobody
 * wants.
 */
export class InboundChannel extends ChannelBase implements PickupSource {
  readonly pickupUrgency = 0;
  readonly trucks: Visitor[] = [];
  /** Works the channel's own stock; shares its code with the import depots. */
  private readonly yard: RawStock;
  private readonly inPath: Path;
  private readonly outPath: Path;

  constructor(
    readonly def: InboundChannelDef,
    site: Site,
    ctx: ChannelContext,
  ) {
    super(def.id, site, ctx, def);
    this.yard = new RawStock(def.id, site, this.stock);
    this.inPath = ctx.gatePath(site);
    this.outPath = reversePath(this.inPath);
    this.refresh();
  }

  update(tick: number): void {
    for (let i = this.trucks.length - 1; i >= 0; i -= 1) {
      const truck = this.trucks[i]!;
      if (tick >= truck.wake) this.advance(truck, i, tick);
    }
    if (tick >= this.nextDispatch) {
      this.nextDispatch = tick + (this.dispatch(tick) ? this.intervalTicks : RETRY_TICKS);
    }
  }

  /** Sends a truck loaded with what is being asked for. False when nothing is wanted. */
  private dispatch(tick: number): boolean {
    const load = this.load;
    const needs = planImport(this.ctx, load);
    if (!needs) return false;
    this.seq += 1;
    const truck = new Visitor(`${this.id}.v${this.seq}`, 'inboundTruck', this.def.vehicleModel);
    truck.capacity = load;
    for (const { item, amount } of needs) {
      truck.cargo.add(item, amount);
      this.yard.expect(item, amount);
    }
    const { weight } = this.ctx.balance;
    const factor = weightFactor(truck.cargo.averageWeight(this.ctx.catalog.items), weight.inboundSensitivity, this.ctx.balance);
    truck.wake = truck.travel(this.inPath, this.def.vehicleSpeed * factor, tick);
    this.trucks.push(truck);
    return true;
  }

  private advance(truck: Visitor, index: number, tick: number): void {
    if (truck.phase === 'in') {
      truck.phase = 'handle';
      truck.state = 'unloading';
      truck.wake = tick + secondsToTicks(this.ctx.balance.channels.handlingSec);
    } else if (truck.phase === 'handle') {
      for (const [item, amount] of truck.cargo.items) this.yard.arrive(item, amount);
      truck.cargo.clear();
      truck.phase = 'out';
      truck.wake = truck.travel(this.outPath, this.def.vehicleSpeed, tick);
      this.ctx.markDirty();
    } else {
      this.trucks.splice(index, 1);
    }
  }

  /** Raw materials the trucks have brought so far; not saved, only for reports. */
  get arrived(): BigNum {
    return this.yard.arrived;
  }

  // PickupSource: the yard's stock
  onHand(item: ItemId): BigNum {
    return this.yard.onHand(item);
  }
  fullness(_item: ItemId): number {
    return 0;
  }
  availableForPickup(item: ItemId): BigNum {
    return this.yard.availableForPickup(item);
  }
  reservePickup(item: ItemId, amount: BigNum): void {
    this.yard.reservePickup(item, amount);
  }
  override pickup(item: ItemId, planned: BigNum): BigNum {
    return this.yard.pickup(item, planned);
  }
  override cancelPickup(item: ItemId, planned: BigNum): void {
    this.yard.cancelPickup(item, planned);
  }
  deliver(item: ItemId, delivered: BigNum, planned: BigNum): void {
    this.yard.deliver(item, delivered, planned);
  }

  get handlingCount(): number {
    let count = 0;
    for (const truck of this.trucks) if (truck.phase === 'handle') count += 1;
    return count;
  }

  vehicleViews(tick: number, out: VehicleView[]): void {
    for (const truck of this.trucks) out.push({ ...truck.view(tick, this.parked()), home: this.id });
  }

  facilityView(tick: number, money: BigNum, carrierHandling: number): FacilityView {
    return {
      id: this.def.facility,
      kind: 'inboundYard',
      channelId: this.id,
      unlocked: true,
      stock: this.stock.views(),
      upgrades: upgradeViews(this, money),
      nextArrivalSec: Math.max(0, this.nextDispatch - tick) / TICKS_PER_SECOND,
      handlingCount: carrierHandling + this.handlingCount,
    };
  }

  toJSON(): JsonValue {
    return {
      levels: serializeLevels(this.levels),
      stock: this.stock.toJSON(true),
      nextDispatch: this.nextDispatch,
      seq: this.seq,
      trucks: this.trucks.map((truck) => truck.toJSON()),
    };
  }

  restore(saved: unknown): void {
    if (!saved || typeof saved !== 'object') return;
    const data = saved as Record<string, unknown>;
    this.restoreUpgrades(data.levels);
    this.stock.restore(data.stock, this.known);
    this.nextDispatch = Number(data.nextDispatch) || 0;
    this.seq = Number(data.seq) || 0;
    this.trucks.length = 0;
    for (const raw of Array.isArray(data.trucks) ? data.trucks : []) {
      const truck = restoreVisitor(raw, 'inboundTruck', this.def.vehicleModel, this.inPath, this.outPath, this.known);
      if (!truck) continue;
      if (truck.phase === 'handle') truck.state = 'unloading';
      this.trucks.push(truck);
    }
  }
}

// --- sale --------------------------------------------------------------------

/**
 * Takes goods nobody on the island asked for. Its own carriers fetch them
 * from the buildings. One vehicle at a time comes
 * in, loads a share of everything waiting and leaves; the money arrives the
 * moment it is off the island. Heavy cargo slows the trip, which delays the
 * next visit.
 */
export abstract class SaleChannel extends ChannelBase implements SaleHome {
  abstract readonly vehicleKind: VehicleKind;
  readonly carriers: Carrier[] = [];
  /** Where this channel's vehicles leave the raw materials they bring in; null when they arrive empty. */
  readonly depot: ImportDepot | null;
  vehicle: Visitor | null = null;
  private spawnTick = 0;
  private paths: { in: Path; out: Path } | null = null;

  constructor(
    readonly def: SaleChannelDef,
    site: Site,
    ctx: ChannelContext,
  ) {
    const { saleCarriers } = ctx.balance;
    super(def.id, site, ctx, def, {
      [Stat.carrierCount]: saleCarriers.baseCount,
      [Stat.carrierLoad]: saleCarriers.baseLoad,
      [Stat.importLoad]: def.importBaseLoad ?? 0,
    });
    this.depot = def.importBaseLoad ? new ImportDepot(`${def.id}.import`, site) : null;
    this.refresh();
  }

  override refresh(): void {
    super.refresh();
    const wanted = Math.max(0, Math.round(this.stats.number(Stat.carrierCount)));
    while (this.carriers.length < wanted) {
      this.carriers.push(new Carrier(`${this.id}.c${this.carriers.length + 1}`, this, this.ctx.balance.carriers.model, 'facility'));
    }
  }

  /** Path a vehicle takes onto the island; its last point is where it loads. */
  protected abstract approach(): Path;

  /** Path a vehicle takes away, from where it loaded; null to go back the way it came. */
  protected departure(): Path | null {
    return null;
  }

  private get lanes(): { in: Path; out: Path } {
    if (!this.paths) {
      const path = this.approach();
      this.paths = { in: path, out: this.departure() ?? reversePath(path) };
    }
    return this.paths;
  }

  get unlocked(): boolean {
    return this.ctx.isUnlocked(this.def.unlock);
  }

  /** Vehicle loads waiting here, counting what carriers are already bringing. */
  backlog(): number {
    let queued = BigNum.ZERO;
    for (const slot of this.stock.list) queued = queued.add(slot.amount).add(slot.incoming);
    return ratio(queued, this.load);
  }

  get isBackedUp(): boolean {
    return this.backlog() >= this.ctx.balance.channels.backlogLoads;
  }

  /** Money for a load worth `gross` at base prices. Channels with fees or losses override this. */
  protected proceeds(gross: BigNum): BigNum {
    return gross.mul(this.def.priceMultiplier).mul(this.ctx.priceMultiplier());
  }

  update(tick: number): void {
    const vehicle = this.vehicle;
    if (vehicle) {
      if (tick >= vehicle.wake) this.advance(vehicle, tick);
      return;
    }
    if (tick < this.nextDispatch || !this.unlocked) return;
    const imports = this.depot ? planImport(this.ctx, this.stats.value(Stat.importLoad)) : null;
    if (!this.stock.hasAny && !imports) {
      this.nextDispatch = tick + RETRY_TICKS;
      return;
    }
    this.seq += 1;
    const next = new Visitor(`${this.id}.v${this.seq}`, this.vehicleKind, this.def.vehicleModel);
    next.capacity = this.load;
    let speed = this.def.vehicleSpeed;
    if (imports && this.depot) {
      // Comes in loaded with raw materials; the demand they meet is counted from now on.
      next.capacity = this.stats.value(Stat.importLoad);
      for (const { item, amount } of imports) {
        next.cargo.add(item, amount);
        this.depot.expect(item, amount);
      }
      speed *= weightFactor(next.cargo.averageWeight(this.ctx.catalog.items), this.def.weightSensitivity, this.ctx.balance);
    }
    next.wake = next.travel(this.lanes.in, speed, tick);
    this.vehicle = next;
    this.spawnTick = tick;
    this.nextDispatch = tick + this.intervalTicks;
  }

  private advance(vehicle: Visitor, tick: number): void {
    if (vehicle.phase === 'in') {
      vehicle.phase = 'handle';
      vehicle.state = 'loading';
      vehicle.wake = tick + secondsToTicks(this.ctx.balance.channels.handlingSec);
    } else if (vehicle.phase === 'handle') {
      if (this.depot) for (const [item, amount] of vehicle.cargo.items) this.depot.arrive(item, amount);
      vehicle.cargo.clear();
      let total = BigNum.ZERO;
      for (const slot of this.stock.list) total = total.add(slot.amount);
      const load = this.load;
      vehicle.capacity = load;
      // When there is more than fits, every item gets its share so nothing is starved of room.
      const share = total.cmp(load) > 0 ? load.div(total) : null;
      for (const slot of this.stock.list) {
        if (!slot.hasStock) continue;
        vehicle.cargo.add(slot.item, slot.take(share ? slot.amount.mul(share) : slot.amount));
      }
      const items = this.ctx.catalog.items;
      const factor = weightFactor(vehicle.cargo.averageWeight(items), this.def.weightSensitivity, this.ctx.balance);
      this.nextDispatch = this.spawnTick + Math.round(this.intervalTicks / factor);
      vehicle.phase = 'out';
      vehicle.wake = vehicle.travel(this.lanes.out, this.def.vehicleSpeed * factor, tick);
      this.ctx.markDirty();
    } else {
      const items = this.ctx.catalog.items;
      let gross = BigNum.ZERO;
      for (const [item, amount] of vehicle.cargo.items) {
        const value = amount.mul(items[item]?.basePrice ?? 0);
        gross = gross.add(value);
        if (isPositive(value)) this.ctx.sold(this.id, item, this.proceeds(value));
      }
      this.vehicle = null;
      if (isPositive(gross)) this.ctx.earn(this.proceeds(gross), this.id, this.site.x, this.site.z);
    }
  }

  // SaleHome
  carrierCapacity(): BigNum {
    return this.stats.value(Stat.carrierLoad);
  }
  pullSlots(): readonly Slot[] {
    return NO_SLOTS;
  }
  returnCargo(item: ItemId, amount: BigNum): void {
    this.stock.slot(item).add(amount);
  }
  reserveDelivery(item: ItemId, amount: BigNum): void {
    const slot = this.stock.slot(item);
    slot.incoming = slot.incoming.add(amount);
  }
  deliver(item: ItemId, delivered: BigNum, planned: BigNum): void {
    const slot = this.stock.slot(item);
    slot.incoming = subClamp(slot.incoming, planned);
    slot.add(delivered);
  }
  override cancelDelivery(item: ItemId, planned: BigNum): void {
    const slot = this.stock.get(item);
    if (slot) slot.incoming = subClamp(slot.incoming, planned);
  }

  get handlingCount(): number {
    return this.vehicle?.phase === 'handle' ? 1 : 0;
  }

  vehicleViews(tick: number, out: VehicleView[]): void {
    if (this.vehicle) out.push({ ...this.vehicle.view(tick, this.parked()), home: this.id });
  }

  facilityView(tick: number, money: BigNum, carrierHandling: number): FacilityView {
    const unlocked = this.unlocked;
    return {
      id: this.def.facility,
      kind: this.ctx.layout.facilities.find((facility) => facility.id === this.def.facility)?.kind ?? 'truckYard',
      channelId: this.id,
      unlocked,
      // Raw materials brought in are shown alongside the goods waiting to leave.
      stock: this.depot ? [...this.stock.views(), ...this.depot.stock.views()] : this.stock.views(),
      upgrades: upgradeViews(this, money),
      nextArrivalSec: unlocked ? Math.max(0, this.nextDispatch - tick) / TICKS_PER_SECOND : null,
      handlingCount: carrierHandling + this.handlingCount,
    };
  }

  toJSON(): JsonValue {
    return {
      levels: serializeLevels(this.levels),
      stock: this.stock.toJSON(true),
      ...(this.depot ? { imports: this.depot.stock.toJSON(true) } : {}),
      nextDispatch: this.nextDispatch,
      spawnTick: this.spawnTick,
      seq: this.seq,
      vehicle: this.vehicle ? this.vehicle.toJSON() : null,
      carriers: this.carriers.map((carrier) => carrier.toJSON()),
    };
  }

  restore(saved: unknown): void {
    if (!saved || typeof saved !== 'object') return;
    const data = saved as Record<string, unknown>;
    this.restoreUpgrades(data.levels);
    this.stock.restore(data.stock, this.known);
    this.depot?.stock.restore(data.imports, this.known);
    this.nextDispatch = Number(data.nextDispatch) || 0;
    this.spawnTick = Number(data.spawnTick) || 0;
    this.seq = Number(data.seq) || 0;
    this.vehicle = restoreVisitor(data.vehicle, this.vehicleKind, this.def.vehicleModel, this.lanes.in, this.lanes.out, this.known);
    const carriers = Array.isArray(data.carriers) ? data.carriers : [];
    this.carriers.forEach((carrier, index) => carrier.restore(carriers[index], this.ctx));
  }
}

/** Sale trucks use the road from the island gate. */
export class TruckSaleChannel extends SaleChannel {
  readonly vehicleKind: VehicleKind = 'saleTruck';
  protected approach(): Path {
    return this.ctx.gatePath(this.site);
  }
}

/** Ships come up the river to the dock. */
export class ShipSaleChannel extends SaleChannel {
  readonly vehicleKind: VehicleKind = 'ship';
  protected approach(): Path {
    return makePath(this.ctx.layout.shipLane);
  }

  protected override departure(): Path | null {
    const way = this.ctx.layout.shipDeparture;
    return way ? makePath(way) : null;
  }
}

/** Planes land on the runway and taxi to the apron. */
export class PlaneSaleChannel extends SaleChannel {
  readonly vehicleKind: VehicleKind = 'plane';
  protected approach(): Path {
    return makePath(this.ctx.layout.flightLane);
  }

  protected override departure(): Path | null {
    const way = this.ctx.layout.flightDeparture;
    return way ? makePath(way) : null;
  }
}

/** Trade with another island: a better price, less a transport fee and goods lost on the way. */
export class IslandExportChannel extends ShipSaleChannel {
  protected override proceeds(gross: BigNum): BigNum {
    const kept = (1 - (this.def.lossRate ?? 0)) * (1 - (this.def.feeRate ?? 0));
    return super.proceeds(gross).mul(Math.max(0, kept));
  }
}

export type SaleChannelFactory = (def: SaleChannelDef, site: Site, ctx: ChannelContext) => SaleChannel;

const factories = new Map<string, SaleChannelFactory>();

/** Makes a kind of sale channel available to channel definitions whose `kind` names it. */
export function registerSaleChannel(kind: string, factory: SaleChannelFactory): void {
  factories.set(kind, factory);
}

export function createSaleChannel(def: SaleChannelDef, site: Site, ctx: ChannelContext): SaleChannel {
  const factory = factories.get(def.kind);
  if (!factory) throw new Error(`No sale channel registered for kind "${def.kind}" (channel ${def.id})`);
  return factory(def, site, ctx);
}

registerSaleChannel('truck', (def, site, ctx) => new TruckSaleChannel(def, site, ctx));
registerSaleChannel('ship', (def, site, ctx) => new ShipSaleChannel(def, site, ctx));
registerSaleChannel('plane', (def, site, ctx) => new PlaneSaleChannel(def, site, ctx));
registerSaleChannel('islandExport', (def, site, ctx) => new IslandExportChannel(def, site, ctx));
