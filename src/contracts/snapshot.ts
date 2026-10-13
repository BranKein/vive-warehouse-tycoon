/**
 * Read model handed to the renderer and the UI. It is a plain data tree
 * rebuilt by the simulation on demand; consumers must treat it as read-only
 * and must not hold on to nested objects across frames.
 */
import type { BigNum } from '@/core/BigNum';
import type {
  BuildingCategory,
  BuildingTypeId,
  ChannelId,
  FacilityId,
  FacilityKind,
  IslandId,
  ItemId,
  PlotId,
  StatId,
  UnlockId,
  UpgradeTrackId,
  UpgradeUnit,
} from './defs';

export type BuildingId = string;
export type VehicleId = string;
export type GameSpeed = 0 | 1 | 2 | 4;

export interface StockView {
  item: ItemId;
  amount: BigNum;
  /** Null when the stock has no limit. */
  capacity: BigNum | null;
}

export interface UpgradeView {
  trackId: UpgradeTrackId;
  stat: StatId;
  unit: UpgradeUnit;
  level: number;
  maxLevel: number | null;
  /** Null once the track is maxed out. */
  cost: BigNum | null;
  affordable: boolean;
  current: BigNum;
  /** Value after buying one more level; null once maxed out. */
  next: BigNum | null;
}

export interface ModifierView {
  /** Translation key suffix, e.g. "wasteClogged". */
  source: string;
  stat: StatId;
  multiplier: number;
}

export type BuildingStatus = 'working' | 'starved' | 'outputFull' | 'idle';

export interface BuildingView {
  id: BuildingId;
  typeId: BuildingTypeId;
  plotId: PlotId;
  status: BuildingStatus;
  /** Inputs that are short when `status` is "starved". */
  missingInputs: ItemId[];
  /** Progress of the current cycle, 0..1. */
  progress: number;
  inputs: StockView[];
  outputs: StockView[];
  waste: StockView[];
  /** 0..1+, where 1 is the point at which the waste penalty starts. */
  wasteRatio: number;
  modifiers: ModifierView[];
  upgrades: UpgradeView[];
  /** Carriers currently being loaded or unloaded at this building's yard. Drives forklift animation. */
  handlingCount: number;
  /** Share of the last few minutes spent working, 0..1; null until it has been measured. */
  uptime: number | null;
  invested: BigNum;
  /** Money returned if the building is demolished now. */
  refund: BigNum;
}

export interface FacilityView {
  id: FacilityId;
  kind: FacilityKind;
  channelId: ChannelId;
  unlocked: boolean;
  stock: StockView[];
  upgrades: UpgradeView[];
  /** Seconds (at 1x speed) until the next vehicle is dispatched; null while locked. */
  nextArrivalSec: number | null;
  handlingCount: number;
}

export type VehicleKind = 'carrier' | 'inboundTruck' | 'saleTruck' | 'ship' | 'plane';
/** Who a carrier works for: a transport facility, or the category of its building. */
export type VehicleOwner = 'facility' | BuildingCategory;
export type VehicleState = 'moving' | 'loading' | 'unloading' | 'waiting';

export interface VehicleView {
  id: VehicleId;
  kind: VehicleKind;
  /** Name looked up in the renderer's ModelRegistry. */
  model: string;
  x: number;
  y: number;
  z: number;
  /** Radians, 0 = facing +z, counter-clockwise from above. */
  heading: number;
  state: VehicleState;
  cargo: Array<{ item: ItemId; amount: BigNum }>;
  /** 0 (empty) .. 1 (full). */
  loadRatio: number;
  /** How much it can carry. */
  capacity: BigNum;
  /** Set for carriers only; the view paints them by it. */
  owner?: VehicleOwner;
  /** What it works for: a building id for a building's carrier, otherwise a channel id. */
  home?: string;
  /** Carriers only, while they are out: the plot or facility they are driving to or handling goods at. */
  destination?: string;
}

export interface SpecialCargoView {
  id: string;
  x: number;
  z: number;
  /** Seconds (at 1x speed) before it disappears. */
  expiresInSec: number;
  reward: BigNum;
}

export interface BuildOptionView {
  typeId: BuildingTypeId;
  unlocked: boolean;
  unlockId: UnlockId | null;
  cost: BigNum;
  affordable: boolean;
  builtCount: number;
  /** No more of this type can be built once `builtCount` reaches it. */
  maxCount: number;
}

export interface UnlockView {
  id: UnlockId;
  unlocked: boolean;
  /** All prerequisites are met. */
  available: boolean;
  cost: BigNum;
  affordable: boolean;
}

export interface PlotView {
  id: PlotId;
  buildingId: BuildingId | null;
}

/** Figures over the last few minutes of an island. */
export interface IslandStatsView {
  /** Seconds the figures cover; shorter than the full window right after a start or a load. */
  windowSec: number;
  /** Share of that time each building spent working, 0..1. */
  uptime: Record<BuildingId, number>;
  averageUptime: number | null;
  /** Building-seconds spent waiting for each item, most first. */
  shortages: Array<{ item: ItemId; seconds: number }>;
  /** Money received per item and per sale channel, most first. */
  salesByItem: Array<{ item: ItemId; amount: BigNum }>;
  salesByChannel: Array<{ channelId: ChannelId; amount: BigNum }>;
}

export interface IslandSnapshot {
  id: IslandId;
  maxBuildings: number;
  plots: PlotView[];
  buildings: BuildingView[];
  facilities: FacilityView[];
  vehicles: VehicleView[];
  buildOptions: BuildOptionView[];
  stats: IslandStatsView;
  specialCargo: SpecialCargoView | null;
}

export interface IslandSummaryView {
  id: IslandId;
  active: boolean;
  /** Estimated income used while the island is not being watched. */
  estimatedIncomePerSec: BigNum;
}

export interface AutoPilotView {
  enabled: boolean;
  /** What auto mode is currently saving up for, as a translation key plus params. */
  target: { key: string; params?: Record<string, string> } | null;
  targetCost: BigNum | null;
}

export interface GameSnapshot {
  tick: number;
  /** Simulated seconds played. */
  playSeconds: number;
  money: BigNum;
  /** Rolling average of realized income. */
  incomePerSec: BigNum;
  totalEarned: BigNum;
  speed: GameSpeed;
  autoPilot: AutoPilotView;
  unlocks: UnlockView[];
  globalUpgrades: UpgradeView[];
  islands: IslandSummaryView[];
  /** The island currently being watched. */
  island: IslandSnapshot;
}
