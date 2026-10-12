import type { ModelRegistry } from '../ModelRegistry';
import { registerBuildingModels } from './buildings';
import type { Kit } from './kit';
import { registerPropModels } from './props';
import { registerVehicleModels } from './vehicles';

/** Registers every primitive-built model under its default name. */
export function registerDefaultModels(registry: ModelRegistry, kit: Kit): void {
  registerBuildingModels(registry);
  registerVehicleModels(registry);
  registerPropModels(registry, kit);
}
