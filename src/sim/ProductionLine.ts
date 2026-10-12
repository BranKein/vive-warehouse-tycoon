/**
 * Production lines turn inputs into outputs. Every building owns exactly one
 * line; what kind it is comes from the recipe data. A new kind of line is a
 * class implementing `ProductionLine` plus one `registerProductionLine` call.
 */
import type { BuildingStatus, ItemDef, ItemId, RecipeDef } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import type { Inventory, Slot } from './Inventory';
import { isPositive, minOf, subClamp } from './math';

export interface LineState {
  inputs: Inventory;
  /** Sellable and reusable outputs; these slots have a capacity. */
  outputs: Inventory;
  /** Units processed per cycle when nothing is short. */
  batch: BigNum;
}

export type LinePlan =
  | {
      ok: true;
      /** Batch units this cycle will actually process (may be less than a full batch). */
      scale: BigNum;
      consume: Array<{ slot: Slot; amount: BigNum }>;
      fee: BigNum;
    }
  | { ok: false; status: BuildingStatus; missing: ItemId[] };

export interface ProductionLine {
  readonly recipe: RecipeDef;
  /** Decides whether a cycle can start now and what it would use. Must not change anything. */
  plan(state: LineState): LinePlan;
  /** Outputs of a finished cycle of the given scale. */
  produce(scale: BigNum): Array<{ item: ItemId; amount: BigNum }>;
  /** True when every input other than `item` is on hand. */
  readyExcept(item: ItemId, inputs: Inventory): boolean;
}

/** A cycle squeezed by a nearly full output must still be at least this share of what the inputs allow. */
const MIN_ROOM_SHARE = 0.5;
/** Cycles smaller than this share of a batch are not worth starting. */
const MIN_BATCH_SHARE = 1e-6;

/** Shared behaviour of recipe-driven lines. */
export abstract class RecipeLine implements ProductionLine {
  constructor(
    readonly recipe: RecipeDef,
    protected readonly items: Readonly<Record<ItemId, ItemDef>>,
  ) {}

  abstract plan(state: LineState): LinePlan;

  abstract readyExcept(item: ItemId, inputs: Inventory): boolean;

  produce(scale: BigNum): Array<{ item: ItemId; amount: BigNum }> {
    return this.recipe.outputs.map((io) => ({ item: io.item, amount: scale.mul(io.amount) }));
  }

  /** Limits the scale to what fits in the capped output slots; null when the outputs are full. */
  protected fitOutputs(state: LineState, wanted: BigNum): BigNum | null {
    let scale = wanted;
    for (const io of this.recipe.outputs) {
      const slot = state.outputs.get(io.item);
      if (!slot || !slot.capacity || io.amount <= 0) continue;
      scale = minOf(scale, subClamp(slot.capacity, slot.amount).div(io.amount));
    }
    if (scale.cmp(wanted.mul(MIN_ROOM_SHARE)) < 0) return null;
    return scale;
  }

  protected fee(scale: BigNum): BigNum {
    const cost = this.recipe.moneyCostPerCycle ?? 0;
    return cost > 0 ? scale.mul(cost) : BigNum.ZERO;
  }

  protected tooSmall(scale: BigNum, batch: BigNum): boolean {
    return !isPositive(scale) || scale.cmp(batch.mul(MIN_BATCH_SHARE)) < 0;
  }
}

/** The usual line: every input is needed, in the recipe's proportions. */
export class AllInputsLine extends RecipeLine {
  plan(state: LineState): LinePlan {
    let scale = state.batch;
    const missing: ItemId[] = [];
    let limiting: ItemId | null = null;
    for (const io of this.recipe.inputs) {
      const have = state.inputs.amount(io.item);
      if (!isPositive(have)) {
        missing.push(io.item);
        continue;
      }
      const possible = have.div(io.amount);
      if (possible.cmp(scale) < 0) {
        scale = possible;
        limiting = io.item;
      }
    }
    if (missing.length > 0) return { ok: false, status: 'starved', missing };
    if (this.tooSmall(scale, state.batch)) {
      return { ok: false, status: 'starved', missing: limiting ? [limiting] : [] };
    }
    const fitted = this.fitOutputs(state, scale);
    if (!fitted) return { ok: false, status: 'outputFull', missing: [] };
    return {
      ok: true,
      scale: fitted,
      consume: this.recipe.inputs.map((io) => ({ slot: state.inputs.slot(io.item), amount: fitted.mul(io.amount) })),
      fee: this.fee(fitted),
    };
  }

  readyExcept(item: ItemId, inputs: Inventory): boolean {
    for (const io of this.recipe.inputs) {
      if (io.item !== item && !isPositive(inputs.amount(io.item))) return false;
    }
    return true;
  }
}

/**
 * Each input is used on its own, whichever is on hand (waste disposal). The
 * scale of a cycle is the sum of the batch shares of all inputs.
 */
export class AnyInputLine extends RecipeLine {
  plan(state: LineState): LinePlan {
    const consume: Array<{ slot: Slot; amount: BigNum }> = [];
    let scale = BigNum.ZERO;
    for (const io of this.recipe.inputs) {
      const slot = state.inputs.slot(io.item);
      const amount = minOf(slot.amount, state.batch.mul(io.amount));
      if (!isPositive(amount)) continue;
      consume.push({ slot, amount });
      scale = scale.add(amount.div(io.amount));
    }
    if (this.tooSmall(scale, state.batch)) return { ok: false, status: 'idle', missing: [] };
    if (!this.fitOutputs(state, scale)) return { ok: false, status: 'outputFull', missing: [] };
    return { ok: true, scale, consume, fee: this.fee(scale) };
  }

  readyExcept(): boolean {
    return true;
  }
}

export type ProductionLineFactory = (recipe: RecipeDef, items: Readonly<Record<ItemId, ItemDef>>) => ProductionLine;

const factories = new Map<string, ProductionLineFactory>();

/** Makes a kind of line available to recipes whose `inputMode` names it. */
export function registerProductionLine(kind: string, factory: ProductionLineFactory): void {
  factories.set(kind, factory);
}

export function createProductionLine(recipe: RecipeDef, items: Readonly<Record<ItemId, ItemDef>>): ProductionLine {
  const kind: string = recipe.inputMode ?? 'all';
  const factory = factories.get(kind);
  if (!factory) throw new Error(`No production line registered for kind "${kind}" (recipe ${recipe.id})`);
  return factory(recipe, items);
}

registerProductionLine('all', (recipe, items) => new AllInputsLine(recipe, items));
registerProductionLine('any', (recipe, items) => new AnyInputLine(recipe, items));

/** Value of the sellable outputs of one batch unit; ranks buildings competing for the same goods. */
export function recipeProductValue(recipe: RecipeDef, items: Readonly<Record<ItemId, ItemDef>>): number {
  let value = 0;
  for (const io of recipe.outputs) value += io.amount * (items[io.item]?.basePrice ?? 0);
  return value;
}
