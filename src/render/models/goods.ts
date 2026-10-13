/**
 * Stock as it stands in the yards: a pallet, the box that is stacked on it
 * (white, tinted per item) and the heap that stands for waste. Sizes come from
 * `renderConfig.pile`, which the view also uses to stack them.
 */
import type { Object3D } from 'three';
import { renderConfig } from '../config';
import type { ModelRegistry } from '../ModelRegistry';
import type { Kit } from './kit';

export const PALLET_MODEL = 'prop.pallet';
export const CRATE_MODEL = 'prop.crate';
export const WASTE_HEAP_MODEL = 'prop.wasteHeap';

/** Wooden pallet: three runners under a deck of boards. */
function pallet(kit: Kit): Object3D {
  const size = renderConfig.pile.palletSize;
  const h = renderConfig.pile.palletHeight;
  const wood = kit.theme.goods.pallet;
  const runner = h * 0.6;
  const parts: Object3D[] = [];
  for (const z of [-1, 0, 1]) parts.push(kit.box(size, runner, 0.18, wood, { z: z * (size / 2 - 0.09), r: 0.03 }));
  for (const x of [-2, -1, 0, 1, 2]) parts.push(kit.box(0.22, h - runner, size, wood, { x: x * 0.27, y: runner, r: 0.02 }));
  return kit.group(parts);
}

/** Cardboard box with a lid and a strip of tape over it. White, so each copy takes the colour of its item. */
function crate(kit: Kit): Object3D {
  const s = renderConfig.pile.crateSize;
  const lid = s * 0.18;
  return kit.group([
    kit.box(s * 0.93, s - lid, s * 0.93, kit.materials.tintable, { r: 0.04 }),
    kit.box(s, lid, s, kit.materials.tintable, { y: s - lid - 0.01, r: 0.03 }),
    kit.box(s * 0.22, s, s * 1.03, kit.materials.tintableDark, { y: 0.004, r: 0.02 }),
  ]);
}

/** Waste: a lumpy heap with a dented drum half sunk into it, so it never reads as stock. */
function wasteHeap(kit: Kit): Object3D {
  const g = kit.theme.goods;
  const p = kit.theme.props;
  return kit.group([
    kit.dome(0.78, 0.62, 0.72, g.waste, { x: -0.08 }),
    kit.dome(0.46, 0.44, 0.46, g.wasteDark, { x: 0.42, z: 0.3 }),
    kit.dome(0.4, 0.3, 0.42, g.wasteDark, { x: -0.44, z: -0.36 }),
    kit.dome(0.3, 0.24, 0.3, g.waste, { x: -0.5, z: 0.42 }),
    kit.cyl(0.2, 0.2, 0.5, p.darkMetal, { x: 0.3, y: 0.18, z: -0.38, rz: 0.5, rx: 0.2 }, 12),
  ]);
}

export function registerGoodsModels(registry: ModelRegistry): void {
  registry.register(PALLET_MODEL, pallet);
  registry.register(CRATE_MODEL, crate);
  registry.register(WASTE_HEAP_MODEL, wasteHeap);
}
