/**
 * Scenery that is not part of the game: a hill and a cloud for the
 * countryside (both one unit big and stretched by the view; the hill is white
 * so each copy takes one of the hill greens), the tunnel at the gate and the
 * runway lights.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import type { Kit } from './kit';

export const HILL_MODEL = 'prop.hill';
export const CLOUD_MODEL = 'prop.cloud';
export const TUNNEL_MODEL = 'prop.tunnel';
export const RUNWAY_LIGHT_MODEL = 'prop.runwayLight';
export const RUNWAY_END_LIGHT_MODEL = 'prop.runwayEndLight';

/** A dome one unit in radius and one unit high. */
function hill(kit: Kit): Object3D {
  return kit.group([kit.dome(1, 1, 1, kit.materials.tintable)]);
}

/**
 * A puff of five lumps, about two units long, round underneath as well: it is
 * seen from below as often as from the side. Its material keeps a light of
 * its own, so the underside is not a dark patch in the sky.
 */
function cloud(kit: Kit): Object3D {
  const white = kit.materials.cloud;
  return kit.group([
    kit.blob(0.62, 0.42, 0.5, white, { y: -0.3 }),
    kit.blob(0.46, 0.31, 0.42, white, { x: -0.62, y: -0.24, z: 0.06 }),
    kit.blob(0.42, 0.28, 0.4, white, { x: 0.66, y: -0.22, z: -0.04 }),
    kit.blob(0.36, 0.27, 0.34, white, { x: 0.22, y: -0.2, z: 0.32 }),
    kit.blob(0.34, 0.25, 0.32, white, { x: -0.26, y: -0.2, z: -0.3 }),
  ]);
}

/**
 * How far the tunnel reaches from the gate it stands on: `front` onto the
 * board (its mouth), `back` away from it, and to each side.
 */
export const TUNNEL_SIZE = { front: 7.6, back: 13, halfWidth: 8 } as const;

/**
 * The tunnel trucks come and go through. Origin on the gate, at the edge of
 * the board; the mouth faces +z, onto the board. A grassy mound with a stone
 * portal; a dark wall a little way in hides whatever is inside, so a truck
 * that stands on the gate cannot be seen and drives out of the dark.
 * The mound reaches below y = 0 because the ground beyond the board lies lower.
 */
function tunnel(kit: Kit): Object3D {
  const p = kit.theme.props;
  const grass = kit.theme.ground.grassDark;
  const HALF_PI = Math.PI / 2;
  const DROP = 0.7;
  const MOUTH_Z = 6;
  const parts: Object3D[] = [];
  // Mound: a barrel vault over the road, closed by a dome at the back.
  parts.push(kit.barrel(MOUTH_Z + 6, 5.6 + DROP, 14.4, grass, { y: -DROP, z: (MOUTH_Z - 6) / 2, ry: HALF_PI }));
  parts.push(kit.dome(7.2, 5.6 + DROP, 7, grass, { y: -DROP, z: -6 }));
  // The dark inside.
  parts.push(kit.box(8.2, 4.5, 0.5, p.shade, { z: MOUTH_Z - 0.1, r: 0.05 }));
  // Portal: two piers, a lintel with a cap, a keystone.
  for (const x of [-4.7, 4.7]) {
    parts.push(kit.box(1.5, 4.5, 1.7, p.concrete, { x, z: MOUTH_Z + 0.7, r: 0.25 }));
    parts.push(kit.box(1.8, 0.5, 2, p.rock, { x, z: MOUTH_Z + 0.7, r: 0.15 }));
  }
  parts.push(kit.box(11.2, 1.3, 1.7, p.concrete, { y: 4.4, z: MOUTH_Z + 0.7, r: 0.3 }));
  parts.push(kit.box(11.7, 0.4, 2, p.rock, { y: 5.6, z: MOUTH_Z + 0.7, r: 0.15 }));
  parts.push(kit.box(1.3, 1.5, 1.9, p.rock, { y: 4.3, z: MOUTH_Z + 0.75, r: 0.2 }));
  // Hazard stripe along the top of the opening, and bushes on the mound.
  parts.push(kit.box(7.6, 0.28, 0.2, p.hazard, { y: 4.06, z: MOUTH_Z + 1.5, r: 0.08 }));
  const leaves = kit.theme.props.foliage;
  parts.push(kit.blob(1.5, 1.1, 1.4, leaves[0]!, { x: -4.2, y: 3.6, z: 1.5 }));
  parts.push(kit.blob(1.1, 0.85, 1.1, leaves[2]!, { x: -2.9, y: 4.5, z: -1.2 }));
  parts.push(kit.blob(1.3, 1, 1.3, leaves[1]!, { x: 3.9, y: 3.9, z: -0.5 }));
  parts.push(kit.blob(0.9, 0.7, 0.9, leaves[3]!, { x: 4.6, y: 3.3, z: 2.4 }));
  return kit.group(parts);
}

/** A stud at the edge of the runway: lit white at night. */
function runwayLight(kit: Kit, lens = kit.materials.lamp): Object3D {
  return kit.group([
    kit.cyl(0.28, 0.34, 0.14, kit.theme.props.darkMetal, {}, 10),
    kit.dome(0.23, 0.22, 0.23, lens, { y: 0.12 }),
  ]);
}

export function registerSceneryModels(registry: ModelRegistry): void {
  registry.register(HILL_MODEL, hill);
  registry.register(CLOUD_MODEL, cloud);
  registry.register(TUNNEL_MODEL, tunnel);
  registry.register(RUNWAY_LIGHT_MODEL, (kit) => runwayLight(kit));
  registry.register(RUNWAY_END_LIGHT_MODEL, (kit) => runwayLight(kit, kit.materials.headlight));
}
