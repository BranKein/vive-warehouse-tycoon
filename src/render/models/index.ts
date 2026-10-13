import type { ModelRegistry } from '../ModelRegistry';
import { registerBuildingModels } from './buildings';
import type { Kit } from './kit';
import { registerPropModels } from './props';
import { registerSawmillModel } from './sawmill';
import { registerVehicleModels } from './vehicles';

/** Registers every primitive-built model under its default name. */
export function registerDefaultModels(registry: ModelRegistry, kit: Kit): void {
  registerBuildingModels(registry);
  // Hand-drawn models replace the parametric draft of the same name.
  registerSawmillModel(registry);
  registerVehicleModels(registry);
  registerPropModels(registry, kit);
}

/** Models redrawn as style samples for review (PLAN.md stage 5). The model page lists them first. */
export const STYLE_SAMPLES: string[] = ['building.sawmill', 'vehicle.boxTruck'];
