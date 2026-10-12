/**
 * Balance constants that are not part of the content catalog. Everything the
 * simulation needs to know about pacing, storage sizes, penalties and auto
 * mode lives here so it can be tuned in one place with the headless runner.
 */
export interface Balance {
  storage: {
    /** Input slots hold this many seconds of consumption (at the upgraded speed). */
    inputBufferSec: number;
    minInputCycles: number;
    /** Output slots hold this many seconds of production. */
    outputBufferSec: number;
    minOutputCycles: number;
  };
  waste: {
    /** Waste piling up for this many seconds of production triggers the penalty. */
    limitSec: number;
    minLimitCycles: number;
    /** Cycle speed multiplier while a building is clogged with waste. */
    slowdown: number;
    /** Modifier source name; also a translation key suffix. */
    source: string;
  };
  weight: {
    /** Speed lost per weight point above 1 at sensitivity 1. */
    slowPerWeight: number;
    /** A loaded vehicle never drops below this fraction of its base speed. */
    minFactor: number;
    carrierSensitivity: number;
    inboundSensitivity: number;
  };
  carriers: {
    model: string;
    /** World units per second when empty. */
    speed: number;
    baseCount: number;
    baseLoad: number;
    /** Seconds spent loading or unloading at each stop. */
    handlingSec: number;
    /** Delivery stops per trip, not counting the final sale stop. */
    maxStops: number;
  };
  /** Carriers of the inbound yard are not upgraded on their own; they follow the inbound tracks. */
  yard: {
    baseCarriers: number;
    /** One more yard carrier per this many levels of the inbound interval track. */
    intervalLevelsPerCarrier: number;
    maxCarriers: number;
    /** Yard carrier load as a multiple of the inbound truck load. */
    loadFactor: number;
  };
  channels: {
    /** A sale channel counts as backed up once this many vehicle loads are waiting ahead of an item. */
    backlogLoads: number;
    handlingSec: number;
    /** Multiplies the base cost of every upgrade track of a channel. */
    upgradeCostScale: Record<string, number>;
    /** Distance from a facility's centre to its loading point. */
    dockOffset: number;
  };
  /** Stat values before any upgrade. */
  baseStats: { batchSize: number; cycleSpeed: number; priceMultiplier: number };
  autoPilot: {
    checkEverySec: number;
    /** Only goals affordable within this many seconds of current income are considered. */
    horizonSec: number;
    /** A goal that still is not affordable after this long is dropped and redrawn. */
    retargetSec: number;
    weights: {
      unlock: number;
      build: number;
      buildingUpgrade: number;
      channelUpgrade: number;
      globalUpgrade: number;
    };
  };
  specialCargo: {
    minIntervalSec: number;
    maxIntervalSec: number;
    lifetimeSec: number;
    /** Reward is this many seconds of current income. */
    rewardSeconds: number;
    minReward: number;
  };
  islands: {
    /** Simulated seconds fast-forwarded on a copy to estimate the income of an island being left. */
    estimateSec: number;
  };
  income: {
    /** Time constant of the rolling income average. */
    smoothingSec: number;
  };
  /** Undrained events beyond this count are dropped, oldest first. */
  eventQueueLimit: number;
}

export const BALANCE: Balance = {
  storage: { inputBufferSec: 40, minInputCycles: 2, outputBufferSec: 60, minOutputCycles: 2 },
  waste: { limitSec: 120, minLimitCycles: 4, slowdown: 0.5, source: 'wasteClogged' },
  weight: { slowPerWeight: 0.15, minFactor: 0.3, carrierSensitivity: 0.5, inboundSensitivity: 0.5 },
  carriers: { model: 'vehicle.carrier', speed: 10, baseCount: 1, baseLoad: 6, handlingSec: 1, maxStops: 4 },
  yard: { baseCarriers: 1, intervalLevelsPerCarrier: 3, maxCarriers: 4, loadFactor: 1 },
  channels: {
    backlogLoads: 2,
    handlingSec: 2,
    upgradeCostScale: { 'inbound.truck': 1, 'sale.truck': 1, 'sale.ship': 2e4, 'sale.plane': 2e7 },
    dockOffset: 6,
  },
  baseStats: { batchSize: 1, cycleSpeed: 1, priceMultiplier: 1 },
  autoPilot: {
    checkEverySec: 1,
    horizonSec: 600,
    retargetSec: 900,
    weights: { unlock: 3, build: 3, buildingUpgrade: 4, channelUpgrade: 2, globalUpgrade: 1 },
  },
  specialCargo: { minIntervalSec: 180, maxIntervalSec: 420, lifetimeSec: 40, rewardSeconds: 45, minReward: 10 },
  islands: { estimateSec: 600 },
  income: { smoothingSec: 30 },
  eventQueueLimit: 2000,
};
