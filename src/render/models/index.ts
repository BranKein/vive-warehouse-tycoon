import type { ModelRegistry } from '../ModelRegistry';
import { registerBuildingModels } from './buildings';
import type { Kit } from './kit';
import { registerPropModels } from './props';
import { registerSawmillModel } from './sawmill';
import { registerGroup1Models } from './tier1/index';
import { registerGroup2Models } from './tier2/index';
import { registerGroup3Models } from './tier3/index';
import { registerVehicleModels } from './vehicles';

/** The buildings: the parametric drafts first, then the hand-drawn ones that replace them by name. */
function registerBuildings(registry: ModelRegistry): void {
  registerBuildingModels(registry);
  registerSawmillModel(registry);
  registerGroup1Models(registry);
  registerGroup2Models(registry);
  registerGroup3Models(registry);
}

/** What the game draws with shaped models so far: buildings and vehicles. Everything else is still a box. */
export function registerGameModels(registry: ModelRegistry): void {
  registerBuildings(registry);
  registerVehicleModels(registry);
}

/** Registers every primitive-built model under its default name. */
export function registerDefaultModels(registry: ModelRegistry, kit: Kit): void {
  registerBuildings(registry);
  registerVehicleModels(registry);
  registerPropModels(registry, kit);
}

/** Models redrawn as style samples for review (PLAN.md stage 5). The model page lists them first. */
export const STYLE_SAMPLES: string[] = ['building.sawmill', 'vehicle.boxTruck', 'vehicle.carrier'];
