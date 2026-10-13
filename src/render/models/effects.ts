/**
 * Small pieces the view throws into the air when something happens: coins
 * over a facility that just sold goods, sparks over a building that was just
 * upgraded. Both are centred on their origin, because they spin.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import type { Kit } from './kit';

export const COIN_MODEL = 'prop.coin';
export const SPARK_MODEL = 'prop.spark';

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

export function registerEffectModels(registry: ModelRegistry): void {
  registry.register(COIN_MODEL, coin);
  registry.register(SPARK_MODEL, spark);
}
