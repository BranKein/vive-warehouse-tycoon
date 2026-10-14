/**
 * Small pieces the view throws into the air when something happens: coins
 * over a facility that just sold goods, sparks over a building that was just
 * upgraded, puffs of smoke from the chimneys of buildings at work. All are
 * centred on their origin, because they spin.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import type { Kit } from './kit';

export const COIN_MODEL = 'prop.coin';
export const SPARK_MODEL = 'prop.spark';
export const SMOKE_MODEL = 'prop.smoke';

/** Upright coin: a thick disc with a raised rim and a paler middle on both faces. */
function coin(kit: Kit): Object3D {
  const e = kit.theme.effects;
  const HALF_PI = Math.PI / 2;
  return kit.group([
    kit.cyl(0.5, 0.5, 0.16, e.coin, { y: -0.08, rx: HALF_PI }, 20),
    kit.cyl(0.36, 0.36, 0.2, e.specialGlow, { y: -0.1, rx: HALF_PI }, 20),
  ]);
}

/** Four-sided diamond, a little taller than wide. */
function spark(kit: Kit): Object3D {
  const glow = kit.theme.effects.special;
  return kit.group([
    kit.cone(0.3, 0.5, glow, { ry: Math.PI / 4 }, 4),
    kit.cone(0.3, 0.5, glow, { y: -0.5, rx: Math.PI, ry: Math.PI / 4 }, 4),
  ]);
}

/** A soft puff: three overlapping balls, one bigger than the others. */
function smoke(kit: Kit): Object3D {
  const puff = kit.theme.effects.smoke;
  return kit.group([
    kit.blob(0.5, 0.42, 0.5, puff, { y: -0.42 }),
    kit.blob(0.34, 0.3, 0.34, puff, { x: 0.4, y: -0.3, z: 0.12 }),
    kit.blob(0.3, 0.27, 0.3, puff, { x: -0.32, y: -0.18, z: -0.2 }),
  ]);
}

export function registerEffectModels(registry: ModelRegistry): void {
  registry.register(COIN_MODEL, coin);
  registry.register(SPARK_MODEL, spark);
  registry.register(SMOKE_MODEL, smoke);
}
