/**
 * Static content definitions. Everything the game contains (items, recipes,
 * buildings, transport, upgrades, unlocks, island layouts) is described with
 * these types and lives in `src/content`. Numbers here are plain JS numbers:
 * they are small base values, and the simulation scales them into BigNum.
 */

export type ItemId = string;
export type RecipeId = string;
export type BuildingTypeId = string;
export type UpgradeTrackId = string;
export type UnlockId = string;
export type ChannelId = string;
export type FacilityId = string;
export type IslandId = string;
export type PlotId = string;
export type RoadNodeId = string;

export type ItemKind = 'raw' | 'product' | 'byproduct' | 'waste';

export interface ItemDef {
  id: ItemId;
  kind: ItemKind;
  /** 0 = raw material, 1..4 = processing tier that produces it. */
  tier: number;
  /** 1 (light) .. 5 (heavy). Independent of price; only affects vehicle speed. */
  weight: number;
  /** Money received per unit when sold through a channel with multiplier 1. */
  basePrice: number;
  sellable: boolean;
}

export interface RecipeIO {
  item: ItemId;
  /** Units consumed or produced per cycle at batch size 1. */
  amount: number;
}

export interface RecipeDef {
  id: RecipeId;
  /** Any number of inputs, including none. */
  inputs: RecipeIO[];
  /** Any number of outputs, including none (e.g. waste disposal). */
  outputs: RecipeIO[];
  durationSec: number;
  /**
   * `all` (default): every input is required for a cycle.
   * `any`: each input is consumed independently, whichever is available
   * (e.g. a disposal plant that accepts several kinds of waste).
   */
  inputMode?: 'all' | 'any';
  /** Money spent per cycle at batch size 1 (e.g. waste disposal fees). */
  moneyCostPerCycle?: number;
}

export type BuildingCategory = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'handmade' | 'disposal';

export interface BuildingDef {
  id: BuildingTypeId;
  category: BuildingCategory;
  recipe: RecipeId;
  /** Name looked up in the renderer's ModelRegistry. */
  model: string;
  buildCost: number;
  /** Each additional building of the same type costs this many times more. */
  buildCostGrowth: number;
  /** Multiplies the base cost of every upgrade track on this building type. */
  upgradeCostScale: number;
  /** Null means available from the start. */
  unlock: UnlockId | null;
  upgradeTracks: UpgradeTrackId[];
}

/** Well-known stat names. Kept open (string) so new content can add stats without touching contracts. */
export type StatId = string;
export const Stat = {
  batchSize: 'batchSize',
  cycleSpeed: 'cycleSpeed',
  carrierCount: 'carrierCount',
  carrierLoad: 'carrierLoad',
  interval: 'interval',
  load: 'load',
  priceMultiplier: 'priceMultiplier',
} as const;

export type UpgradeScope = 'building' | 'inbound' | 'sale' | 'global';
export type UpgradeUnit = 'multiplier' | 'seconds' | 'count' | 'amount';

export interface UpgradeTrackDef {
  id: UpgradeTrackId;
  scope: UpgradeScope;
  stat: StatId;
  /** `multiply`: stat *= perLevel^level. `add`: stat += perLevel * level. */
  effect: { kind: 'multiply' | 'add'; perLevel: number };
  baseCost: number;
  costGrowth: number;
  /** Null means the track never ends. */
  maxLevel: number | null;
  unit: UpgradeUnit;
}

export type UnlockGrant =
  | { type: 'building'; buildingType: BuildingTypeId }
  | { type: 'saleChannel'; channel: ChannelId };

export interface UnlockDef {
  id: UnlockId;
  cost: number;
  requires: UnlockId[];
  grants: UnlockGrant;
}

export interface InboundChannelDef {
  id: ChannelId;
  facility: FacilityId;
  vehicleModel: string;
  baseIntervalSec: number;
  baseLoad: number;
  /** World units per second when empty. */
  vehicleSpeed: number;
  upgradeTracks: UpgradeTrackId[];
}

export type SaleChannelKind = 'truck' | 'ship' | 'plane' | 'islandExport';

export interface SaleChannelDef {
  id: ChannelId;
  kind: SaleChannelKind;
  facility: FacilityId;
  vehicleModel: string;
  baseIntervalSec: number;
  baseLoad: number;
  vehicleSpeed: number;
  /** Applied on top of each item's base price. */
  priceMultiplier: number;
  /** 0 = unaffected by cargo weight, 1 = fully affected. */
  weightSensitivity: number;
  /** Fraction of the proceeds paid as a transport fee (island export). */
  feeRate?: number;
  /** Fraction of the cargo lost in transit (island export). */
  lossRate?: number;
  unlock: UnlockId | null;
  upgradeTracks: UpgradeTrackId[];
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 extends Vec2 {
  y: number;
}

export interface PlotDef extends Vec2 {
  id: PlotId;
  /** Direction (radians, 0 = +z, counter-clockwise from above) the loading dock faces. */
  facing: number;
  /** Road node in front of the dock. */
  roadNode: RoadNodeId;
}

export interface RoadNodeDef extends Vec2 {
  id: RoadNodeId;
}

export type FacilityKind = 'inboundYard' | 'truckYard' | 'dock' | 'airport';

export interface FacilityDef extends Vec2 {
  id: FacilityId;
  kind: FacilityKind;
  facing: number;
  roadNode: RoadNodeId;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface IslandLayoutDef {
  bounds: Rect;
  plotSize: { width: number; depth: number };
  roadWidth: number;
  plots: PlotDef[];
  roadNodes: RoadNodeDef[];
  roadEdges: Array<[RoadNodeId, RoadNodeId]>;
  facilities: FacilityDef[];
  /** Road node where trucks enter and leave the island. */
  roadGate: RoadNodeId;
  /** Approach path for ships; the last point is the berth at the dock. */
  shipLane: Vec3[];
  /** Approach path for planes; the last point is the apron at the airport. */
  flightLane: Vec3[];
  /** Hints for scenery. */
  river: Rect;
  runway: Rect;
}

export interface IslandDef {
  id: IslandId;
  layout: IslandLayoutDef;
  maxBuildings: number;
  buildingTypes: BuildingTypeId[];
  inbound: ChannelId;
  saleChannels: ChannelId[];
  start: {
    money: number;
    buildings: Array<{ plot: PlotId; type: BuildingTypeId }>;
  };
}

export interface ContentCatalog {
  items: Record<ItemId, ItemDef>;
  recipes: Record<RecipeId, RecipeDef>;
  buildings: Record<BuildingTypeId, BuildingDef>;
  upgradeTracks: Record<UpgradeTrackId, UpgradeTrackDef>;
  unlocks: Record<UnlockId, UnlockDef>;
  inboundChannels: Record<ChannelId, InboundChannelDef>;
  saleChannels: Record<ChannelId, SaleChannelDef>;
  islands: Record<IslandId, IslandDef>;
  /** Upgrade tracks that apply to the whole game. */
  globalUpgradeTracks: UpgradeTrackId[];
  startIsland: IslandId;
}
