import type {
  BuildingDef,
  BuildingTypeId,
  ContentCatalog,
  FacilityView,
  GameEvent,
  IslandDef,
  IslandLayoutDef,
  IslandSnapshot,
  ItemDef,
  ItemId,
  JsonValue,
  PlotId,
  SpecialCargoView,
  UnlockId,
  VehicleView,
} from '@/contracts';
import { BigNum } from '@/core/BigNum';
import type { Balance } from '@/content/balance';
import { Building, type BuildingContext } from './Building';
import { createSaleChannel, InboundChannel, type ChannelContext, type SaleChannel } from './channels';
import { Dispatcher, type DispatchContext, type SaleTarget } from './Dispatcher';
import { parseAmount } from './Inventory';
import { ModifierRegistry } from './modifiers';
import type { CarrierHome, Consumer, LogisticsNode, PickupSource, Site } from './nodes';
import { makePath, RoadGraph, type Path } from './RoadGraph';
import { buildCost } from './upgrades';

/** What an island needs from the game that owns it. A sandbox host is used for income estimates. */
export interface IslandHost {
  readonly catalog: ContentCatalog;
  readonly balance: Balance;
  trySpend(amount: BigNum): boolean;
  earn(amount: BigNum, channelId: string, x: number, z: number): void;
  isUnlocked(unlock: UnlockId | null): boolean;
  priceMultiplier(): BigNum;
  emit(event: GameEvent): void;
}

const NO_CONSUMERS: readonly Consumer[] = [];
const NO_SOURCES: readonly PickupSource[] = [];

/**
 * One board: its plots, roads, buildings, vehicles and channels. It keeps
 * its own tick counter so it can be frozen while the player is elsewhere.
 */
export class Island implements BuildingContext, ChannelContext, DispatchContext {
  readonly catalog: ContentCatalog;
  readonly balance: Balance;
  readonly layout: IslandLayoutDef;
  readonly items: Readonly<Record<ItemId, ItemDef>>;
  readonly modifiers = new ModifierRegistry();
  readonly sites: Site[] = [];
  readonly rawItems: ItemId[];
  readonly buildings: Building[] = [];
  readonly inbound: InboundChannel;
  readonly sales: SaleChannel[] = [];
  /** Sale channels, best price first. */
  private readonly salesByPrice: SaleChannel[];
  homes: CarrierHome[] = [];
  tickCount = 0;
  /** Income per second assumed while the island is not being watched. */
  estimatedIncome = BigNum.ZERO;

  private readonly graph: RoadGraph;
  private readonly gateRoad: number;
  private readonly plotSites = new Map<PlotId, Site>();
  private readonly byPlot = new Map<PlotId, Building>();
  private readonly nodes = new Map<string, LogisticsNode>();
  private readonly consumers = new Map<ItemId, Consumer[]>();
  private readonly sources = new Map<ItemId, PickupSource[]>();
  private readonly paths = new Map<number, Path>();
  private readonly gatePaths = new Map<number, Path>();
  private readonly dispatcher: Dispatcher;
  private dirty = true;
  private nextBuildingSeq = 1;

