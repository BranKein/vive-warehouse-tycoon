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
}

/** First-guess costs; tuned against the pacing targets in PLAN.md with the headless runner. */
const ROWS: Row[] = [
  { id: 'sawmill', category: 'tier1', buildCost: 40, unlockCost: 0 },
  { id: 'steelMill', category: 'tier1', buildCost: 60, unlockCost: 0 },
  { id: 'textileMill', category: 'tier1', buildCost: 60, unlockCost: 0 },
  { id: 'refinery', category: 'tier1', buildCost: 90, unlockCost: 0 },
  { id: 'glassworks', category: 'tier1', buildCost: 90, unlockCost: 0 },
  { id: 'flourMill', category: 'tier1', buildCost: 70, unlockCost: 0 },
  { id: 'wasteDisposal', category: 'disposal', buildCost: 150, unlockCost: 200 },
  { id: 'furnitureFactory', category: 'tier2', buildCost: 2000, unlockCost: 3000 },
  { id: 'toolFactory', category: 'tier2', buildCost: 6000, unlockCost: 12000 },
  { id: 'bottleFactory', category: 'tier2', buildCost: 15000, unlockCost: 30000 },
  { id: 'snackFactory', category: 'tier2', buildCost: 40000, unlockCost: 80000 },
  { id: 'partsFactory', category: 'tier2', buildCost: 100000, unlockCost: 250000 },
  { id: 'sofaWorkshop', category: 'tier3', buildCost: 2e6, unlockCost: 6e6 },
  { id: 'packagingPlant', category: 'tier3', buildCost: 1.5e7, unlockCost: 5e7 },
  { id: 'applianceFactory', category: 'tier3', buildCost: 1.2e8, unlockCost: 4e8 },
  { id: 'luxuryPackingCenter', category: 'tier4', buildCost: 5e9, unlockCost: 2e10 },
  { id: 'smartHomeFactory', category: 'tier4', buildCost: 1e11, unlockCost: 5e11 },
  { id: 'handmadeWorkshop', category: 'handmade', buildCost: 2e12, unlockCost: 1e13 },
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
  buildCostGrowth: 4,
  upgradeCostScale: Math.max(1, row.buildCost / 40),
  unlock: row.unlockCost > 0 ? buildingUnlockId(row.id) : null,
  upgradeTracks: makesWaste(row.id) ? [...BUILDING_TRACKS, ...WASTE_TRACKS] : BUILDING_TRACKS,
}));

export const BUILDING_UNLOCKS: UnlockDef[] = ROWS.filter((row) => row.unlockCost > 0).map((row) => ({
  id: buildingUnlockId(row.id),
  cost: row.unlockCost,
  requires: [],
  grants: { type: 'building', buildingType: row.id },
}));
