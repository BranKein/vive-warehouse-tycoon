import type { BuildingCategory, BuildingDef, UnlockDef } from '@/contracts';
import { ITEMS } from './items';
import { RECIPES } from './recipes';
import { BUILDING_TRACKS, WASTE_TRACKS } from './upgrades';

interface Row {
  id: string;
  category: BuildingCategory;
  buildCost: number;
  /** 0 = available from the start. */
  unlockCost: number;
  maxCount: number;
  /** Upgrade costs are set apart from the build cost, so cheaper buildings do not also mean cheaper upgrades. */
  upgradeCostScale: number;
}

/**
 * How much more each further building of a type costs. Higher tiers grow
 * faster: one of them does the work of several below it. With tier 1 at 5,
 * the fourth mill costs more than the first tier-2 factory.
 */
const BUILD_COST_GROWTH: Record<BuildingCategory, number> = {
  tier1: 5,
  disposal: 6,
  tier2: 6,
  tier3: 8,
  tier4: 10,
  handmade: 10,
};

// Counts and costs are derived in docs/balance-buildings.md: 48 plots hold
// about two full chains, and every unlock costs 2.5 to 10 times the one before.
const ROWS: Row[] = [
  { id: 'sawmill', category: 'tier1', buildCost: 40, unlockCost: 0, maxCount: 4, upgradeCostScale: 1 },
  { id: 'steelMill', category: 'tier1', buildCost: 60, unlockCost: 0, maxCount: 4, upgradeCostScale: 1.5 },
  { id: 'textileMill', category: 'tier1', buildCost: 60, unlockCost: 0, maxCount: 4, upgradeCostScale: 1.5 },
  { id: 'refinery', category: 'tier1', buildCost: 90, unlockCost: 0, maxCount: 4, upgradeCostScale: 2.25 },
  { id: 'glassworks', category: 'tier1', buildCost: 90, unlockCost: 0, maxCount: 4, upgradeCostScale: 2.25 },
  { id: 'flourMill', category: 'tier1', buildCost: 70, unlockCost: 0, maxCount: 4, upgradeCostScale: 1.75 },
  { id: 'wasteDisposal', category: 'disposal', buildCost: 150, unlockCost: 200, maxCount: 3, upgradeCostScale: 3.75 },
  { id: 'furnitureFactory', category: 'tier2', buildCost: 1000, unlockCost: 1500, maxCount: 2, upgradeCostScale: 50 },
  { id: 'toolFactory', category: 'tier2', buildCost: 2500, unlockCost: 4000, maxCount: 2, upgradeCostScale: 150 },
  { id: 'bottleFactory', category: 'tier2', buildCost: 6000, unlockCost: 10000, maxCount: 2, upgradeCostScale: 375 },
  { id: 'snackFactory', category: 'tier2', buildCost: 15000, unlockCost: 25000, maxCount: 3, upgradeCostScale: 1000 },
  { id: 'partsFactory', category: 'tier2', buildCost: 40000, unlockCost: 60000, maxCount: 2, upgradeCostScale: 2500 },
  { id: 'sofaWorkshop', category: 'tier3', buildCost: 250000, unlockCost: 400000, maxCount: 2, upgradeCostScale: 5e4 },
  { id: 'packagingPlant', category: 'tier3', buildCost: 1.2e6, unlockCost: 2e6, maxCount: 2, upgradeCostScale: 3.75e5 },
  { id: 'applianceFactory', category: 'tier3', buildCost: 6e6, unlockCost: 1e7, maxCount: 2, upgradeCostScale: 3e6 },
  { id: 'luxuryPackingCenter', category: 'tier4', buildCost: 6e7, unlockCost: 1e8, maxCount: 2, upgradeCostScale: 1.25e8 },
  { id: 'smartHomeFactory', category: 'tier4', buildCost: 6e8, unlockCost: 1e9, maxCount: 2, upgradeCostScale: 2.5e9 },
  { id: 'handmadeWorkshop', category: 'handmade', buildCost: 1.2e10, unlockCost: 2e10, maxCount: 2, upgradeCostScale: 5e10 },
];

export const buildingUnlockId = (buildingType: string): string => `unlock.building.${buildingType}`;

const WASTE_ITEMS = new Set(ITEMS.filter((item) => item.kind === 'waste').map((item) => item.id));
/** Buildings whose recipe leaves waste get one more upgrade, to cut it down. */
const makesWaste = (recipeId: string): boolean =>
  RECIPES.find((recipe) => recipe.id === recipeId)?.outputs.some((output) => WASTE_ITEMS.has(output.item)) ?? false;

export const BUILDINGS: BuildingDef[] = ROWS.map((row) => ({
  id: row.id,
  category: row.category,
  recipe: row.id,
  model: `building.${row.id}`,
  buildCost: row.buildCost,
  buildCostGrowth: BUILD_COST_GROWTH[row.category],
  maxCount: row.maxCount,
  upgradeCostScale: row.upgradeCostScale,
  unlock: row.unlockCost > 0 ? buildingUnlockId(row.id) : null,
  upgradeTracks: makesWaste(row.id) ? [...BUILDING_TRACKS, ...WASTE_TRACKS] : BUILDING_TRACKS,
}));

export const BUILDING_UNLOCKS: UnlockDef[] = ROWS.filter((row) => row.unlockCost > 0).map((row) => ({
  id: buildingUnlockId(row.id),
  cost: row.unlockCost,
  requires: [],
  grants: { type: 'building', buildingType: row.id },
}));