  constructor(
    readonly def: IslandDef,
    private readonly host: IslandHost,
    options: { skipStart?: boolean } = {},
  ) {
    this.catalog = host.catalog;
    this.balance = host.balance;
    this.items = host.catalog.items;
    this.layout = def.layout;
    this.graph = new RoadGraph(def.layout);
    this.gateRoad = this.graph.index(def.layout.roadGate);
    this.rawItems = Object.values(this.items)
      .filter((item) => item.kind === 'raw')
      .map((item) => item.id);

    const halfDepth = def.layout.plotSize.depth / 2;
    for (const plot of def.layout.plots) {
      const site: Site = {
        index: this.sites.length,
        id: plot.id,
        x: plot.x,
        z: plot.z,
        dock: { x: plot.x + Math.sin(plot.facing) * halfDepth, y: 0, z: plot.z + Math.cos(plot.facing) * halfDepth },
        heading: plot.facing,
        road: this.graph.index(plot.roadNode),
      };
      this.sites.push(site);
      this.plotSites.set(plot.id, site);
    }
    const facilitySites = new Map<string, Site>();
    const offset = this.balance.channels.dockOffset;
    for (const facility of def.layout.facilities) {
      const road = this.graph.index(facility.roadNode);
      const node = def.layout.roadNodes[road]!;
      const dx = node.x - facility.x;
      const dz = node.z - facility.z;
      const length = Math.hypot(dx, dz) || 1;
      const reach = Math.min(offset, length);
      const site: Site = {
        index: this.sites.length,
        id: facility.id,
        x: facility.x,
        z: facility.z,
        dock: { x: facility.x + (dx / length) * reach, y: 0, z: facility.z + (dz / length) * reach },
        heading: Math.atan2(-dx, -dz),
        road,
      };
      this.sites.push(site);
      facilitySites.set(facility.id, site);
    }
    const siteOf = (facilityId: string, channelId: string): Site => {
      const site = facilitySites.get(facilityId);
      if (!site) throw new Error(`Channel ${channelId} refers to unknown facility ${facilityId} on island ${def.id}`);
      return site;
    };

    const inboundDef = this.catalog.inboundChannels[def.inbound];
    if (!inboundDef) throw new Error(`Island ${def.id} refers to unknown inbound channel ${def.inbound}`);
    this.inbound = new InboundChannel(inboundDef, siteOf(inboundDef.facility, inboundDef.id), this);
    this.nodes.set(this.inbound.id, this.inbound);
    for (const channelId of def.saleChannels) {
      const saleDef = this.catalog.saleChannels[channelId];
      if (!saleDef) throw new Error(`Island ${def.id} refers to unknown sale channel ${channelId}`);
      const channel = createSaleChannel(saleDef, siteOf(saleDef.facility, saleDef.id), this);
      this.sales.push(channel);
      this.nodes.set(channel.id, channel);
    }
    this.salesByPrice = [...this.sales].sort((a, b) => b.def.priceMultiplier - a.def.priceMultiplier);
    this.dispatcher = new Dispatcher(this);

    if (!options.skipStart) {
      for (const start of def.start.buildings) this.build(start.plot, start.type, BigNum.ZERO);
    }
    this.reindex();
  }

  get id(): string {
    return this.def.id;
  }

  // --- context for buildings, carriers, channels and the dispatcher ------------

  node(id: string): LogisticsNode | undefined {
    return this.nodes.get(id);
  }

  markDirty(): void {
    this.dirty = true;
  }

  trySpend(amount: BigNum): boolean {
    return this.host.trySpend(amount);
  }

  earn(amount: BigNum, channelId: string, x: number, z: number): void {
    this.host.earn(amount, channelId, x, z);
  }

  isUnlocked(unlock: UnlockId | null): boolean {
    return this.host.isUnlocked(unlock);
  }

  priceMultiplier(): BigNum {
    return this.host.priceMultiplier();
  }

  pathBetween(from: number, to: number): Path {
    const key = from * this.sites.length + to;
    let path = this.paths.get(key);
    if (!path) {
      const a = this.sites[from]!;
      const b = this.sites[to]!;
      path = makePath([a.dock, ...this.graph.route(a.road, b.road), b.dock]);
      this.paths.set(key, path);
    }
    return path;
  }

  gatePath(site: Site): Path {
    let path = this.gatePaths.get(site.index);
    if (!path) {
      path = makePath([...this.graph.route(this.gateRoad, site.road), site.dock]);
      this.gatePaths.set(site.index, path);
    }
    return path;
  }

  distance(from: number, to: number): number {
    return this.graph.distance(this.sites[from]!.road, this.sites[to]!.road);
  }

  consumersOf(item: ItemId): readonly Consumer[] {
    return this.consumers.get(item) ?? NO_CONSUMERS;
  }

  sourcesOf(item: ItemId): readonly PickupSource[] {
    return this.sources.get(item) ?? NO_SOURCES;
  }

  /** Best paying open channel that is not backed up; null leaves the goods where they are. */
  chooseSale(_item: ItemDef): SaleTarget | null {
    for (const channel of this.salesByPrice) {
      if (channel.unlocked && !channel.isBackedUp) return channel;
    }
    return null;
  }

  // --- simulation ----------------------------------------------------------------

