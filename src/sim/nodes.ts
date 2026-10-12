/**
 * The roles of the logistics chain. Everything goods can rest at is a
 * `LogisticsNode`; the more specific interfaces describe what the dispatcher
 * and the carriers may ask of a node.
 */
import type { ItemId, Vec3 } from '@/contracts';
import type { BigNum } from '@/core/BigNum';
import type { Carrier } from './Carrier';
import type { Slot } from './Inventory';

/** A fixed place on the island a vehicle can drive to: a plot or a facility. */
export interface Site {
  readonly index: number;
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Where vehicles stop to load and unload. */
  readonly dock: Vec3;
  /** Heading of a vehicle parked at the dock. */
  readonly heading: number;
  /** Index of the road node in front of the dock. */
  readonly road: number;
}

export interface LogisticsNode {
  readonly id: string;
  readonly site: Site;
  /** Goods arrive. `planned` is the amount that was reserved for this delivery. */
  deliver(item: ItemId, delivered: BigNum, planned: BigNum): void;
  /** A reserved delivery will not happen after all. */
  cancelDelivery(item: ItemId, planned: BigNum): void;
  /** A vehicle collects goods reserved for it; returns what it actually got. */
  pickup(item: ItemId, planned: BigNum): BigNum;
  cancelPickup(item: ItemId, planned: BigNum): void;
}

/** A node that asks for goods. */
export interface Consumer extends LogisticsNode {
  /** How much of the item it still wants, not counting what is already on its way. */
  demand(item: ItemId): BigNum;
  reserveDelivery(item: ItemId, amount: BigNum): void;
  /** True when every other ingredient is on hand, so this item would let work start at once. */
  readyExcept(item: ItemId): boolean;
  /** Value of what one batch unit produces; used to rank competing requests. */
  readonly productValue: number;
}

/** A node that hands over goods to vehicles of another node (waste collection). */
export interface PickupSource extends LogisticsNode {
  availableForPickup(item: ItemId): BigNum;
  reservePickup(item: ItemId, amount: BigNum): void;
  /** Higher means more urgent to collect from. */
  readonly pickupUrgency: number;
}

/** A node that owns carriers. */
export interface CarrierHome extends LogisticsNode {
  readonly carriers: Carrier[];
  carrierCapacity(): BigNum;
  /** Stock its carriers take to whoever asks for it (or to a sale channel). */
  pushSlots(): readonly Slot[];
  /** Inputs its carriers go and fetch from other nodes. */
  pullSlots(): readonly Slot[];
  /** Called after the dispatcher removed stock from a push slot. */
  stockTaken(): void;
  /** Cargo that could not be delivered comes back. */
  returnCargo(item: ItemId, amount: BigNum): void;
}
