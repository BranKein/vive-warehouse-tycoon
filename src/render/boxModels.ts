/**
 * The plain-box first version of every model the view draws (PLAN.md 3.13:
 * shapes come later). Each is registered under the name the game asks for, so
 * swapping in the detailed models of `models/` later is a matter of
 * registering those factories under the same names.
 *
 * Models follow the registry conventions: origin on the ground at the centre
 * of the footprint, front is +z.
 */
import type { Object3D } from 'three';
import { renderConfig } from './config';
import type { ModelFactory, ModelRegistry } from './ModelRegistry';
import type { Kit, Paint } from './models/kit';
import { buildingPalette, facilityColor } from './theme';

type Size = readonly [number, number, number];

const box = (kit: Kit, size: Size, paint: Paint): Object3D => kit.box(size[0], size[1], size[2], paint);

/** 1 x 1 x 1 cube that the view scales and tints per copy. */
const unitCube =
  (paint: (kit: Kit) => Paint): ModelFactory =>
  (kit) =>
    kit.box(1, 1, 1, paint(kit), { r: 0.04 });

export const BLOCK_MODEL = 'prop.block';
export const SPECIAL_CARGO_MODEL = 'prop.specialCargo';
export const buildingModel = (typeId: string): string => `building.${typeId}`;
export const facilityModel = (kind: string): string => `facility.${kind}`;

export function registerBoxModels(registry: ModelRegistry, buildingTypes: Iterable<string>, facilityKinds: Iterable<string>): void {
  const sizes = renderConfig.boxes;

  // Buildings are told apart by colour only; the roof colour is the stronger of a type's palette.
  const building =
    (typeId: string): ModelFactory =>
    (kit) =>
      box(kit, sizes.building, buildingPalette(kit.theme, typeId).roof);
  for (const typeId of buildingTypes) registry.register(buildingModel(typeId), building(typeId));
  registry.register('building.default', building('default'));

  const facility =
    (kind: string): ModelFactory =>
    (kit) =>
      box(kit, sizes.facility, facilityColor(kit.theme, kind));
  for (const kind of facilityKinds) registry.register(facilityModel(kind), facility(kind));
  registry.register('facility.default', facility('default'));

  registry.register('vehicle.carrier', (kit) => box(kit, sizes.vehicles.carrier, kit.theme.vehicles.carrierCab));
  registry.register('vehicle.boxTruck', (kit) => box(kit, sizes.vehicles.boxTruck, kit.theme.vehicles.truckCab));
  registry.register('vehicle.cargoShip', (kit) => box(kit, sizes.vehicles.cargoShip, kit.theme.vehicles.shipHull));
  registry.register('vehicle.cargoPlane', (kit) => box(kit, sizes.vehicles.cargoPlane, kit.theme.vehicles.planeAccent));
  registry.register('vehicle.default', (kit) => box(kit, sizes.vehicles.fallback, kit.theme.vehicles.truckBody));

  registry.register(BLOCK_MODEL, unitCube((kit) => kit.materials.tintable));
  registry.register(SPECIAL_CARGO_MODEL, (kit) => box(kit, sizes.specialCargo, kit.theme.effects.special));
}