  tick(): void {
    const tick = (this.tickCount += 1);
    this.inbound.update(tick);
    for (const channel of this.sales) channel.update(tick);
    for (const building of this.buildings) {
      if (tick >= building.wake) building.update(tick);
    }
    for (const home of this.homes) {
      for (const carrier of home.carriers) {
        if (tick >= carrier.wake) carrier.advance(tick, this);
      }
    }
    if (this.dirty) {
      this.dirty = false;
      for (const home of this.homes) {
        for (const carrier of home.carriers) {
          if (!carrier.isIdle) continue;
          const stops = this.dispatcher.plan(home);
          if (!stops) break;
          carrier.start(stops, home.carrierCapacity(), tick, this);
        }
      }
    }
  }

  // --- buildings -------------------------------------------------------------------

  buildingAt(plotId: PlotId): Building | undefined {
    return this.byPlot.get(plotId);
  }

  building(id: string): Building | undefined {
    const node = this.nodes.get(id);
    return node instanceof Building ? node : undefined;
  }

  hasPlot(plotId: PlotId): boolean {
    return this.plotSites.has(plotId);
  }

  countOf(typeId: BuildingTypeId): number {
    let count = 0;
    for (const building of this.buildings) if (building.def.id === typeId) count += 1;
    return count;
  }

  costOf(def: BuildingDef): BigNum {
    return buildCost(def, this.countOf(def.id));
  }

  get isFull(): boolean {
    return this.buildings.length >= Math.min(this.def.maxBuildings, this.layout.plots.length);
  }

  emptyPlots(): PlotId[] {
    return this.layout.plots.filter((plot) => !this.byPlot.has(plot.id)).map((plot) => plot.id);
  }

  /** Puts a building on a free plot. The caller has checked the rules and taken the money. */
  build(plotId: PlotId, typeId: BuildingTypeId, paid: BigNum, id?: string): Building {
    const site = this.plotSites.get(plotId);
    const def = this.catalog.buildings[typeId];
    if (!site || !def || this.byPlot.has(plotId)) throw new Error(`Cannot build ${typeId} on ${plotId}`);
    const building = new Building(id ?? `b${this.nextBuildingSeq++}`, def, site, this);
    building.invested = paid;
    this.buildings.push(building);
    this.byPlot.set(plotId, building);
    this.nodes.set(building.id, building);
    this.reindex();
    return building;
  }

  /** Removes a building and everything it holds; returns the refund. */
  demolish(building: Building): BigNum {
    const refund = building.refund;
    for (const carrier of building.carriers) carrier.cancel(this);
    this.buildings.splice(this.buildings.indexOf(building), 1);
    this.byPlot.delete(building.site.id);
    this.nodes.delete(building.id);
    this.modifiers.clearTarget(building.id);
    this.reindex();
    return refund;
  }

  /** Rebuilds the lookup tables the dispatcher uses. */
  private reindex(): void {
    this.homes = [this.inbound, ...this.buildings];
    this.consumers.clear();
    this.sources.clear();
    for (const building of this.buildings) {
      for (const item of building.deliveredInputs()) {
        const list = this.consumers.get(item) ?? [];
        list.push(building);
        this.consumers.set(item, list);
      }
      for (const item of building.wasteItems()) {
        const list = this.sources.get(item) ?? [];
        list.push(building);
        this.sources.set(item, list);
      }
    }
    this.dirty = true;
  }

  /** Something outside the island changed what its nodes can do (an upgrade, an unlock). */
  touch(): void {
    for (const building of this.buildings) building.wake = Math.min(building.wake, this.tickCount);
    this.dirty = true;
  }

  channel(id: string): InboundChannel | SaleChannel | undefined {
    if (id === this.inbound.id) return this.inbound;
    return this.sales.find((channel) => channel.id === id);
  }

  /** How many different building types have never been built here. */
  unbuiltTypeCount(): number {
    const built = new Set(this.buildings.map((building) => building.def.id));
    return this.def.buildingTypes.filter((typeId) => !built.has(typeId)).length;
  }

  // --- read model ------------------------------------------------------------------

