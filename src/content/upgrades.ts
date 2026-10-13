import { Stat, type UpgradeTrackDef } from '@/contracts';

/**
 * Counts and speeds are capped; amounts grow forever. Every capped track has
 * an uncapped partner so no part of the chain becomes a permanent bottleneck.
 */
export const UPGRADE_TRACKS: UpgradeTrackDef[] = [
  // Buildings (base cost is multiplied by the building's upgradeCostScale)
  { id: 'building.level', scope: 'building', stat: Stat.batchSize, effect: { kind: 'multiply', perLevel: 1.5 }, baseCost: 20, costGrowth: 1.75, maxLevel: null, unit: 'multiplier' },
  { id: 'building.speed', scope: 'building', stat: Stat.cycleSpeed, effect: { kind: 'add', perLevel: 0.1 }, baseCost: 60, costGrowth: 2.4, maxLevel: 10, unit: 'multiplier' },
  { id: 'building.carriers', scope: 'building', stat: Stat.carrierCount, effect: { kind: 'add', perLevel: 1 }, baseCost: 80, costGrowth: 6, maxLevel: 2, unit: 'count' },
  { id: 'building.carrierLoad', scope: 'building', stat: Stat.carrierLoad, effect: { kind: 'multiply', perLevel: 2 }, baseCost: 25, costGrowth: 1.75, maxLevel: null, unit: 'amount' },
  // Only for buildings whose recipe makes waste. Capped, so some waste always remains.
  { id: 'building.wasteCut', scope: 'building', stat: Stat.wasteOutput, effect: { kind: 'multiply', perLevel: 0.9 }, baseCost: 50, costGrowth: 2, maxLevel: 7, unit: 'multiplier' },
  // Inbound raw materials
  { id: 'inbound.interval', scope: 'inbound', stat: Stat.interval, effect: { kind: 'multiply', perLevel: 0.92 }, baseCost: 100, costGrowth: 2.2, maxLevel: 12, unit: 'seconds' },
  { id: 'inbound.load', scope: 'inbound', stat: Stat.load, effect: { kind: 'multiply', perLevel: 2 }, baseCost: 30, costGrowth: 2, maxLevel: null, unit: 'amount' },
  // Sale channels (base cost is multiplied per channel in balance)
  { id: 'sale.interval', scope: 'sale', stat: Stat.interval, effect: { kind: 'multiply', perLevel: 0.92 }, baseCost: 100, costGrowth: 2.2, maxLevel: 12, unit: 'seconds' },
  { id: 'sale.load', scope: 'sale', stat: Stat.load, effect: { kind: 'multiply', perLevel: 2 }, baseCost: 30, costGrowth: 1.6, maxLevel: null, unit: 'amount' },
  { id: 'sale.carriers', scope: 'sale', stat: Stat.carrierCount, effect: { kind: 'add', perLevel: 1 }, baseCost: 30, costGrowth: 2.5, maxLevel: 5, unit: 'count' },
  { id: 'sale.carrierLoad', scope: 'sale', stat: Stat.carrierLoad, effect: { kind: 'multiply', perLevel: 2 }, baseCost: 25, costGrowth: 1.6, maxLevel: null, unit: 'amount' },
  // Whole game
  { id: 'global.price', scope: 'global', stat: Stat.priceMultiplier, effect: { kind: 'multiply', perLevel: 1.1 }, baseCost: 500, costGrowth: 2.5, maxLevel: null, unit: 'multiplier' },
];

export const BUILDING_TRACKS = ['building.level', 'building.speed', 'building.carriers', 'building.carrierLoad'];
export const WASTE_TRACKS = ['building.wasteCut'];
export const INBOUND_TRACKS = ['inbound.interval', 'inbound.load'];
export const SALE_TRACKS = ['sale.interval', 'sale.load', 'sale.carriers', 'sale.carrierLoad'];
export const GLOBAL_TRACKS = ['global.price'];
