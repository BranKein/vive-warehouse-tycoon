import type { ModelRegistry } from '../ModelRegistry';
import { registerBuildingModels } from './buildings';
import type { Kit } from './kit';
import { registerPropModels } from './props';
import { registerSawmillModel } from './sawmill';
import { registerGroup1Models } from './tier1/index';
import { registerGroup2Models } from './tier2/index';
import { registerGroup3Models } from './tier3/index';
import { registerVehicleModels } from './vehicles';

/** Registers every primitive-built model under its default name. */
export function registerDefaultModels(registry: ModelRegistry, kit: Kit): void {
  registerBuildingModels(registry);
  // Hand-drawn models replace the parametric draft of the same name.
  registerSawmillModel(registry);
  registerGroup1Models(registry);
  registerGroup2Models(registry);
  registerGroup3Models(registry);
  registerVehicleModels(registry);
  registerPropModels(registry, kit);
}

/** Models redrawn as style samples for review (PLAN.md stage 5). The model page lists them first. */
export const STYLE_SAMPLES: string[] = ['building.sawmill', 'vehicle.boxTruck'];
