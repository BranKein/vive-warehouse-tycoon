import {
  SAVE_VERSION,
  Stat,
  type BuildingId,
  type BuildingTypeId,
  type ChannelId,
  type CommandResult,
  type ContentCatalog,
  type GameCommands,
  type GameEngine,
  type GameEvent,
  type GameSnapshot,
  type GameSpeed,
  type IslandId,
  type JsonValue,
  type PlotId,
  type SaveData,
  type SpecialCargoView,
  type UnlockId,
  type UnlockView,
  type UpgradeTrackDef,
  type UpgradeTrackId,
} from '@/contracts';
import { BigNum, bn } from '@/core/BigNum';
import { Rng } from '@/core/Rng';
import { secondsToTicks, TICKS_PER_SECOND } from '@/core/time';
import type { Balance } from '@/content/balance';
import { AutoPilot, type AutoPilotHost } from './AutoPilot';
import { parseAmount } from './Inventory';
import type { Island, IslandHost } from './Island';
import { IslandManager } from './IslandManager';
import { StatResolver } from './modifiers';
import { isMaxed, restoreLevels, serializeLevels, upgradeCost, upgradeViews, type Upgradable } from './upgrades';

export { SAVE_VERSION };

const DEFAULT_SEED = 1;
const GLOBAL_TARGET = 'global';
const SPEEDS: readonly GameSpeed[] = [0, 1, 2, 4];

const OK: CommandResult = { ok: true };
const fail = (reason: Extract<CommandResult, { ok: false }>['reason']): CommandResult => ({ ok: false, reason });

export interface GameOptions {
  catalog: ContentCatalog;
  balance: Balance;
  seed?: number;
  /** Already migrated to `SAVE_VERSION`. */
  save?: SaveData;
}

/** A clickable bonus lying on the island for a short while. */
interface SpecialCargo {
  id: string;
  x: number;
  z: number;
  /** Game tick at which it disappears. */
  expires: number;
}

/** The game-wide upgrade tracks (item price multiplier). */
class GlobalUpgrades implements Upgradable {
  readonly levels = new Map<UpgradeTrackId, number>();
  readonly tracks: UpgradeTrackDef[];
  readonly stats: StatResolver;
  readonly upgradeCostScale = 1;

  constructor(catalog: ContentCatalog, balance: Balance) {
    this.tracks = catalog.globalUpgradeTracks.flatMap((id) => catalog.upgradeTracks[id] ?? []);
    this.stats = new StatResolver(
      GLOBAL_TARGET,
      { [Stat.priceMultiplier]: balance.baseStats.priceMultiplier },
      this.tracks,
      this.levels,
      null,
    );
  }
}

/**
 * The whole game: money (shared by every island), unlocks, game-wide
 * upgrades, the islands, auto mode and the special cargo. It implements the
 * engine interface the app drives and the commands the player uses.
 */
export class Game implements GameEngine, GameCommands, IslandHost, AutoPilotHost {
  readonly catalog: ContentCatalog;
  readonly balance: Balance;
  readonly rng: Rng;
  readonly seed: number;
  readonly globalUpgrades: GlobalUpgrades;
  readonly islands: IslandManager;
  readonly autoPilot: AutoPilot;

  money = BigNum.ZERO;
  totalEarned = BigNum.ZERO;
  incomePerSec = BigNum.ZERO;
  speed: GameSpeed = 1;
  tickCount = 0;

  private readonly unlocked = new Set<UnlockId>();
  private events: GameEvent[] = [];
  /** Money earned since the income average was last updated. */
  private earnedThisWindow = BigNum.ZERO;
  private special: SpecialCargo | null = null;
  private specialSeq = 0;
  private nextSpecialTick: number;