  snapshot(money: BigNum, specialCargo: SpecialCargoView | null): IslandSnapshot {
    const tick = this.tickCount;
    const handling = new Array<number>(this.sites.length).fill(0);
    const vehicles: VehicleView[] = [];
    for (const home of this.homes) {
      for (const carrier of home.carriers) {
        const site = carrier.handlingSite;
        if (site >= 0) handling[site] = handling[site]! + 1;
        vehicles.push(carrier.viewAt(tick, this));
      }
    }
    this.inbound.vehicleViews(tick, vehicles);
    for (const channel of this.sales) channel.vehicleViews(tick, vehicles);
    const facilities: FacilityView[] = [
      this.inbound.facilityView(tick, money, handling[this.inbound.site.index]!),
      ...this.sales.map((channel) => channel.facilityView(tick, money, handling[channel.site.index]!)),
    ];
    return {
      id: this.def.id,
      maxBuildings: this.def.maxBuildings,
      plots: this.layout.plots.map((plot) => ({ id: plot.id, buildingId: this.byPlot.get(plot.id)?.id ?? null })),
      buildings: this.buildings.map((building) => building.view(tick, money, handling[building.site.index]!)),
      facilities,
      vehicles,
      buildOptions: this.def.buildingTypes.flatMap((typeId) => {
        const def = this.catalog.buildings[typeId];
        if (!def) return [];
        const cost = this.costOf(def);
        return {
          typeId,
          unlocked: this.isUnlocked(def.unlock),
          unlockId: def.unlock,
          cost,
          affordable: money.gte(cost),
          builtCount: this.countOf(typeId),
        };
      }),
      specialCargo,
    };
  }

  // --- saving ------------------------------------------------------------------------

  toJSON(): JsonValue {
    return {
      tick: this.tickCount,
      nextBuilding: this.nextBuildingSeq,
      estimated: this.estimatedIncome.toString(),
      buildings: this.buildings.map((building) => building.toJSON()),
      inbound: this.inbound.toJSON(),
      sales: Object.fromEntries(this.sales.map((channel) => [channel.id, channel.toJSON()])),
    };
  }

  /** Restores a freshly constructed island (built with `skipStart`). Unknown content is skipped. */
  restore(saved: unknown): void {
    if (!saved || typeof saved !== 'object') return;
    const data = saved as Record<string, unknown>;
    this.tickCount = Number(data.tick) || 0;
    this.estimatedIncome = parseAmount(data.estimated);
    const entries: Array<{ building: Building; saved: Record<string, unknown> }> = [];
    for (const raw of Array.isArray(data.buildings) ? data.buildings : []) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as Record<string, unknown>;
      const { id, type, plot } = entry;
      if (typeof id !== 'string' || typeof type !== 'string' || typeof plot !== 'string') continue;
      if (!this.catalog.buildings[type] || !this.plotSites.has(plot) || this.byPlot.has(plot) || this.nodes.has(id)) continue;
      entries.push({ building: this.build(plot, type, BigNum.ZERO, id), saved: entry });
    }
    this.nextBuildingSeq = Math.max(1, Number(data.nextBuilding) || 1);
    for (const building of this.buildings) {
      const seq = Number(/^b(\d+)$/.exec(building.id)?.[1] ?? 0);
      if (seq >= this.nextBuildingSeq) this.nextBuildingSeq = seq + 1;
    }
    // Every node exists before any state is restored, so carriers can resolve their stops.
    for (const entry of entries) entry.building.restore(entry.saved);
    this.inbound.restore(data.inbound);
    const sales = (data.sales && typeof data.sales === 'object' ? data.sales : {}) as Record<string, unknown>;
    for (const channel of this.sales) channel.restore(sales[channel.id]);
    this.reindex();
  }

  /**
   * Runs a throwaway copy of this island for a while and returns what it
   * earned per second. Nothing on this island changes.
   */
  estimateIncome(seconds: number, ticksPerSecond: number): BigNum {
    let net = BigNum.ZERO;
    const sandbox: IslandHost = {
      catalog: this.catalog,
      balance: this.balance,
      trySpend: (amount) => {
        net = net.sub(amount);
        return true;
      },
      earn: (amount) => {
        net = net.add(amount);
      },
      isUnlocked: (unlock) => this.host.isUnlocked(unlock),
      priceMultiplier: () => this.host.priceMultiplier(),
      emit: () => {},
    };
    const copy = new Island(this.def, sandbox, { skipStart: true });
    copy.restore(JSON.parse(JSON.stringify(this.toJSON())));
    const ticks = Math.max(1, Math.round(seconds * ticksPerSecond));
    for (let i = 0; i < ticks; i += 1) copy.tick();
    return net.sign > 0 ? net.div(ticks / ticksPerSecond) : BigNum.ZERO;
  }
}
