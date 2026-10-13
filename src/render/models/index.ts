import type { ModelRegistry } from '../ModelRegistry';
import { registerBuildingModels } from './buildings';
import { registerFacilityModels } from './facilities';
import { registerGoodsModels } from './goods';
import type { Kit } from './kit';
import { registerPropModels, registerStreetModels } from './props';
import { registerSawmillModel } from './sawmill';
import { registerGroup1Models } from './tier1/index';
import { registerGroup2Models } from './tier2/index';
import { registerGroup3Models } from './tier3/index';
import { registerVehicleModels } from './vehicles';

function registerHandDrawnBuildings(registry: ModelRegistry): void {
  registerSawmillModel(registry);
  registerGroup1Models(registry);
  registerGroup2Models(registry);
  registerGroup3Models(registry);
}

/** The buildings: the parametric drafts first, then the hand-drawn ones that replace them by name. */
function registerBuildings(registry: ModelRegistry): void {
  registerBuildingModels(registry);
  registerHandDrawnBuildings(registry);
}

/** What the game draws with shaped models so far: buildings, vehicles, facilities, stock piles, trees and street lamps. Everything else is still a box. */
export function registerGameModels(registry: ModelRegistry, kit: Kit): void {
  registerBuildings(registry);
  registerStreetModels(registry, kit);
  registerVehicleModels(registry);
  registerFacilityModels(registry);
  registerGoodsModels(registry);
}

/** Vehicles redrawn by hand. */
const HAND_DRAWN_VEHICLES = ['vehicle.boxTruck', 'vehicle.carrier', 'vehicle.forklift', 'vehicle.cargoShip', 'vehicle.cargoPlane'];

/**
 * Registers every primitive-built model under its default name. Returns the
 * names of the models drawn by hand (PLAN.md stage 5): those are the ones the
 * user reviews on the model page; everything else is an old draft.
 */
export function registerDefaultModels(registry: ModelRegistry, kit: Kit): string[] {
  registerBuildingModels(registry);
  registerVehicleModels(registry);
  registerPropModels(registry, kit);
  const drafts = new Map(registry.names().map((name) => [name, registry.get(name)]));
  registerHandDrawnBuildings(registry);
  // After the props, whose facility drafts these replace.
  registerFacilityModels(registry);
  registerGoodsModels(registry);
  const redrawn = registry.names().filter((name) => drafts.get(name) !== registry.get(name) && !name.endsWith('.default'));
  return [...redrawn, ...HAND_DRAWN_VEHICLES];
}