  constructor(options: GameOptions) {
    this.catalog = options.catalog;
    this.balance = options.balance;
    const save = options.save;
    if (save && save.version !== SAVE_VERSION) {
      throw new Error(`Save version ${save.version} is not supported (expected ${SAVE_VERSION}); migrate it first`);
    }
    const state = (save && typeof save.state === 'object' && save.state !== null && !Array.isArray(save.state)
      ? save.state
      : null) as Record<string, unknown> | null;
    if (save && !state) throw new Error('Save has no readable state');

    this.seed = typeof state?.seed === 'number' ? state.seed : (options.seed ?? DEFAULT_SEED);
    this.rng = new Rng(this.seed);
    this.globalUpgrades = new GlobalUpgrades(this.catalog, this.balance);

    if (state) {
      // Unlocks and prices come first: islands read them while they are being restored.
      if (typeof state.rng === 'number') this.rng.setState(state.rng);
      this.tickCount = Math.max(0, Math.floor(Number(state.tick) || 0));
      this.money = parseAmount(state.money);
      this.totalEarned = parseAmount(state.totalEarned);
      this.incomePerSec = parseAmount(state.income);
      this.earnedThisWindow = parseAmount(state.incomeWindow);
      const speed = state.speed as GameSpeed;
      if (SPEEDS.includes(speed)) this.speed = speed;
      for (const id of Array.isArray(state.unlocked) ? state.unlocked : []) {
        if (typeof id === 'string' && this.catalog.unlocks[id]) this.unlocked.add(id);
      }
      restoreLevels(this.globalUpgrades.levels, this.globalUpgrades.tracks, state.global);
      this.globalUpgrades.stats.invalidate();
    } else {
      this.money = bn(this.catalog.islands[this.catalog.startIsland]?.start.money ?? 0);
    }

    this.islands = new IslandManager(this.catalog, this, state?.islands);
    this.autoPilot = new AutoPilot(this);
    this.nextSpecialTick = 0;
    if (state) {
      this.autoPilot.restore(state.auto);
      this.restoreSpecial(state.special);
    } else {
      this.nextSpecialTick = this.tickCount + this.rollSpecialDelay();
    }
  }

  get commands(): GameCommands {
    return this;
  }

  /** The island being watched. */
  get island(): Island {
    return this.islands.active;
  }

  // --- host for islands -------------------------------------------------------------

  trySpend(amount: BigNum): boolean {
    if (this.money.lt(amount)) return false;
    this.money = this.money.sub(amount);
    if (this.money.sign < 0) this.money = BigNum.ZERO;
    return true;
  }

  earn(amount: BigNum, channelId: string, x: number, z: number): void {
    this.addIncome(amount);
    this.emit({ type: 'sale', channelId, amount, x, z });
  }

  isUnlocked(unlock: UnlockId | null): boolean {
    return unlock === null || this.unlocked.has(unlock);
  }

  priceMultiplier(): BigNum {
    return this.globalUpgrades.stats.value(Stat.priceMultiplier);
  }

  emit(event: GameEvent): void {
    this.events.push(event);
    const limit = this.balance.eventQueueLimit;
    if (this.events.length > limit) this.events.splice(0, this.events.length - limit);
  }

  private addIncome(amount: BigNum): void {
    this.money = this.money.add(amount);
    this.totalEarned = this.totalEarned.add(amount);
    this.earnedThisWindow = this.earnedThisWindow.add(amount);
  }

  /** Adds money without counting it as income. For tests and development tools. */
  grant(amount: BigNum | number): void {
    this.money = this.money.add(amount);
  }

  // --- engine -------------------------------------------------------------------------

  tick(count = 1): void {
    for (let i = 0; i < count; i += 1) this.step();
  }

  private step(): void {
    const tick = (this.tickCount += 1);
    const away = this.islands.tick();
    if (!away.isZero) this.addIncome(away);
    this.updateSpecial(tick);
    this.autoPilot.update(tick);
    if (tick % TICKS_PER_SECOND === 0) {
      // Exponential moving average, sampled once a second.
      const alpha = 1 - Math.exp(-1 / Math.max(1e-6, this.balance.income.smoothingSec));
      this.incomePerSec = this.incomePerSec.mul(1 - alpha).add(this.earnedThisWindow.mul(alpha));
      this.earnedThisWindow = BigNum.ZERO;
    }
  }

  drainEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  snapshot(): GameSnapshot {
    const money = this.money;
    return {
      tick: this.tickCount,
      playSeconds: this.tickCount / TICKS_PER_SECOND,
      money,
      incomePerSec: this.incomePerSec,
      totalEarned: this.totalEarned,
      speed: this.speed,
      autoPilot: this.autoPilot.view(),
      unlocks: Object.values(this.catalog.unlocks).map((unlock): UnlockView => {
        const cost = bn(unlock.cost);
        return {
          id: unlock.id,
          unlocked: this.unlocked.has(unlock.id),
          available: this.requirementsMet(unlock.requires),
          cost,
          affordable: money.gte(cost),
        };
      }),
      globalUpgrades: upgradeViews(this.globalUpgrades, money),
      islands: this.islands.summaries(),
      island: this.island.snapshot(money, this.specialView()),
    };
  }

  // --- unlocks --------------------------------------------------------------------------

  private requirementsMet(requires: readonly UnlockId[]): boolean {
    for (const id of requires) if (!this.unlocked.has(id)) return false;
    return true;
  }

