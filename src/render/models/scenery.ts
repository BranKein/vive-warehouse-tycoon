/**
 * The countryside around the board: a hill and a cloud. Both are one unit
 * big and are stretched by the view; the hill is white so each copy takes one
 * of the hill greens.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import type { Kit } from './kit';

export const HILL_MODEL = 'prop.hill';
export const CLOUD_MODEL = 'prop.cloud';

/** A dome one unit in radius and one unit high. */
function hill(kit: Kit): Object3D {
  return kit.group([kit.dome(1, 1, 1, kit.materials.tintable)]);
}

/** A flat-bottomed puff of five lumps, about two units long. */
function cloud(kit: Kit): Object3D {
  const white = kit.theme.props.cloud;
  return kit.group([
    kit.dome(0.62, 0.5, 0.5, white),
    kit.dome(0.46, 0.36, 0.42, white, { x: -0.62, z: 0.06 }),
    kit.dome(0.42, 0.32, 0.4, white, { x: 0.66, z: -0.04 }),
    kit.dome(0.36, 0.3, 0.34, white, { x: 0.22, z: 0.32 }),
    kit.dome(0.34, 0.28, 0.32, white, { x: -0.26, z: -0.3 }),
    kit.box(1.5, 0.08, 0.6, white, { y: -0.04, r: 0.04 }),
  ]);
}

export function registerSceneryModels(registry: ModelRegistry): void {
  registry.register(HILL_MODEL, hill);
  registry.register(CLOUD_MODEL, cloud);
}
