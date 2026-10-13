import type { AutoPilotView, CommandResult, GameCommands } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import type { Rng } from '@/core/Rng';
import { secondsToTicks } from '@/core/time';
import type { Balance } from '@/content/balance';
import type { Island } from './Island';
import { nextUpgradeCost, type Upgradable } from './upgrades';

/** One thing auto mode could buy. */
interface Goal {
  view: { key: string; params?: Record<string, string> };
  /** Current price; null when the goal can no longer be bought. */
  cost(): BigNum | null;
  buy(): CommandResult;
}

/** What auto mode needs to see of the game. */
export interface AutoPilotHost {
  readonly balance: Balance;
  readonly rng: Rng;
  readonly commands: GameCommands;
  readonly money: BigNum;
  readonly island: Island;
  readonly globalUpgrades: Upgradable;
  /** Unlocks that are still locked but have their prerequisites met. */
  availableUnlocks(): Array<{ id: string; cost: BigNum }>;
}

/**
 * Plays the game on its own: always saves up for the cheapest thing that can
 * be bought and buys it. Only acts on the watched island.
 */
export class AutoPilot {
  enabled = false;
  private goal: Goal | null = null;

  constructor(private readonly host: AutoPilotHost) {}

  /** Forgets the current goal (the island changed or auto mode was switched off). */
  reset(): void {
    this.goal = null;
  }

  update(tick: number): void {
    if (!this.enabled) return;
    if (tick % secondsToTicks(this.host.balance.autoPilot.checkEverySec) !== 0) return;
    // Prices and options change as things are bought, so the goal is picked afresh every time.
    this.goal = this.cheapest();
    const cost = this.goal?.cost();
    if (!this.goal || !cost || !this.host.money.gte(cost)) return;
    this.goal.buy();
    this.goal = this.cheapest();
  }

  /** The cheapest goal; among equally cheap ones the first listed wins. */
  private cheapest(): Goal | null {
    let best: { goal: Goal; cost: BigNum } | null = null;
    for (const goal of this.candidates()) {
      const cost = goal.cost();
      if (cost && (!best || cost.lt(best.cost))) best = { goal, cost };
    }
    return best?.goal ?? null;
  }

  /** Everything that can be bought right now, ignoring price. */
  private candidates(): Goal[] {
    const { commands, island, rng } = this.host;
    const goals: Goal[] = [];

    for (const unlock of this.host.availableUnlocks()) {
      goals.push({
        view: { key: 'auto.target.unlock', params: { unlock: unlock.id } },
        cost: () => unlock.cost,
        buy: () => commands.unlock(unlock.id),
      });
    }

    // Plot reservation: keep one empty plot for every building type not built yet.
    const empty = island.freeSlots;
    const spare = empty - island.unbuiltTypeCount();
    for (const typeId of island.def.buildingTypes) {
      const def = island.catalog.buildings[typeId];
      if (!def || !island.isUnlocked(def.unlock) || empty <= 0) continue;
      if (island.countOf(typeId) >= def.maxCount) continue;
      if (island.countOf(typeId) > 0 && spare <= 0) continue;
      goals.push({
        view: { key: 'auto.target.build', params: { building: typeId } },
        cost: () => (island.isFull ? null : island.costOf(def)),
        buy: () => {
          const plots = island.emptyPlots();
          return plots.length > 0 ? commands.build(rng.pick(plots), typeId) : { ok: false, reason: 'islandFull' };
        },
      });
    }

    for (const building of island.buildings) {
      for (const track of building.tracks) {
        goals.push({
          view: { key: 'auto.target.upgradeBuilding', params: { building: building.def.id, track: track.id } },
          cost: () => (island.building(building.id) === building ? nextUpgradeCost(building, track) : null),
          buy: () => commands.upgradeBuilding(building.id, track.id),
        });
      }
    }

    const channels = [island.inbound, ...island.sales.filter((channel) => channel.unlocked)];
    for (const channel of channels) {
      for (const track of channel.tracks) {
        goals.push({
          view: { key: 'auto.target.upgradeChannel', params: { channel: channel.id, track: track.id } },
          cost: () => nextUpgradeCost(channel, track),
          buy: () => commands.upgradeChannel(channel.id, track.id),
        });
      }
    }

    const global = this.host.globalUpgrades;
    for (const track of global.tracks) {
      goals.push({
        view: { key: 'auto.target.upgradeGlobal', params: { track: track.id } },
        cost: () => nextUpgradeCost(global, track),
        buy: () => commands.upgradeGlobal(track.id),
      });
    }
    return goals;
  }

  view(): AutoPilotView {
    const goal = this.enabled ? this.goal : null;
    return { enabled: this.enabled, target: goal ? goal.view : null, targetCost: goal ? goal.cost() : null };
  }

  toJSON(): { enabled: boolean } {
    return { enabled: this.enabled };
  }

  restore(saved: unknown): void {
    if (!saved || typeof saved !== 'object') return;
    this.enabled = (saved as Record<string, unknown>).enabled === true;
    this.goal = null;
  }
}