  availableUnlocks(): Array<{ id: string; cost: BigNum }> {
    const out: Array<{ id: string; cost: BigNum }> = [];
    for (const unlock of Object.values(this.catalog.unlocks)) {
      if (this.unlocked.has(unlock.id) || !this.requirementsMet(unlock.requires)) continue;
      out.push({ id: unlock.id, cost: bn(unlock.cost) });
    }
    return out;
  }

  // --- commands -------------------------------------------------------------------------

  build(plotId: PlotId, typeId: BuildingTypeId): CommandResult {
    const island = this.island;
    const def = this.catalog.buildings[typeId];
    if (!def || !island.hasPlot(plotId) || !island.def.buildingTypes.includes(typeId)) return fail('notFound');
    if (!this.isUnlocked(def.unlock)) return fail('locked');
    if (island.buildingAt(plotId)) return fail('plotOccupied');
    if (island.isFull) return fail('islandFull');
    if (island.countOf(typeId) >= def.maxCount) return fail('typeFull');
    const cost = island.costOf(def);
    if (!this.trySpend(cost)) return fail('notEnoughMoney');
    const building = island.build(plotId, typeId, cost);
    this.emit({ type: 'buildingBuilt', buildingId: building.id, typeId, plotId });
    return OK;
  }

  demolish(buildingId: BuildingId): CommandResult {
    const island = this.island;
    const building = island.building(buildingId);
    if (!building) return fail('notFound');
    const plotId = building.site.id;
    const refund = island.demolish(building);
    this.money = this.money.add(refund);
    this.emit({ type: 'buildingDemolished', buildingId, plotId, refund });
    return OK;
  }

  /** Buys one level of a track; returns the price paid or the reason it failed. */
  private buyLevel(target: Upgradable, trackId: UpgradeTrackId): BigNum | CommandResult {
    const track = target.tracks.find((entry) => entry.id === trackId);
    if (!track) return fail('notFound');
    const level = target.levels.get(trackId) ?? 0;
    if (isMaxed(track, level)) return fail('maxLevel');
    const cost = upgradeCost(track, level, target.upgradeCostScale);
    if (!this.trySpend(cost)) return fail('notEnoughMoney');
    target.levels.set(trackId, level + 1);
    target.stats.invalidate();
    return cost;
  }

  upgradeBuilding(buildingId: BuildingId, trackId: UpgradeTrackId): CommandResult {
    const island = this.island;
    const building = island.building(buildingId);
    if (!building) return fail('notFound');
    const paid = this.buyLevel(building, trackId);
    if (!(paid instanceof BigNum)) return paid;
    building.invested = building.invested.add(paid);
    building.refresh();
    island.touch();
    this.emit({ type: 'upgraded', scope: 'building', targetId: buildingId, trackId, level: building.levels.get(trackId) ?? 0 });
    return OK;
  }

  upgradeChannel(channelId: ChannelId, trackId: UpgradeTrackId): CommandResult {
    const island = this.island;
    const channel = island.channel(channelId);
    if (!channel) return fail('notFound');
    if (channel !== island.inbound && !this.isUnlocked(this.catalog.saleChannels[channelId]?.unlock ?? null)) {
      return fail('locked');
    }
    const paid = this.buyLevel(channel, trackId);
    if (!(paid instanceof BigNum)) return paid;
    channel.refresh();
    island.touch();
    this.emit({
      type: 'upgraded',
      scope: channel === island.inbound ? 'inbound' : 'sale',
      targetId: channelId,
      trackId,
      level: channel.levels.get(trackId) ?? 0,
    });
    return OK;
  }

  upgradeGlobal(trackId: UpgradeTrackId): CommandResult {
    const paid = this.buyLevel(this.globalUpgrades, trackId);
    if (!(paid instanceof BigNum)) return paid;
    this.emit({
      type: 'upgraded',
      scope: 'global',
      targetId: null,
      trackId,
      level: this.globalUpgrades.levels.get(trackId) ?? 0,
    });
    return OK;
  }

  unlock(unlockId: UnlockId): CommandResult {
    const def = this.catalog.unlocks[unlockId];
    if (!def) return fail('notFound');
    if (this.unlocked.has(unlockId)) return fail('alreadyUnlocked');
    if (!this.requirementsMet(def.requires)) return fail('requirementsNotMet');
    if (!this.trySpend(bn(def.cost))) return fail('notEnoughMoney');
    this.unlocked.add(unlockId);
    // A newly opened sale channel changes where goods should go.
    this.island.touch();
    this.emit({ type: 'unlocked', unlockId });
    return OK;
  }

