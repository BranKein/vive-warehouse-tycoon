import type { AutoPilotView, CommandResult, GameCommands } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import type { Rng } from '@/core/Rng';
import { secondsToTicks } from '@/core/time';
import type { Balance } from '@/content/balance';
import type { Island } from './Island';
import { nextUpgradeCost, type Upgradable } from './upgrades';

type GoalCategory = keyof Balance['autoPilot']['weights'];

/** One thing auto mode could buy. */
interface Goal {
  /** Stable description, used to find the same goal again after loading a save. */
  id: string;
  category: GoalCategory;
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
  readonly incomePerSec: BigNum;
  readonly island: Island;
  readonly globalUpgrades: Upgradable;
  /** Unlocks that are still locked but have their prerequisites met. */
  availableUnlocks(): Array<{ id: string; cost: BigNum }>;
}

/**
 * Plays the game on its own: draws a random goal from everything that can be
 * bought, saves up for it and buys it. Only acts on the watched island.
 */
export class AutoPilot {
  enabled = false;
  private goal: Goal | null = null;
  private goalSince = 0;
  /** Goal id from a save, resolved on the first check. */
  private pendingId: string | null = null;
  private resumedId: string | null = null;

  constructor(private readonly host: AutoPilotHost) {}

  /** Forgets the current goal (the island changed or auto mode was switched off). */
  reset(): void {
    this.goal = null;
    this.pendingId = null;
  }

  update(tick: number): void {
    if (!this.enabled) return;
    const config = this.host.balance.autoPilot;
    if (tick % secondsToTicks(config.checkEverySec) !== 0) return;
    if (!this.goal) {
      // A goal carried over from a save keeps the time it has already been waiting.
      const resumed = this.pendingId !== null;
      this.goal = this.choose();
      if (!this.goal) return;
      if (!resumed || this.goal.id !== this.resumedId) this.goalSince = tick;
      this.resumedId = null;
    }
    const cost = this.goal.cost();
    if (cost === null) {
      this.goal = null;
    } else if (this.host.money.gte(cost)) {
      this.goal.buy();
      this.goal = null;
    } else if (tick - this.goalSince > secondsToTicks(config.retargetSec)) {
      this.goal = null;
    }
  }

  private choose(): Goal | null {
    const all = this.candidates();
    if (this.pendingId) {
      const saved = all.find((goal) => goal.id === this.pendingId);
      this.pendingId = null;
      if (saved) {
        this.resumedId = saved.id;
        return saved;
      }
    }
    const { rng, balance, money, incomePerSec } = this.host;
    const priced = all.flatMap((goal) => {
      const cost = goal.cost();
      return cost ? [{ goal, cost }] : [];
    });
    if (priced.length === 0) return null;
    const budget = money.add(incomePerSec.mul(balance.autoPilot.horizonSec));
    const reachable = priced.filter((entry) => entry.cost.lte(budget));
    if (reachable.length === 0) {
      // Nothing is close: save up for the cheapest thing there is.
      return priced.reduce((best, entry) => (entry.cost.lt(best.cost) ? entry : best)).goal;
    }
    const categories = [...new Set(reachable.map((entry) => entry.goal.category))];
    const picked = rng.weightedIndex(categories.map((category) => balance.autoPilot.weights[category]));
    const category = categories[picked < 0 ? rng.int(categories.length) : picked]!;
    return rng.pick(reachable.filter((entry) => entry.goal.category === category)).goal;
  }

  /** Everything that can be bought right now, ignoring price. */
  private candidates(): Goal[] {
    const { commands, island, rng } = this.host;
    const goals: Goal[] = [];

    for (const unlock of this.host.availableUnlocks()) {
      goals.push({
        id: `unlock:${unlock.id}`,
        category: 'unlock',
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
      if (island.countOf(typeId) > 0 && spare <= 0) continue;
      goals.push({
        id: `build:${typeId}`,
        category: 'build',
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
          id: `building:${building.id}:${track.id}`,
          category: 'buildingUpgrade',
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
          id: `channel:${channel.id}:${track.id}`,
          category: 'channelUpgrade',
          view: { key: 'auto.target.upgradeChannel', params: { channel: channel.id, track: track.id } },
          cost: () => nextUpgradeCost(channel, track),
          buy: () => commands.upgradeChannel(channel.id, track.id),
        });
      }
    }

    const global = this.host.globalUpgrades;
    for (const track of global.tracks) {
      goals.push({
        id: `global:${track.id}`,
        category: 'globalUpgrade',
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

  toJSON(): { enabled: boolean; goal: string | null; since: number } {
    return { enabled: this.enabled, goal: this.goal?.id ?? this.pendingId, since: this.goalSince };
  }

  restore(saved: unknown): void {
    if (!saved || typeof saved !== 'object') return;
    const data = saved as Record<string, unknown>;
    this.enabled = data.enabled === true;
    this.pendingId = typeof data.goal === 'string' ? data.goal : null;
    this.goalSince = Number(data.since) || 0;
    this.goal = null;
  }
}
