import type { ItemId, StockView } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import { isPositive, subClamp } from './math';

/** One item's stock in an inventory, with the reservations the dispatcher needs. */
export class Slot {
  amount = BigNum.ZERO;
  /** Goods on their way here (already promised to this slot). */
  incoming = BigNum.ZERO;
  /** Stock promised to a vehicle that has not picked it up yet. */
  reserved = BigNum.ZERO;
  /** Null means unlimited. */
  capacity: BigNum | null = null;

  constructor(readonly item: ItemId) {}

  add(amount: BigNum): void {
    this.amount = this.amount.add(amount);
  }

  /** Removes up to `amount` and returns what was actually taken. */
  take(amount: BigNum): BigNum {
    const taken = amount.cmp(this.amount) >= 0 ? this.amount : amount;
    this.amount = subClamp(this.amount, taken);
    return taken;
  }

  /** Free room after counting what is already on its way. Unlimited slots have no demand. */
  demand(): BigNum {
    if (!this.capacity) return BigNum.ZERO;
    return subClamp(this.capacity, this.amount.add(this.incoming));
  }

  /** Stock not yet promised to anyone. */
  available(): BigNum {
    return subClamp(this.amount, this.reserved);
  }

  get hasStock(): boolean {
    return isPositive(this.amount);
  }

  view(): StockView {
    return { item: this.item, amount: this.amount, capacity: this.capacity };
  }
}

export type SlotJson = [amount: string, incoming: string, reserved: string];

/** A set of slots keyed by item. Slots are created on first use and keep their insertion order. */
export class Inventory {
  readonly slots = new Map<ItemId, Slot>();
  /** Stable array of the same slots, for hot loops. */
  readonly list: Slot[] = [];

  slot(item: ItemId): Slot {
    let slot = this.slots.get(item);
    if (!slot) {
      slot = new Slot(item);
      this.slots.set(item, slot);
      this.list.push(slot);
    }
    return slot;
  }

  get(item: ItemId): Slot | undefined {
    return this.slots.get(item);
  }

  amount(item: ItemId): BigNum {
    return this.slots.get(item)?.amount ?? BigNum.ZERO;
  }

  get hasAny(): boolean {
    for (const slot of this.list) if (slot.hasStock) return true;
    return false;
  }

  views(): StockView[] {
    return this.list.map((slot) => slot.view());
  }

  /**
   * `keepEmpty` also writes slots that hold nothing. Inventories whose slots appear on demand
   * (channel stock) need it so a loaded game has the same slots in the same order.
   */
  toJSON(keepEmpty = false): Record<ItemId, SlotJson> {
    const out: Record<ItemId, SlotJson> = {};
    for (const slot of this.list) {
      if (!keepEmpty && slot.amount.isZero && slot.incoming.isZero && slot.reserved.isZero) continue;
      out[slot.item] = [slot.amount.toString(), slot.incoming.toString(), slot.reserved.toString()];
    }
    return out;
  }

  /** `known` filters out items that no longer exist in the content. */
  restore(saved: unknown, known: (item: ItemId) => boolean, onlyExisting = false): void {
    if (!saved || typeof saved !== 'object') return;
    for (const [item, value] of Object.entries(saved as Record<string, unknown>)) {
      if (!known(item) || !Array.isArray(value)) continue;
      if (onlyExisting && !this.slots.has(item)) continue;
      const slot = this.slot(item);
      slot.amount = parseAmount(value[0]);
      slot.incoming = parseAmount(value[1]);
      slot.reserved = parseAmount(value[2]);
    }
  }
}

/** Parses a saved amount; anything unreadable or negative counts as zero. */
export function parseAmount(value: unknown): BigNum {
  if (typeof value !== 'string' && typeof value !== 'number') return BigNum.ZERO;
  try {
    const parsed = BigNum.from(value);
    return parsed.sign < 0 ? BigNum.ZERO : parsed;
  } catch {
    return BigNum.ZERO;
  }
}