  collectSpecialCargo(id: string): CommandResult {
    const special = this.special;
    if (!special || special.id !== id) return fail('notFound');
    const reward = this.specialReward();
    this.special = null;
    this.nextSpecialTick = this.tickCount + this.rollSpecialDelay();
    this.addIncome(reward);
    this.emit({ type: 'specialCargoCollected', id, reward });
    return OK;
  }

  setSpeed(speed: GameSpeed): void {
    if (SPEEDS.includes(speed)) this.speed = speed;
  }

  setAutoPilot(enabled: boolean): void {
    if (this.autoPilot.enabled === enabled) return;
    this.autoPilot.enabled = enabled;
    this.autoPilot.reset();
  }

  switchIsland(islandId: IslandId): CommandResult {
    const before = this.island.id;
    if (!this.islands.switchTo(islandId)) return fail('notFound');
    if (before === islandId) return OK;
    this.autoPilot.reset();
    // The cargo was lying on the island that is no longer on screen.
    if (this.special) {
      this.special = null;
      this.nextSpecialTick = this.tickCount + this.rollSpecialDelay();
    }
    this.emit({ type: 'islandSwitched', islandId });
    return OK;
  }

  // --- special cargo --------------------------------------------------------------------

  private rollSpecialDelay(): number {
    const { minIntervalSec, maxIntervalSec } = this.balance.specialCargo;
    return secondsToTicks(this.rng.range(minIntervalSec, Math.max(minIntervalSec, maxIntervalSec)));
  }

  /** A configured number of seconds of the current income, with a floor so it is never worthless. */
  private specialReward(): BigNum {
    const { rewardSeconds, minReward } = this.balance.specialCargo;
    return this.incomePerSec.mul(rewardSeconds).max(minReward);
  }

  private updateSpecial(tick: number): void {
    const special = this.special;
    if (special) {
      if (tick >= special.expires) {
        this.special = null;
        this.nextSpecialTick = tick + this.rollSpecialDelay();
      }
      return;
    }
    if (tick < this.nextSpecialTick) return;
    // It turns up somewhere along the roads, where it is easy to spot.
    const nodes = this.island.layout.roadNodes;
    if (nodes.length === 0) {
      this.nextSpecialTick = tick + this.rollSpecialDelay();
      return;
    }
    const node = this.rng.pick(nodes);
    this.specialSeq += 1;
    this.special = {
      id: `special-${this.specialSeq}`,
      x: node.x,
      z: node.z,
      expires: tick + secondsToTicks(this.balance.specialCargo.lifetimeSec),
    };
    this.emit({ type: 'specialCargoSpawned', id: this.special.id });
  }

  private specialView(): SpecialCargoView | null {
    const special = this.special;
    if (!special) return null;
    return {
      id: special.id,
      x: special.x,
      z: special.z,
      expiresInSec: Math.max(0, special.expires - this.tickCount) / TICKS_PER_SECOND,
      reward: this.specialReward(),
    };
  }

  private restoreSpecial(saved: unknown): void {
    const data = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
    this.specialSeq = Math.max(0, Math.floor(Number(data.seq) || 0));
    this.nextSpecialTick =
      typeof data.next === 'number' ? data.next : this.tickCount + this.rollSpecialDelay();
    const cargo = data.cargo as Record<string, unknown> | null | undefined;
    if (
      cargo &&
      typeof cargo === 'object' &&
      typeof cargo.id === 'string' &&
      typeof cargo.x === 'number' &&
      typeof cargo.z === 'number' &&
      typeof cargo.expires === 'number'
    ) {
      this.special = { id: cargo.id, x: cargo.x, z: cargo.z, expires: cargo.expires };
    }
  }

  // --- saving -----------------------------------------------------------------------------

  serialize(): SaveData {
    const state: JsonValue = {
      seed: this.seed,
      rng: this.rng.getState(),
      tick: this.tickCount,
      money: this.money.toString(),
      totalEarned: this.totalEarned.toString(),
      income: this.incomePerSec.toString(),
      incomeWindow: this.earnedThisWindow.toString(),
      speed: this.speed,
      unlocked: [...this.unlocked],
      global: serializeLevels(this.globalUpgrades.levels),
      islands: this.islands.toJSON(),
      auto: this.autoPilot.toJSON(),
      special: {
        seq: this.specialSeq,
        next: this.nextSpecialTick,
        cargo: this.special ? { ...this.special } : null,
      },
    };
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      summary: {
        money: this.money.toString(),
        buildings: this.islands.buildingCount(),
        playSeconds: this.tickCount / TICKS_PER_SECOND,
      },
      // A plain JSON copy, so the save shares nothing with the running game.
      state: JSON.parse(JSON.stringify(state)) as JsonValue,
    };
  }
}
